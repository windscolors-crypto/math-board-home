using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

namespace MathBoardHome
{
    /// <summary>
    /// Reads config.json (next to the exe). The file is kept as a loose dictionary so the
    /// web page receives everything it contains and new fields need no code change here.
    /// </summary>
    internal sealed class AppConfig
    {
        public static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 8 * 1024 * 1024 };

        public Dictionary<string, object> Root { get; private set; } = new Dictionary<string, object>();
        public string LoadError { get; private set; }

        public static string FilePath => Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");

        public static AppConfig Load()
        {
            var cfg = new AppConfig();
            try
            {
                string text = File.ReadAllText(FilePath, Encoding.UTF8);
                if (Json.DeserializeObject(text) is Dictionary<string, object> root) cfg.Root = root;
                else cfg.LoadError = "config.json must contain a JSON object.";
            }
            catch (Exception ex)
            {
                cfg.LoadError = ex.Message;
                Log.Write("Could not read config.json", ex);
            }
            return cfg;
        }

        public string GetString(string key, string fallback = "") =>
            Root.TryGetValue(key, out object v) && v != null ? Convert.ToString(v) : fallback;

        public bool GetBool(string key, bool fallback) =>
            Root.TryGetValue(key, out object v) && v is bool b ? b : fallback;

        /// <summary>The settings sent to the web page (the supervisor PIN is never sent).</summary>
        public Dictionary<string, object> ForWeb()
        {
            var copy = new Dictionary<string, object>(Root);
            copy.Remove("adminPin");
            return copy;
        }

        /// <summary>Finds an app or a group item by its "id", searching nested "items" lists too.</summary>
        public Dictionary<string, object> FindItem(string id)
        {
            return Root.TryGetValue("apps", out object apps) ? Find(apps as IEnumerable, id) : null;
        }

        private static Dictionary<string, object> Find(IEnumerable list, string id)
        {
            if (list == null || string.IsNullOrEmpty(id)) return null;
            foreach (object o in list)
            {
                if (!(o is Dictionary<string, object> item)) continue;
                if (item.TryGetValue("id", out object v) && string.Equals(Convert.ToString(v), id, StringComparison.OrdinalIgnoreCase))
                    return item;
                if (item.TryGetValue("items", out object children))
                {
                    var hit = Find(children as IEnumerable, id);
                    if (hit != null) return hit;
                }
            }
            return null;
        }

        public static string Str(Dictionary<string, object> d, string key) =>
            d != null && d.TryGetValue(key, out object v) && v != null ? Convert.ToString(v) : "";
    }
}
