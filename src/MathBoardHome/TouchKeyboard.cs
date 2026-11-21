using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

namespace MathBoardHome
{
    /// <summary>
    /// Shows the Windows touch keyboard. Simply starting TabTip.exe is unreliable on
    /// Windows 10/11 (the cause of "the keyboard sometimes doesn't appear"), so this asks the
    /// running keyboard host to toggle through its COM interface, then falls back to osk.exe.
    /// </summary>
    internal static class TouchKeyboard
    {
        [ComImport, Guid("4ce576fa-83dc-4F88-951c-9d0782b4e376")]
        private class UIHostNoLaunch { }

        [ComImport, Guid("37c994e7-432b-4834-a2f7-dce1f13b834b")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface ITipInvocation
        {
            void Toggle(IntPtr hwnd);
        }

        [DllImport("user32.dll")]
        private static extern IntPtr GetDesktopWindow();

        private static string TabTipPath => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonProgramFiles),
            @"microsoft shared\ink\TabTip.exe");

        public static bool Toggle()
        {
            for (int attempt = 0; attempt < 2; attempt++)
            {
                try
                {
                    var tip = (ITipInvocation)new UIHostNoLaunch();
                    tip.Toggle(GetDesktopWindow());
                    Marshal.ReleaseComObject(tip);
                    return true;
                }
                catch (Exception ex)
                {
                    Log.Write($"Touch keyboard toggle failed (attempt {attempt + 1}): {ex.Message}");
                    // The host isn't running yet: start it, give it a moment, then try once more.
                    if (attempt == 0 && File.Exists(TabTipPath))
                    {
                        try { Process.Start(new ProcessStartInfo(TabTipPath) { UseShellExecute = true }); } catch { }
                        Thread.Sleep(600);
                    }
                }
            }

            // Last resort: the classic on-screen keyboard, which always opens.
            return Launcher.TryStart(Path.Combine(Environment.SystemDirectory, "osk.exe"), "");
        }
    }
}
