$src = "D:\Vela\assets\animations"
$dst = "C:\Users\caipe\.openclaw\workspace\Vela\public\assets\animations"
Get-ChildItem $src -Filter "*.fbx" | ForEach-Object {
    Copy-Item $_.FullName -Destination $dst -Force
    Write-Output "Copied: $($_.Name)"
}
Get-ChildItem $dst
