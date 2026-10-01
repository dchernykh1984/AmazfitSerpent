# Makes a store screenshot's background transparent, which is what the Zepp store
# requires: "The background of screenshots should be transparent and not have a
# fill color". A capture taken from the emulator carries that device's backdrop
# instead, and a reviewer rejects it ("please remove the four corners").
#
# The shape is passed in rather than guessed. Guessing from pixels fails exactly
# where it matters: when the backdrop happens to be the same colour as the
# interface (black on black), no probe can tell the two apart. app.json says
# whether a build targets round or square screens, and that is the truth.
#
#   round    - the disc is inscribed in the square and touches all four edges, so
#              everything outside the circle goes.
#   portrait - a square device's screen is a portrait rectangle centred with equal
#              margins left and right; those margins go and nothing else does.
#
# Before writing anything it counts how many pixels that are NOT the backdrop
# would be discarded. If the shape were wrong, that count is large and the file is
# left alone - a mask that eats the picture is worse than one that never ran.
#
# The round cut is a texture-brushed ellipse rather than a clipping region: GDI+
# clip regions have hard edges, while FillEllipse with anti-aliasing leaves a
# clean rim instead of a staircase.
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [Parameter(Mandatory = $true)][ValidateSet("round", "portrait")][string]$Shape,
  # Portrait only: the device's screen aspect, e.g. 390x450. The band is derived
  # from it because a scan cannot tell the app's own black background from the
  # black backdrop around it - it would crop to the text and lose both the screen
  # edge and the equal margins the store asks for.
  [int]$DeviceWidth = 390,
  [int]$DeviceHeight = 450,
  [switch]$WhatIfOnly
)

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile($Path)
$w = $src.Width
$h = $src.Height
$name = Split-Path $Path -Leaf

function Result($shape, $action, $lost) {
  return [pscustomobject]@{ File = $name; Shape = $shape; Lost = $lost; Action = $action }
}

function Same($a, $b) {
  return ([math]::Abs($a.R - $b.R) -le 10 -and [math]::Abs($a.G - $b.G) -le 10 -and
          [math]::Abs($a.B - $b.B) -le 10)
}

$corners = @($src.GetPixel(0, 0), $src.GetPixel($w - 1, 0), $src.GetPixel(0, $h - 1),
             $src.GetPixel($w - 1, $h - 1))
if (($corners | Where-Object { $_.A -eq 0 }).Count -eq 4) {
  $src.Dispose()
  return Result "-" "already transparent" "-"
}
$bg = $corners[0]

# Where the keep-region is.
$cx = ($w - 1) / 2.0
$cy = ($h - 1) / 2.0
$rx = ($w - 1) / 2.0
$ry = ($h - 1) / 2.0
$left = 0
$right = $w - 1
if ($Shape -eq "portrait") {
  $bandWidth = [int][math]::Round($h * $DeviceWidth / $DeviceHeight)
  if ($bandWidth -ge $w) {
    $left = 0
    $right = $w - 1
  } else {
    $left = [int][math]::Floor(($w - $bandWidth) / 2)
    $right = $left + $bandWidth - 1
  }
}

function Outside($x, $y) {
  if ($Shape -eq "round") {
    $dx = ($x - $cx) / $rx
    $dy = ($y - $cy) / $ry
    return ($dx * $dx + $dy * $dy) -gt 1.0
  }
  return ($x -lt $left -or $x -gt $right)
}

# Is what gets cut actually backdrop? Measured as flatness of the four corner
# blocks, not as "does it equal one reference pixel". Content that legitimately
# reaches the edge of the screen - a status line at the very top - would fail the
# second test while being none of the program's business; a corner that is not
# uniform means the shape is wrong and the cut would eat the picture.
#
# The outermost rim is skipped: a capture often carries a pixel or two of the
# window's own border there.
$flat = 0
$blocks = @(@(2, 2), @(($w - 18), 2), @(2, ($h - 18)), @(($w - 18), ($h - 18)))
$sumR = 0.0
$sumG = 0.0
$sumB = 0.0
$count = 0
foreach ($blk in $blocks) {
  for ($y = [int]$blk[1]; $y -lt [int]$blk[1] + 16; $y += 2) {
    for ($x = [int]$blk[0]; $x -lt [int]$blk[0] + 16; $x += 2) {
      $p = $src.GetPixel($x, $y)
      $sumR += $p.R
      $sumG += $p.G
      $sumB += $p.B
      $count++
    }
  }
}
if ($count -eq 0) {
  $src.Dispose()
  return Result $Shape "SKIPPED - image too small to sample" "-"
}
$meanR = $sumR / $count
$meanG = $sumG / $count
$meanB = $sumB / $count
foreach ($blk in $blocks) {
  for ($y = [int]$blk[1]; $y -lt [int]$blk[1] + 16; $y += 2) {
    for ($x = [int]$blk[0]; $x -lt [int]$blk[0] + 16; $x += 2) {
      $p = $src.GetPixel($x, $y)
      $dr = [math]::Abs($p.R - $meanR)
      $dg = [math]::Abs($p.G - $meanG)
      $db = [math]::Abs($p.B - $meanB)
      $d = [math]::Max($dr, [math]::Max($dg, $db))
      if ($d -gt $flat) { $flat = [int]$d }
    }
  }
}

if ($flat -gt 12) {
  $src.Dispose()
  return Result $Shape "REFUSED - corners are not flat backdrop (spread $flat)" "spread $flat"
}
$pct = "flat $flat"

if ($WhatIfOnly) {
  $src.Dispose()
  return Result $Shape "would mask" "$pct%"
}

# Keep the untouched original beside the file, once.
$backupDir = Join-Path (Split-Path $Path -Parent) "unmasked"
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }
$backup = Join-Path $backupDir $name
if (-not (Test-Path $backup)) { $src.Save($backup, [System.Drawing.Imaging.ImageFormat]::Png) }

$dst = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($dst)
$g.Clear([System.Drawing.Color]::Transparent)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

if ($Shape -eq "round") {
  $brush = New-Object System.Drawing.TextureBrush($src)
  $g.FillEllipse($brush, 0, 0, $w, $h)
  $brush.Dispose()
  $detail = "disc kept, corners cleared"
} else {
  $box = New-Object System.Drawing.Rectangle $left, 0, ($right - $left + 1), $h
  $g.DrawImage($src, $box, $box, [System.Drawing.GraphicsUnit]::Pixel)
  $detail = "kept x $left..$right, side margins cleared"
}

$g.Dispose()
$src.Dispose()

$tmp = [System.IO.Path]::GetTempFileName() + ".png"
$dst.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose()
Move-Item -Force $tmp $Path

return Result $Shape $detail "$pct%"
