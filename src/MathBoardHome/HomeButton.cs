using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace MathBoardHome
{
    /// <summary>
    /// A small round "home" button that floats above every program, like the home button on
    /// an Android tablet. One tap brings the home screen to the front; programs stay open.
    /// It hides itself while the home screen is already in front.
    /// </summary>
    internal sealed class HomeButton : Form
    {
        private const int WS_EX_TOOLWINDOW = 0x00000080;
        private const int WS_EX_NOACTIVATE = 0x08000000;
        private const int WS_EX_TOPMOST = 0x00000008;

        private readonly Action _onTap;
        private readonly string _corner;
        private readonly Timer _keepOnTop = new Timer { Interval = 2500 };
        private bool _pressed;

        public HomeButton(Action onTap, string corner, int sizeDip)
        {
            _onTap = onTap;
            _corner = string.IsNullOrEmpty(corner) ? "bottom-left" : corner;

            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;
            BackColor = Color.FromArgb(0x16, 0x2F, 0x45);
            DoubleBuffered = true;
            Text = "الرئيسية";

            float scale = DeviceDpi / 96f;
            int size = (int)Math.Round(Math.Max(48, sizeDip) * scale);
            ClientSize = new Size(size, size);
            using (var path = new GraphicsPath())
            {
                path.AddEllipse(0, 0, size, size);
                Region = new Region(path);
            }
            PlaceOnScreen();

            MouseDown += (s, e) => { _pressed = true; Invalidate(); };
            MouseUp += (s, e) => { if (_pressed) { _pressed = false; Invalidate(); _onTap(); } };
            MouseLeave += (s, e) => { _pressed = false; Invalidate(); };
            _keepOnTop.Tick += (s, e) => { if (Visible) SetWindowPos(Handle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE); };
            _keepOnTop.Start();
            Microsoft.Win32.SystemEvents.DisplaySettingsChanged += (s, e) => BeginInvoke((Action)PlaceOnScreen);
        }

        protected override bool ShowWithoutActivation => true;

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.ExStyle |= WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TOPMOST;
                return cp;
            }
        }

        private void PlaceOnScreen()
        {
            Rectangle area = Screen.PrimaryScreen.Bounds;
            int margin = (int)(24 * DeviceDpi / 96f);
            int x = _corner.Contains("right") ? area.Right - Width - margin
                  : _corner.Contains("center") ? area.Left + (area.Width - Width) / 2
                  : area.Left + margin;
            int y = _corner.Contains("top") ? area.Top + margin
                  : _corner.Contains("middle") ? area.Top + (area.Height - Height) / 2
                  : area.Bottom - Height - margin;
            Location = new Point(x, y);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            int s = ClientSize.Width;
            using (var fill = new SolidBrush(_pressed ? Color.FromArgb(0x2E, 0x7D, 0x57) : Color.FromArgb(0x1E, 0x4A, 0x66)))
                g.FillEllipse(fill, 0, 0, s - 1, s - 1);
            using (var ring = new Pen(Color.FromArgb(230, 255, 255, 255), Math.Max(2f, s / 22f)))
                g.DrawEllipse(ring, s * .06f, s * .06f, s * .88f, s * .88f);

            // house: roof and body drawn as one white outline
            float u = s / 100f;
            var pts = new[]
            {
                new PointF(30 * u, 50 * u), new PointF(50 * u, 31 * u), new PointF(70 * u, 50 * u),
                new PointF(70 * u, 69 * u), new PointF(30 * u, 69 * u), new PointF(30 * u, 50 * u),
            };
            using (var pen = new Pen(Color.White, 6 * u) { LineJoin = LineJoin.Round, StartCap = LineCap.Round, EndCap = LineCap.Round })
                g.DrawLines(pen, pts);
            using (var door = new SolidBrush(Color.FromArgb(0xF2, 0xB6, 0x30)))
                g.FillRectangle(door, 45 * u, 56 * u, 10 * u, 13 * u);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) _keepOnTop.Dispose();
            base.Dispose(disposing);
        }

        private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        private const uint SWP_NOSIZE = 0x0001, SWP_NOMOVE = 0x0002, SWP_NOACTIVATE = 0x0010;

        [DllImport("user32.dll")]
        private static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
    }
}
