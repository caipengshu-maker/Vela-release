Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Find the Vela Electron window and bring it to front
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAPI {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

$velaProc = Get-Process | Where-Object { $_.MainWindowTitle -like "*Vela*" -or $_.MainWindowTitle -like "*vela*" -or $_.MainWindowTitle -like "*Electron*" } | Select-Object -First 1
if ($velaProc -and $velaProc.MainWindowHandle -ne [IntPtr]::Zero) {
    [WinAPI]::ShowWindow($velaProc.MainWindowHandle, 9) | Out-Null  # SW_RESTORE
    [WinAPI]::SetForegroundWindow($velaProc.MainWindowHandle) | Out-Null
    Write-Output "Found window: $($velaProc.MainWindowTitle)"
} else {
    Write-Output "No Vela window found, listing windows:"
    Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object ProcessName, MainWindowTitle | Format-Table
}

Start-Sleep -Seconds 2

$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bitmap.Save("C:\Users\caipe\.openclaw\workspace\Vela\screenshot2.png", [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
Write-Output "screenshot saved"
