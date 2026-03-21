Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("C:\Users\caipe\.openclaw\workspace\Vela\screenshot2.png")
$newWidth = 1280
$newHeight = [int]($img.Height * ($newWidth / $img.Width))
$bmp = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, 0, 0, $newWidth, $newHeight)
$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 75)
$bmp.Save("C:\Users\caipe\.openclaw\workspace\Vela\screenshot2-small.jpg", $encoder, $encParams)
$g.Dispose()
$bmp.Dispose()
$img.Dispose()
Write-Output "compressed"
