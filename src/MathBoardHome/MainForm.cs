using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Win32;

namespace MathBoardHome
{
    /// <summary>
    /// A borderless window that covers the screen and sits underneath every program it opens.
    /// When a program is closed, Windows activates the next window down, which is this one,
    /// so the teacher lands back on the home screen without any process tracking.
    /// </summary>
    internal sealed class MainForm : Form
    {
        private const string HostName = "home.local";
        private const int WM_DEVICECHANGE = 0x0219;

        private readonly WebView2 _web;
        private readonly Timer _usbDebounce = new Timer { Interval = 1200 };
        private readonly Timer _usbPoll = new Timer { Interval = 4000 };
        private readonly Timer _adminTimeout = new Timer { Interval = 120000 };
        private HashSet<string> _knownDrives = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private AppConfig _config;
        private bool _allowClose;
        private bool _adminUnlocked;
        private DateTime _lastLaunch = DateTime.MinValue;
        private string _lastLaunchId;
        private readonly Timer _windowsPoll = new Timer { Interval = 1500 };
        private List<WindowTracker.OpenWindow> _openWindows = new List<WindowTracker.OpenWindow>();
        private string _lastWindowsJson = "";
        private HomeButton _home;

        public int ExitCode { get; private set; }

        public MainForm()
        {
            _config = AppConfig.Load();

            Text = "الرئيسية";
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            ShowInTaskbar = true; // tapping "الرئيسية" on the taskbar brings the home screen back
            BackColor = Color.FromArgb(0x16, 0x2F, 0x45);
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            ApplyBounds();

            _web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = BackColor };
            Controls.Add(_web);

            Load += async (s, e) => await InitWebAsync();
            FormClosing += OnFormClosing;
            Resize += (s, e) => { if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal; };
            SystemEvents.DisplaySettingsChanged += (s, e) => BeginInvoke((Action)ApplyBounds);
            SystemEvents.SessionEnding += (s, e) => _allowClose = true;

            _usbDebounce.Tick += (s, e) => { _usbDebounce.Stop(); ScanDrives(announce: true); };
            _usbPoll.Tick += (s, e) => ScanDrives(announce: true);
            _adminTimeout.Tick += (s, e) => { _adminTimeout.Stop(); _adminUnlocked = false; Send(new { type = "locked" }); };

            _knownDrives = new HashSet<string>(Launcher.RemovableDrives().Select(d => d.Name), StringComparer.OrdinalIgnoreCase);
            _usbPoll.Start();

            // Tablet-style switching: a floating home button over other programs, and the list
            // of open programs shown on the home screen while it is in front.
            ApplyShell();
            _windowsPoll.Tick += (s, e) => SendWindows(force: false);
            Activated += (s, e) =>
            {
                _home?.Hide();
                SendWindows(force: true);
                _windowsPoll.Start();
            };
            Deactivate += (s, e) =>
            {
                _windowsPoll.Stop();
                if (_home != null && !_allowClose) _home.Show();
            };
            FormClosed += (s, e) =>
            {
                Taskbar.Restore();
                _home?.Close();
            };
        }

        private void ApplyShell()
        {
            if (_config.GetBool("hideTaskbar", true)) Taskbar.AutoHide(true); else Taskbar.Restore();

            bool wantHome = _config.GetBool("homeButton", true);
            if (wantHome && _home == null)
            {
                int size = 76;
                if (_config.Root.TryGetValue("homeButtonSize", out object v) && v is int n) size = n;
                _home = new HomeButton(BringHome, _config.GetString("homeButtonPosition", "bottom-left"), size);
                _home.CreateControl();
            }
            else if (!wantHome && _home != null)
            {
                _home.Close();
                _home = null;
            }
        }

        /// <summary>Brings the home screen in front of every program (the programs stay open).</summary>
        private void BringHome()
        {
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            Show();
            TopMost = true;   // reliably wins the foreground, then drop back
            TopMost = false;
            Activate();
            WindowTracker.SetForegroundWindow(Handle);
        }

        private void SendWindows(bool force)
        {
            var own = new List<IntPtr> { Handle };
            if (_home != null) own.Add(_home.Handle);
            _openWindows = WindowTracker.List(own);
            var list = _openWindows.Select(w => (object)new Dictionary<string, object>
            {
                ["id"] = w.Handle.ToInt64().ToString(),
                ["title"] = w.Title,
                ["icon"] = WindowTracker.IconDataUrl(w.Exe),
            }).ToArray();
            string json = AppConfig.Json.Serialize(list);
            if (!force && json == _lastWindowsJson) return;
            _lastWindowsJson = json;
            Send(new { type = "windows", windows = list });
        }

        private IntPtr KnownWindow(string id)
        {
            if (!long.TryParse(id, out long value)) return IntPtr.Zero;
            var hit = _openWindows.FirstOrDefault(w => w.Handle.ToInt64() == value);
            return hit?.Handle ?? IntPtr.Zero;
        }

        private void ApplyBounds()
        {
            Screen screen = Screen.PrimaryScreen;
            Bounds = _config.GetBool("coverTaskbar", false) ? screen.Bounds : screen.WorkingArea;
        }

        private void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            // Alt+F4 or an accidental close must not drop the teacher onto the desktop.
            if (!_allowClose && e.CloseReason == CloseReason.UserClosing) e.Cancel = true;
        }

        // ---------------------------------------------------------------- WebView2

        private async System.Threading.Tasks.Task InitWebAsync()
        {
            try
            {
                string dataDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MathBoardHome", "WebView2");
                var env = await CoreWebView2Environment.CreateAsync(null, dataDir);
                await _web.EnsureCoreWebView2Async(env);
            }
            catch (WebView2RuntimeNotFoundException ex)
            {
                Log.Write("WebView2 runtime missing", ex);
                MessageBox.Show(this,
                    "مكوّن Microsoft Edge WebView2 غير مثبّت على هذا الجهاز.\nثبّتيه من موقع مايكروسوفت ثم أعيدي التشغيل.",
                    "الرئيسية", MessageBoxButtons.OK, MessageBoxIcon.Warning,
                    MessageBoxDefaultButton.Button1, MessageBoxOptions.RightAlign | MessageBoxOptions.RtlReading);
                _allowClose = true;
                Close();
                return;
            }
            catch (Exception ex)
            {
                Log.Write("WebView2 init failed", ex);
                return;
            }

            CoreWebView2 core = _web.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.IsPinchZoomEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreBrowserAcceleratorKeysEnabled = false;
            core.Settings.IsSwipeNavigationEnabled = false;
            core.Settings.IsGeneralAutofillEnabled = false;
            core.Settings.IsPasswordAutosaveEnabled = false;

            string www = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
            core.SetVirtualHostNameToFolderMapping(HostName, www, CoreWebView2HostResourceAccessKind.Allow);

            core.WebMessageReceived += OnWebMessage;
            core.NewWindowRequested += (s, e) => { e.Handled = true; Launcher.OpenUrl(e.Uri); };
            core.NavigationStarting += (s, e) =>
            {
                // The home screen never navigates away; external links open in the browser.
                if (!e.Uri.StartsWith("https://" + HostName + "/", StringComparison.OrdinalIgnoreCase))
                {
                    e.Cancel = true;
                    Launcher.OpenUrl(e.Uri);
                }
            };
            core.ProcessFailed += (s, e) =>
            {
                Log.Write("WebView2 process failed: " + e.ProcessFailedKind);
                try { core.Reload(); } catch { }
            };

            core.Navigate("https://" + HostName + "/index.html");
        }

        private void Send(object message)
        {
            try { _web.CoreWebView2?.PostWebMessageAsJson(AppConfig.Json.Serialize(message)); }
            catch (Exception ex) { Log.Write("PostWebMessage failed", ex); }
        }

        private void SendConfig()
        {
            Send(new
            {
                type = "config",
                config = _config.ForWeb(),
                error = _config.LoadError,
                drives = DriveList(),
            });
        }

        private object[] DriveList() =>
            Launcher.RemovableDrives()
                .Select(d => (object)new Dictionary<string, object> { ["root"] = d.Name, ["label"] = Launcher.DriveLabel(d) })
                .ToArray();

        private void OnWebMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            Dictionary<string, object> msg;
            try { msg = AppConfig.Json.DeserializeObject(e.WebMessageAsJson) as Dictionary<string, object>; }
            catch { return; }
            if (msg == null) return;

            string cmd = AppConfig.Str(msg, "cmd");
            try
            {
                switch (cmd)
                {
                    case "ready": SendConfig(); break;
                    case "launch": Launch(AppConfig.Str(msg, "id")); break;
                    case "search": Search(AppConfig.Str(msg, "q")); break;
                    case "keyboard": TouchKeyboard.Toggle(); break;
                    case "unlock": Unlock(AppConfig.Str(msg, "pin")); break;
                    case "lock": _adminUnlocked = false; _adminTimeout.Stop(); break;
                    case "admin": Admin(AppConfig.Str(msg, "action")); break;
                    case "windows": SendWindows(force: true); break;
                    case "board": Board(msg); break;
                    case "switch":
                        {
                            IntPtr h = KnownWindow(AppConfig.Str(msg, "id"));
                            if (h != IntPtr.Zero) WindowTracker.SwitchTo(h);
                            break;
                        }
                    case "closeWindow":
                        {
                            IntPtr h = KnownWindow(AppConfig.Str(msg, "id"));
                            if (h != IntPtr.Zero) WindowTracker.Close(h);
                            break;
                        }
                }
            }
            catch (Exception ex)
            {
                Log.Write("Command failed: " + cmd, ex);
                Send(new { type = "result", id = AppConfig.Str(msg, "id"), result = "error" });
            }
        }

        // ---------------------------------------------------------------- commands

        private void Launch(string id)
        {
            // A double tap on a slow board must not open PowerPoint twice.
            if (id == _lastLaunchId && (DateTime.Now - _lastLaunch).TotalSeconds < 2.5) return;
            _lastLaunchId = id;
            _lastLaunch = DateTime.Now;

            var item = _config.FindItem(id);
            if (item == null) { Send(new { type = "result", id, result = "notfound" }); return; }

            LaunchResult result;
            switch (AppConfig.Str(item, "type"))
            {
                case "usb": result = Launcher.OpenUsb(); break;
                case "keyboard": result = TouchKeyboard.Toggle() ? LaunchResult.Ok : LaunchResult.Error; break;
                case "url": result = Launcher.OpenUrl(AppConfig.Str(item, "url")) ? LaunchResult.Ok : LaunchResult.NotFound; break;
                default: result = Launcher.RunTargets(item); break;
            }
            Send(new { type = "result", id, result = result.ToString().ToLowerInvariant() });
        }

        private void Search(string q)
        {
            if (string.IsNullOrWhiteSpace(q)) return;
            string baseUrl = _config.GetString("searchUrl", "https://www.google.com/search?q=");
            Launcher.OpenUrl(baseUrl + Uri.EscapeDataString(q.Trim()));
        }

        private void Unlock(string pin)
        {
            string expected = _config.GetString("adminPin", "");
            bool ok = expected.Length > 0 && pin == expected;
            _adminUnlocked = ok;
            if (ok) { _adminTimeout.Stop(); _adminTimeout.Start(); }
            else Log.Write("Wrong supervisor PIN entered");
            Send(new { type = "unlock", ok });
        }

        private void Admin(string action)
        {
            if (!_adminUnlocked) { Send(new { type = "locked" }); return; }
            switch (action)
            {
                case "exit":
                    _allowClose = true;
                    _home?.Hide();
                    Taskbar.Restore();
                    ExitCode = Program.ExitCodeSupervisor;
                    Close();
                    break;
                case "reload":
                    _config = AppConfig.Load();
                    ApplyBounds();
                    ApplyShell();
                    SendConfig();
                    break;
                case "edit":
                    // config.json lives in Program Files, so Notepad asks for the admin password.
                    try
                    {
                        Process.Start(new ProcessStartInfo("notepad.exe", "\"" + AppConfig.FilePath + "\"")
                        { UseShellExecute = true, Verb = "runas" });
                    }
                    catch (Exception ex) { Log.Write("Could not open config for editing", ex); }
                    break;
                case "folder":
                    Launcher.OpenFolder(AppDomain.CurrentDomain.BaseDirectory);
                    break;
            }
        }

        // ---------------------------------------------------------------- whiteboard files

        /// <summary>Requests from board.html; every answer carries the request's id back.</summary>
        private void Board(Dictionary<string, object> msg)
        {
            string reqId = AppConfig.Str(msg, "reqId");
            object result;
            try
            {
                switch (AppConfig.Str(msg, "op"))
                {
                    case "save": result = BoardStorage.Save(AppConfig.Str(msg, "name"), AppConfig.Str(msg, "data"), AppConfig.Str(msg, "where")); break;
                    case "list": result = BoardStorage.List(); break;
                    case "load": result = BoardStorage.Load(AppConfig.Str(msg, "path")); break;
                    case "autosave": result = BoardStorage.Autosave(AppConfig.Str(msg, "data")); break;
                    case "restore": result = BoardStorage.Restore(); break;
                    case "images": result = BoardStorage.Images(); break;
                    case "image": result = BoardStorage.Image(AppConfig.Str(msg, "path")); break;
                    default: result = new { ok = false, error = "unknown" }; break;
                }
            }
            catch (Exception ex)
            {
                Log.Write("Board request failed", ex);
                result = new { ok = false, error = "failed" };
            }
            Send(new { type = "reply", reqId, result });
        }

        // ---------------------------------------------------------------- USB

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_DEVICECHANGE)
            {
                // Drives are often not readable the instant they arrive; wait a moment, then scan.
                _usbDebounce.Stop();
                _usbDebounce.Start();
            }
            base.WndProc(ref m);
        }

        private void ScanDrives(bool announce)
        {
            var now = Launcher.RemovableDrives();
            var names = new HashSet<string>(now.Select(d => d.Name), StringComparer.OrdinalIgnoreCase);
            var added = now.Where(d => !_knownDrives.Contains(d.Name)).ToList();
            bool changed = !names.SetEquals(_knownDrives);
            _knownDrives = names;
            if (!changed || !announce) return;

            bool autoOpen = _config.GetBool("usbAutoOpen", true);
            if (autoOpen) foreach (var d in added) Launcher.OpenFolder(d.RootDirectory.FullName);

            Send(new
            {
                type = "drives",
                drives = DriveList(),
                added = added.Select(d => (object)new Dictionary<string, object> { ["root"] = d.Name, ["label"] = Launcher.DriveLabel(d) }).ToArray(),
                opened = autoOpen && added.Count > 0,
            });
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _usbDebounce.Dispose();
                _usbPoll.Dispose();
                _adminTimeout.Dispose();
                _windowsPoll.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
