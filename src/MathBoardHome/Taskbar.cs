using System;
using System.Runtime.InteropServices;

namespace MathBoardHome
{
    /// <summary>
    /// Switches the Windows taskbar to auto-hide while the home screen runs, so teachers see
    /// the floating home button instead of the Windows taskbar. The previous setting is put
    /// back when the supervisor leaves to the desktop.
    /// </summary>
    internal static class Taskbar
    {
        private const uint ABM_GETSTATE = 0x4;
        private const uint ABM_SETSTATE = 0xA;
        private const int ABS_AUTOHIDE = 0x1;

        private static int? _original;

        public static void AutoHide(bool on)
        {
            try
            {
                var data = new APPBARDATA { cbSize = Marshal.SizeOf(typeof(APPBARDATA)), hWnd = FindWindow("Shell_TrayWnd", null) };
                int state = (int)SHAppBarMessage(ABM_GETSTATE, ref data).ToInt64();
                if (_original == null) _original = state;
                int wanted = on ? (state | ABS_AUTOHIDE) : (state & ~ABS_AUTOHIDE);
                if (wanted == state) return;
                data.lParam = (IntPtr)wanted;
                SHAppBarMessage(ABM_SETSTATE, ref data);
            }
            catch (Exception ex)
            {
                Log.Write("Could not change taskbar auto-hide", ex);
            }
        }

        public static void Restore()
        {
            if (_original == null) return;
            bool wasAutoHide = (_original.Value & ABS_AUTOHIDE) != 0;
            AutoHide(wasAutoHide);
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct APPBARDATA
        {
            public int cbSize;
            public IntPtr hWnd;
            public uint uCallbackMessage;
            public uint uEdge;
            public RECT rc;
            public IntPtr lParam;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT { public int left, top, right, bottom; }

        [DllImport("shell32.dll")]
        private static extern IntPtr SHAppBarMessage(uint msg, ref APPBARDATA data);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr FindWindow(string cls, string title);
    }
}
