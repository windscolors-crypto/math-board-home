using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace MathBoardHome
{
    /// <summary>
    /// Lists the programs a teacher has open (the same windows Alt+Tab shows) so the home
    /// screen can offer them as "open apps" cards, and switches to or closes one on request.
    /// </summary>
    internal static class WindowTracker
    {
        public sealed class OpenWindow
        {
            public IntPtr Handle;
            public string Title;
            public string Exe;
        }

        private static readonly Dictionary<string, string> IconCache = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private static readonly HashSet<string> HiddenClasses = new HashSet<string>(StringComparer.Ordinal)
        {
            "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd", "IPTip_Main_Window",
            "Windows.UI.Core.CoreWindow", "TopLevelWindowForOverflowXamlIsland", "XamlExplorerHostIslandWindow",
        };

        public static List<OpenWindow> List(IEnumerable<IntPtr> ownWindows)
        {
            var own = new HashSet<IntPtr>(ownWindows);
            var result = new List<OpenWindow>();
            EnumWindows((hwnd, _) =>
            {
                try
                {
                    if (own.Contains(hwnd) || !IsAltTabWindow(hwnd)) return true;
                    string title = GetTitle(hwnd);
                    if (string.IsNullOrWhiteSpace(title)) return true;
                    result.Add(new OpenWindow { Handle = hwnd, Title = title.Trim(), Exe = GetProcessPath(hwnd) });
                }
                catch (Exception ex)
                {
                    Log.Write("Window enumeration skipped a window: " + ex.Message);
                }
                return true;
            }, IntPtr.Zero);
            return result;
        }

        private static bool IsAltTabWindow(IntPtr hwnd)
        {
            if (!IsWindowVisible(hwnd)) return false;
            if (GetWindow(hwnd, GW_OWNER) != IntPtr.Zero) return false;
            long ex = GetWindowLongPtr(hwnd, GWL_EXSTYLE).ToInt64();
            if ((ex & WS_EX_TOOLWINDOW) != 0 && (ex & WS_EX_APPWINDOW) == 0) return false;
            if (DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, out int cloaked, sizeof(int)) == 0 && cloaked != 0) return false;
            var cls = new StringBuilder(256);
            GetClassName(hwnd, cls, cls.Capacity);
            return !HiddenClasses.Contains(cls.ToString());
        }

        private static string GetTitle(IntPtr hwnd)
        {
            int len = GetWindowTextLength(hwnd);
            if (len <= 0) return "";
            var sb = new StringBuilder(len + 1);
            GetWindowText(hwnd, sb, sb.Capacity);
            return sb.ToString();
        }

        private static string GetProcessPath(IntPtr hwnd)
        {
            GetWindowThreadProcessId(hwnd, out uint pid);
            IntPtr h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
            if (h == IntPtr.Zero) return "";
            try
            {
                var sb = new StringBuilder(1024);
                int size = sb.Capacity;
                return QueryFullProcessImageName(h, 0, sb, ref size) ? sb.ToString() : "";
            }
            finally { CloseHandle(h); }
        }

        /// <summary>The program's icon as a PNG data URL, cached per exe.</summary>
        public static string IconDataUrl(string exe)
        {
            if (string.IsNullOrEmpty(exe) || !File.Exists(exe)) return null;
            if (IconCache.TryGetValue(exe, out string cached)) return cached;
            string url = null;
            try
            {
                using (Icon icon = Icon.ExtractAssociatedIcon(exe))
                using (Bitmap bmp = icon.ToBitmap())
                using (var ms = new MemoryStream())
                {
                    bmp.Save(ms, ImageFormat.Png);
                    url = "data:image/png;base64," + Convert.ToBase64String(ms.ToArray());
                }
            }
            catch (Exception ex) { Log.Write("No icon for " + exe + ": " + ex.Message); }
            IconCache[exe] = url;
            return url;
        }

        public static void SwitchTo(IntPtr hwnd)
        {
            if (IsIconic(hwnd)) ShowWindow(hwnd, SW_RESTORE);
            SetForegroundWindow(hwnd);
        }

        /// <summary>Asks the program to close, in front, so any "save changes?" question is visible.</summary>
        public static void Close(IntPtr hwnd)
        {
            SwitchTo(hwnd);
            PostMessage(hwnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
        }

        // ------------------------------------------------------------------ Win32

        private const int GW_OWNER = 4;
        private const int GWL_EXSTYLE = -20;
        private const long WS_EX_TOOLWINDOW = 0x00000080;
        private const long WS_EX_APPWINDOW = 0x00040000;
        private const int DWMWA_CLOAKED = 14;
        private const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
        private const int SW_RESTORE = 9;
        private const uint WM_CLOSE = 0x0010;

        private delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

        [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
        [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hwnd);
        [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr hwnd);
        [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr hwnd, int cmd);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] private static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr hwnd, StringBuilder sb, int max);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr hwnd, StringBuilder sb, int max);
        [DllImport("user32.dll")] private static extern int GetWindowTextLength(IntPtr hwnd);
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
        [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hwnd, int cmd);
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
        [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr hwnd, uint msg, IntPtr w, IntPtr l);
        [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out int value, int size);
        [DllImport("kernel32.dll")] private static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
        [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr h);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern bool QueryFullProcessImageName(IntPtr h, int flags, StringBuilder sb, ref int size);
    }
}
