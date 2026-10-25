Add-Type -AssemblyName System.Drawing

function Generate-Icon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $g.Clear([System.Drawing.Color]::Transparent)

    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 108, 92, 231),
        [System.Drawing.Color]::FromArgb(255, 72, 52, 212),
        45.0
    )
    $g.FillEllipse($brush, 4, 4, $size - 8, $size - 8)

    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $scale = $size / 128.0

    $pinHeadR = 20.0 * $scale
    $cx = [float]($size / 2.0)
    $cy = [float](46.0 * $scale)
    $g.FillEllipse($whiteBrush, [float]($cx - $pinHeadR), [float]($cy - $pinHeadR), [float]($pinHeadR * 2), [float]($pinHeadR * 2))

    $pts = @(
        (New-Object System.Drawing.PointF([float]($cx - $pinHeadR + 2 * $scale), [float]$cy)),
        (New-Object System.Drawing.PointF([float]($cx + $pinHeadR - 2 * $scale), [float]$cy)),
        (New-Object System.Drawing.PointF([float]$cx, [float](90.0 * $scale)))
    )
    $g.FillPolygon($whiteBrush, $pts)

    $cutoutR = 8.5 * $scale
    $cutoutBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 80, 60, 220))
    $g.FillEllipse($cutoutBrush, [float]($cx - $cutoutR), [float]($cy - $cutoutR), [float]($cutoutR * 2), [float]($cutoutR * 2))

    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Saved: $path"
}

$iconsDir = "C:\Users\Arnav\Desktop\Nostalgic Map\icons"
if (-not (Test-Path $iconsDir)) { New-Item -ItemType Directory -Path $iconsDir -Force }
Generate-Icon 192 (Join-Path $iconsDir "icon-192.png")
Generate-Icon 512 (Join-Path $iconsDir "icon-512.png")
