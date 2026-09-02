# Taps a point on the emulated watch screen.
#
# Posting WM_LBUTTONDOWN/UP to the window does NOT work: QEMU does not take its
# input from the window message queue that way, and the click is silently
# dropped. So this drives the real mouse, and keeps the disruption to a minimum:
#
#   - the window is raised with SetWindowPos(HWND_TOPMOST) and SWP_NOACTIVATE,
#     which puts it above everything without stealing keyboard focus;
#   - the cursor position is saved and put back afterwards;
#   - the window is dropped out of topmost again when the click is done.
#
# Coordinates are given in WATCH pixels (0..Dev) and converted to screen pixels.
param(
  [Parameter(Mandatory = $true)][int]$X,
  [Parameter(Mandatory = $true)][int]$Y,
  [int]$Dev = 466,
  [string]$Match = "Zepp OS Simulator",
  [int]$HoldMs = 80,
  [switch]$KeepOnTop,
  # Put the pointer back where it was. Off by default: QEMU tracks the pointer,
  # and yanking it out of the window after every click makes the next one land on
  # a window it no longer thinks the mouse is over - which is why a batch of taps
  # used to register only the first.
  [switch]$RestoreCursor
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Tap {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RC r);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, IntPtr extra);
  public struct RC { public int L, T, R, B; }

  public static IntPtr Find(string needle) {
    IntPtr found = IntPtr.Zero;
    EnumWindows(delegate(IntPtr h, IntPtr p) {
      int n = GetWindowTextLength(h);
      if (n == 0) return true;
      StringBuilder sb = new StringBuilder(n + 1);
      GetWindowText(h, sb, sb.Capacity);
      if (sb.ToString().IndexOf(needle, StringComparison.OrdinalIgnoreCase) >= 0) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@

$hwnd = [Tap]::Find($Match)
if ($hwnd -eq [IntPtr]::Zero) { throw "no window titled like '$Match'" }

$HWND_TOPMOST = [IntPtr](-1)
$HWND_NOTOPMOST = [IntPtr](-2)
$SWP_NOMOVE = 0x0002
$SWP_NOSIZE = 0x0001
$SWP_NOACTIVATE = 0x0010
$SW_SHOWNOACTIVATE = 4

if (-not [Tap]::IsWindowVisible($hwnd)) { [void][Tap]::ShowWindow($hwnd, $SW_SHOWNOACTIVATE) }
[void][Tap]::SetWindowPos($hwnd, $HWND_TOPMOST, 0, 0, 0, 0, ($SWP_NOMOVE -bor $SWP_NOSIZE -bor $SWP_NOACTIVATE))
Start-Sleep -Milliseconds 150

$r = New-Object Tap+RC
[void][Tap]::GetWindowRect($hwnd, [ref]$r)
$w = $r.R - $r.L
$h = $r.B - $r.T
$border = 8
$screenX = $r.L + [int](($w - $Dev) / 2) + $X
$screenY = $r.T + ($h - $border - $Dev) + $Y

$before = [System.Windows.Forms.Cursor]::Position
# Approach in two steps so the window sees motion arriving, not a teleport: a
# single jump can be swallowed, leaving the click with no pointer to belong to.
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point ($screenX - 12), ($screenY - 12)
Start-Sleep -Milliseconds 120
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point $screenX, $screenY
Start-Sleep -Milliseconds 200

$MOUSEEVENTF_LEFTDOWN = 0x0002
$MOUSEEVENTF_LEFTUP = 0x0004
[Tap]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds $HoldMs
[Tap]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 300

if ($RestoreCursor) {
  [System.Windows.Forms.Cursor]::Position = $before
}
if (-not $KeepOnTop) {
  [void][Tap]::SetWindowPos($hwnd, $HWND_NOTOPMOST, 0, 0, 0, 0, ($SWP_NOMOVE -bor $SWP_NOSIZE -bor $SWP_NOACTIVATE))
}

[pscustomobject]@{ Watch = "$X,$Y"; Screen = "$screenX,$screenY"; Clicked = $true }
