# Captures the Zepp OS simulator's watch screen from a background process.
#
# Three things make the obvious approach fail, and each has a fix:
#
# 1. The emulator window can be HIDDEN (ShowWindow SW_HIDE) rather than merely
#    covered - it keeps a valid size and position while not being on screen at
#    all. Enumerating only visible windows therefore finds nothing, and reading
#    the desktop at its coordinates returns whatever is there instead.
#    Fix: enumerate every top-level window and match the title.
# 2. A background process may not call SetForegroundWindow. It MAY call
#    ShowWindow, so the window is shown with SW_SHOWNOACTIVATE - it appears
#    without stealing focus from whatever is being typed into.
# 3. CopyFromScreen reads the desktop, so anything on top wins. PrintWindow asks
#    the window to render itself instead, and PW_RENDERFULLCONTENT (2) is the
#    flag that also captures GPU-composited surfaces like QEMU's.
param(
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$Dev = 466,
  [string]$Match = "Zepp OS Simulator"
)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Shot {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RC r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
  public struct RC { public int L, T, R, B; }

  // Every top-level window, visible or not - a hidden window is exactly the case
  // that has to be handled here.
  public static IntPtr Find(string needle) {
    IntPtr found = IntPtr.Zero;
    EnumWindows(delegate(IntPtr h, IntPtr p) {
      int n = GetWindowTextLength(h);
      if (n == 0) return true;
      StringBuilder sb = new StringBuilder(n + 1);
      GetWindowText(h, sb, sb.Capacity);
      if (sb.ToString().IndexOf(needle, StringComparison.OrdinalIgnoreCase) >= 0) {
        found = h;
        return false;
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@

$hwnd = [Shot]::Find($Match)
if ($hwnd -eq [IntPtr]::Zero) { throw "no window titled like '$Match' - is the emulator running?" }

$SW_SHOWNOACTIVATE = 4
$SW_RESTORE = 9
$wasHidden = -not [Shot]::IsWindowVisible($hwnd)
if ([Shot]::IsIconic($hwnd)) { [void][Shot]::ShowWindow($hwnd, $SW_RESTORE) }
if ($wasHidden) { [void][Shot]::ShowWindow($hwnd, $SW_SHOWNOACTIVATE) }
if ($wasHidden -or [Shot]::IsIconic($hwnd)) { Start-Sleep -Milliseconds 500 }

$r = New-Object Shot+RC
[void][Shot]::GetWindowRect($hwnd, [ref]$r)
$w = $r.R - $r.L
$h = $r.B - $r.T
if ($w -le 1 -or $h -le 1) { throw "window has no size (${w}x${h})" }

$full = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($full)
$hdc = $g.GetHdc()
$printed = [Shot]::PrintWindow($hwnd, $hdc, 2)
$g.ReleaseHdc($hdc)
$g.Dispose()

# The device screen is drawn 1:1, centred horizontally, just above the window's
# bottom border.
$border = 8
$cx = [int](($w - $Dev) / 2)
$cy = $h - $border - $Dev
if ($cx -lt 0 -or $cy -lt 0) { $full.Dispose(); throw "window ${w}x${h} too small for a ${Dev}px screen" }

$dst = New-Object System.Drawing.Bitmap $Dev, $Dev, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g2 = [System.Drawing.Graphics]::FromImage($dst)
$box = New-Object System.Drawing.Rectangle 0, 0, $Dev, $Dev
$g2.DrawImage($full, $box, $cx, $cy, $Dev, $Dev, [System.Drawing.GraphicsUnit]::Pixel)
$g2.Dispose()
$full.Dispose()
$dst.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)

# A blank capture is one flat colour; a real one is not.
$seen = @{}
for ($y = 20; $y -lt $Dev - 20; $y += 40) {
  for ($x = 20; $x -lt $Dev - 20; $x += 40) {
    $p = $dst.GetPixel($x, $y)
    $seen["$($p.R),$($p.G),$($p.B)"] = 1
  }
}
$dst.Dispose()

[pscustomobject]@{
  Window  = "${w}x${h}"
  Hidden  = $wasHidden
  Print   = $printed
  Shades  = $seen.Count
  Verdict = if ($seen.Count -gt 2) { "GOT A PICTURE" } else { "blank" }
}
