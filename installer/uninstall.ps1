# Removes MathBoardHome. Run through uninstall.bat.

$ErrorActionPreference = 'Continue'
$AppName = 'MathBoardHome'
$Dest    = Join-Path $env:ProgramFiles $AppName

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'Please run uninstall.bat (it asks for the administrator password).' -ForegroundColor Red
    exit 1
}

$answer = Read-Host 'Remove the home screen from this computer? Type Y to confirm'
if ($answer -notmatch '^[Yy]$') { Write-Host 'Nothing was changed.'; exit 0 }

Get-Process -Name $AppName -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500
Remove-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' -Name $AppName -ErrorAction SilentlyContinue

$linkName = 'الرئيسية - غرفة الرياضيات.lnk'
foreach ($folder in @("$env:PUBLIC\Desktop", "$env:ProgramData\Microsoft\Windows\Start Menu\Programs")) {
    Remove-Item (Join-Path $folder $linkName) -ErrorAction SilentlyContinue
}

if (Test-Path $Dest) {
    $backup = Join-Path $env:PUBLIC "Documents\MathBoardHome-config-backup.json"
    Copy-Item (Join-Path $Dest 'config.json') $backup -ErrorAction SilentlyContinue
    Remove-Item $Dest -Recurse -Force
    Write-Host "Settings were backed up to $backup"
}
Write-Host 'Removed.' -ForegroundColor Green
