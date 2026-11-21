using System;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace MathBoardHome
{
    internal static class Program
    {
        /// <summary>Exit code used when the supervisor leaves to the desktop on purpose.</summary>
        public const int ExitCodeSupervisor = 10;

        [STAThread]
        private static int Main()
        {
            using (var mutex = new Mutex(true, @"Local\MathBoardHome.SingleInstance", out bool isFirst))
            {
                if (!isFirst) return 0; // already running for this user

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
                Application.ThreadException += (s, e) => Log.Write("UI exception", e.Exception);
                AppDomain.CurrentDomain.UnhandledException += (s, e) => Log.Write("Fatal exception", e.ExceptionObject as Exception);

                var form = new MainForm();
                Application.Run(form);
                return form.ExitCode;
            }
        }
    }

    internal static class Log
    {
        private static readonly string Dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MathBoardHome");

        public static string FilePath => Path.Combine(Dir, "log.txt");

        public static void Write(string message, Exception ex = null)
        {
            try
            {
                Directory.CreateDirectory(Dir);
                var fi = new FileInfo(FilePath);
                if (fi.Exists && fi.Length > 512 * 1024) fi.Delete();
                File.AppendAllText(FilePath,
                    $"{DateTime.Now:yyyy-MM-dd HH:mm:ss}  {message}{(ex != null ? Environment.NewLine + ex : "")}{Environment.NewLine}");
            }
            catch
            {
                // logging must never crash the home screen
            }
        }
    }
}
