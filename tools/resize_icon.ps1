param (
    [string]$SourceFile,
    [string]$OutputDir
)

if (-not (Test-Path $SourceFile)) {
    Write-Host "Source file not found: $SourceFile"
    exit 1
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
}

Add-Type -AssemblyName System.Drawing

try {
    $image = [System.Drawing.Image]::FromFile($SourceFile)
    
    $sizes = @(16, 32, 48, 128)
    
    foreach ($size in $sizes) {
        $outFile = Join-Path $OutputDir "icon-$size.png"
        
        $bmp = New-Object System.Drawing.Bitmap $size, $size
        $graphics = [System.Drawing.Graphics]::FromImage($bmp)
        
        # High quality resizing
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        
        $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
        $graphics.DrawImage($image, $rect)
        $graphics.Dispose()
        
        $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        
        Write-Host "Created $outFile"
    }
} finally {
    if ($image -ne $null) {
        $image.Dispose()
    }
}

Write-Host "Icon resizing complete."
