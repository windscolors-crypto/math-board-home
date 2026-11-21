using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;

namespace MathBoardHome
{
    internal enum LaunchResult { Ok, NotFound, NoUsb, Error }

    /// <summary>Starts whatever a tile points at.</summary>
    internal static class Launcher
    {
        /// <summary>
        /// "targets" is a list tried in order; the first one that exists and starts wins.
        /// Each entry is either a string ("powerpnt.exe", "ms-teams:", "C:\\...\\x.exe", a URL)
        /// or an object { "path": "...", "args": "..." }. Item-level "args" applies to string entries.
        /// </summary>
        public static LaunchResult RunTargets(Dictionary<string, object> item)
        {
            string defaultArgs = AppConfig.Str(item, "args");
            var targets = new List<KeyValuePair<string, string>>();

            if (item.TryGetValue("targets", out object raw) && raw is IEnumerable list && !(raw is string))
            {
                foreach (object t in list)
                {
                    if (t is string s) targets.Add(new KeyValuePair<string, string>(s, defaultArgs));
                    else if (t is Dictionary<string, object> d) targets.Add(new KeyValuePair<string, string>(AppConfig.Str(d, "path"), AppConfig.Str(d, "args")));
                }
            }
            else if (raw is string single)
            {
                targets.Add(new KeyValuePair<string, string>(single, defaultArgs));
            }

            foreach (var t in targets)
            {
                if (TryStart(t.Key, t.Value)) return LaunchResult.Ok;
            }
            return LaunchResult.NotFound;
        }

        public static bool TryStart(string target, string args)
        {
            // "__BOARD_PROGRAM__"-style placeholders are left by the installer when nothing was chosen.
            if (string.IsNullOrWhiteSpace(target) || target.StartsWith("__")) return false;
            string path = Environment.ExpandEnvironmentVariables(target.Trim());
            bool isPath = LooksLikePath(path);
            if (isPath && !File.Exists(path) && !Directory.Exists(path)) return false;

            try
            {
                var psi = new ProcessStartInfo(path)
                {
                    UseShellExecute = true,
                    Arguments = Environment.ExpandEnvironmentVariables(args ?? ""),
                };
                if (isPath && File.Exists(path)) psi.WorkingDirectory = Path.GetDirectoryName(path);
                Process.Start(psi);
                Log.Write($"Started: {path} {args}");
                return true;
            }
            catch (Win32Exception ex)
            {
                // not installed / no handler for this protocol: try the next target
                Log.Write($"Could not start {path}: {ex.Message}");
                return false;
            }
            catch (Exception ex)
            {
                Log.Write($"Could not start {path}", ex);
                return false;
            }
        }

        public static bool OpenUrl(string url)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out Uri uri)) return false;
            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return false;
            return TryStart(uri.AbsoluteUri, "");
        }

        /// <summary>Removable drives (USB flash disks, SD cards) that are ready to read.</summary>
        public static List<DriveInfo> RemovableDrives()
        {
            try
            {
                return DriveInfo.GetDrives()
                    .Where(d => d.DriveType == DriveType.Removable && SafeIsReady(d))
                    .OrderBy(d => d.Name)
                    .ToList();
            }
            catch (Exception ex)
            {
                Log.Write("Drive scan failed", ex);
                return new List<DriveInfo>();
            }
        }

        private static bool SafeIsReady(DriveInfo d)
        {
            try { return d.IsReady; } catch { return false; }
        }

        public static string DriveLabel(DriveInfo d)
        {
            try { return string.IsNullOrWhiteSpace(d.VolumeLabel) ? "" : d.VolumeLabel; } catch { return ""; }
        }

        public static void OpenFolder(string path) => TryStart("explorer.exe", "\"" + path + "\"");

        /// <summary>Opens the newest flash drive, or "This PC" when none is plugged in.</summary>
        public static LaunchResult OpenUsb()
        {
            var drives = RemovableDrives();
            if (drives.Count == 0)
            {
                TryStart("explorer.exe", "shell:MyComputerFolder");
                return LaunchResult.NoUsb;
            }
            foreach (var d in drives) OpenFolder(d.RootDirectory.FullName);
            return LaunchResult.Ok;
        }

        private static bool LooksLikePath(string s) =>
            (s.Length > 2 && s[1] == ':' && (s[2] == '\\' || s[2] == '/')) || s.StartsWith(@"\\");
    }
}
