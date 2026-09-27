Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Image]::FromFile((Resolve-Path "desktop/icon.png").Path)
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngDataList = @()

foreach ($sz in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($source, 0, 0, $sz, $sz)
    $g.Dispose()
    
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $pngDataList += ,@($sz, $ms.ToArray())
    $ms.Dispose()
}
$source.Dispose()

$targetPath = (Resolve-Path "desktop/icon.ico").Path
$fs = [System.IO.File]::Create($targetPath)
$bw = New-Object System.IO.BinaryWriter($fs)

# Header
$bw.Write([uint16]0) # Reserved
$bw.Write([uint16]1) # Type 1 = ICO
$bw.Write([uint16]$sizes.Length) # Image count

$offset = 6 + ($sizes.Length * 16)

# Directory entries
foreach ($item in $pngDataList) {
    $sz = $item[0]
    $data = $item[1]
    
    $bw.Write([byte]$(if ($sz -eq 256) { 0 } else { $sz })) # Width
    $bw.Write([byte]$(if ($sz -eq 256) { 0 } else { $sz })) # Height
    $bw.Write([byte]0) # Colors
    $bw.Write([byte]0) # Reserved
    $bw.Write([uint16]1) # Planes
    $bw.Write([uint16]32) # BPP
    $bw.Write([uint32]$data.Length) # Bytes in resource
    $bw.Write([uint32]$offset) # Offset
    $offset += $data.Length
}

# Image data
foreach ($item in $pngDataList) {
    $bw.Write($item[1])
}

$bw.Close()
$fs.Close()
Write-Host "Generated multi-resolution desktop/icon.ico with $($sizes.Length) sizes."
