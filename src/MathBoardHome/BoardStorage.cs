using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Text;

namespace MathBoardHome
{
    /// <summary>
    /// Files for the built-in whiteboard: saved boards (in Documents\السبورة or on a flash
    /// drive), an autosave so a lesson is never lost, and pictures to insert from the flash
    /// drive or the usual picture folders. The page only ever gets paths this class listed.
    /// </summary>
    internal static class BoardStorage
    {
        public const string Extension = ".mboard";
        private const string FolderName = "السبورة";
        private static readonly string[] ImageExtensions = { ".jpg", ".jpeg", ".png", ".bmp", ".gif" };
        private static readonly HashSet<string> Listed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        public static string LocalFolder => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), FolderName);

        private static string AutosavePath => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MathBoardHome", "autosave" + Extension);

        private static IEnumerable<string> UsbFolders() =>
            Launcher.RemovableDrives().Select(d => Path.Combine(d.RootDirectory.FullName, FolderName));

        // ------------------------------------------------------------------ boards

        public static object Save(string name, string data, string where)
        {
            string folder;
            if (where == "usb")
            {
                folder = UsbFolders().FirstOrDefault();
                if (folder == null) return new { ok = false, error = "nousb" };
            }
            else folder = LocalFolder;

            Directory.CreateDirectory(folder);
            string file = Path.Combine(folder, SafeName(name) + Extension);
            File.WriteAllText(file, data, new UTF8Encoding(false));
            Listed.Add(file);
            return new { ok = true, path = file, name = Path.GetFileNameWithoutExtension(file), where };
        }

        public static object List()
        {
            var items = new List<object>();
            void Add(string folder, string where)
            {
                if (!Directory.Exists(folder)) return;
                foreach (var f in new DirectoryInfo(folder).GetFiles("*" + Extension).OrderByDescending(f => f.LastWriteTime).Take(200))
                {
                    Listed.Add(f.FullName);
                    items.Add(new Dictionary<string, object>
                    {
                        ["path"] = f.FullName,
                        ["name"] = Path.GetFileNameWithoutExtension(f.Name),
                        ["where"] = where,
                        ["date"] = f.LastWriteTime.ToString("yyyy-MM-dd HH:mm"),
                    });
                }
            }
            Add(LocalFolder, "local");
            foreach (string usb in UsbFolders()) Add(usb, "usb");
            return new { ok = true, items = items.ToArray(), usb = UsbFolders().Any() };
        }

        public static object Load(string path)
        {
            if (!Listed.Contains(path ?? "") || !File.Exists(path)) return new { ok = false, error = "notfound" };
            return new { ok = true, data = File.ReadAllText(path, Encoding.UTF8), name = Path.GetFileNameWithoutExtension(path) };
        }

        public static object Autosave(string data)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(AutosavePath));
            string tmp = AutosavePath + ".tmp";
            File.WriteAllText(tmp, data ?? "", new UTF8Encoding(false));
            if (File.Exists(AutosavePath)) File.Delete(AutosavePath);
            File.Move(tmp, AutosavePath);
            return new { ok = true };
        }

        public static object Restore()
        {
            if (!File.Exists(AutosavePath)) return new { ok = false };
            return new { ok = true, data = File.ReadAllText(AutosavePath, Encoding.UTF8), date = File.GetLastWriteTime(AutosavePath).ToString("yyyy-MM-dd HH:mm") };
        }

        private static string SafeName(string name)
        {
            name = (name ?? "").Trim();
            foreach (char c in Path.GetInvalidFileNameChars()) name = name.Replace(c, '-');
            if (name.Length == 0) name = "لوح " + DateTime.Now.ToString("yyyy-MM-dd HH-mm");
            return name.Length > 80 ? name.Substring(0, 80) : name;
        }

        // ------------------------------------------------------------------ pictures

        /// <summary>Newest pictures from flash drives, then Pictures, Downloads and Desktop, with small previews.</summary>
        public static object Images()
        {
            var roots = new List<KeyValuePair<string, string>>();
            foreach (var d in Launcher.RemovableDrives()) roots.Add(new KeyValuePair<string, string>(d.RootDirectory.FullName, "usb"));
            roots.Add(new KeyValuePair<string, string>(Environment.GetFolderPath(Environment.SpecialFolder.MyPictures), "pictures"));
            roots.Add(new KeyValuePair<string, string>(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads"), "downloads"));
            roots.Add(new KeyValuePair<string, string>(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "desktop"));

            var found = new List<Tuple<FileInfo, string>>();
            foreach (var root in roots)
            {
                if (!Directory.Exists(root.Key)) continue;
                foreach (var f in Walk(new DirectoryInfo(root.Key), 3).Take(400)) found.Add(Tuple.Create(f, root.Value));
            }

            var items = found
                .OrderBy(t => t.Item2 == "usb" ? 0 : 1)
                .ThenByDescending(t => t.Item1.LastWriteTime)
                .Take(48)
                .Select(t =>
                {
                    Listed.Add(t.Item1.FullName);
                    return (object)new Dictionary<string, object>
                    {
                        ["path"] = t.Item1.FullName,
                        ["name"] = t.Item1.Name,
                        ["where"] = t.Item2,
                        ["thumb"] = DataUrl(t.Item1.FullName, 220, 72L),
                    };
                })
                .Where(o => ((Dictionary<string, object>)o)["thumb"] != null)
                .ToArray();
            return new { ok = true, items };
        }

        public static object Image(string path)
        {
            if (!Listed.Contains(path ?? "") || !File.Exists(path)) return new { ok = false, error = "notfound" };
            string url = DataUrl(path, 1600, 88L);
            return url == null ? (object)new { ok = false, error = "unreadable" } : new { ok = true, data = url };
        }

        private static IEnumerable<FileInfo> Walk(DirectoryInfo dir, int depth)
        {
            FileInfo[] files;
            try { files = dir.GetFiles(); } catch { yield break; }
            foreach (var f in files)
                if (ImageExtensions.Contains(f.Extension.ToLowerInvariant()) && (f.Attributes & FileAttributes.Hidden) == 0)
                    yield return f;
            if (depth <= 0) yield break;
            DirectoryInfo[] subs;
            try { subs = dir.GetDirectories(); } catch { yield break; }
            foreach (var s in subs)
            {
                if ((s.Attributes & (FileAttributes.Hidden | FileAttributes.System)) != 0) continue;
                foreach (var f in Walk(s, depth - 1)) yield return f;
            }
        }

        /// <summary>Reads a picture, shrinks it to fit maxSide, and returns it as a data URL.</summary>
        private static string DataUrl(string path, int maxSide, long jpegQuality)
        {
            try
            {
                using (var src = System.Drawing.Image.FromFile(path))
                {
                    double k = Math.Min(1.0, (double)maxSide / Math.Max(src.Width, src.Height));
                    int w = Math.Max(1, (int)(src.Width * k)), h = Math.Max(1, (int)(src.Height * k));
                    bool keepAlpha = Path.GetExtension(path).Equals(".png", StringComparison.OrdinalIgnoreCase) && maxSide > 400;
                    using (var bmp = new Bitmap(w, h, keepAlpha ? PixelFormat.Format32bppArgb : PixelFormat.Format24bppRgb))
                    using (var g = Graphics.FromImage(bmp))
                    using (var ms = new MemoryStream())
                    {
                        if (!keepAlpha) g.Clear(Color.White);
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.DrawImage(src, 0, 0, w, h);
                        if (keepAlpha)
                        {
                            bmp.Save(ms, ImageFormat.Png);
                            return "data:image/png;base64," + Convert.ToBase64String(ms.ToArray());
                        }
                        var codec = ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);
                        var ps = new EncoderParameters(1);
                        ps.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, jpegQuality);
                        bmp.Save(ms, codec, ps);
                        return "data:image/jpeg;base64," + Convert.ToBase64String(ms.ToArray());
                    }
                }
            }
            catch (Exception ex)
            {
                Log.Write("Could not read picture " + path + ": " + ex.Message);
                return null;
            }
        }
    }
}
