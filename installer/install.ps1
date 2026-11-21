# MathBoardHome installer. Run through install.bat (it asks for the admin password once).
# Installs to Program Files, starts the home screen at sign-in for every account,
# and fills in the board program, calibration tool and supervisor PIN in config.json.

$ErrorActionPreference = 'Stop'
$AppName   = 'MathBoardHome'
$Dest      = Join-Path $env:ProgramFiles $AppName
$Source    = Join-Path (Split-Path $PSScriptRoot -Parent) 'app'
$Exe       = Join-Path $Dest 'MathBoardHome.exe'
$Config    = Join-Path $Dest 'config.json'
$RunKey    = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Step($text) { Write-Host ''; Write-Host "== $text" -ForegroundColor Cyan }

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Say 'Please run install.bat (it asks for the administrator password).' Red
    exit 1
}
if (-not (Test-Path (Join-Path $Source 'MathBoardHome.exe'))) {
    Say "Cannot find the program files in: $Source" Red
    Say 'Extract the whole zip first, then run install.bat from the extracted folder.' Red
    exit 1
}

# ------------------------------------------------------------------ copy files
Step 'Copying files'
Get-Process -Name $AppName -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

$savedConfig = $null
if (Test-Path $Config) {
    $savedConfig = [IO.File]::ReadAllText($Config)
    Say 'Existing settings found; they will be kept.'
}
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Copy-Item -Path (Join-Path $Source '*') -Destination $Dest -Recurse -Force
if ($savedConfig) { [IO.File]::WriteAllText($Config, $savedConfig, $Utf8NoBom) }
Get-ChildItem $Dest -Recurse -File | Unblock-File
Say "Installed to $Dest" Green

# ------------------------------------------------------------------ WebView2 runtime
Step 'Checking Microsoft Edge WebView2'
$wv2 = @(
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
) | Where-Object { Test-Path $_ } | ForEach-Object { (Get-ItemProperty $_).pv } | Where-Object { $_ -and $_ -ne '0.0.0.0' }
if ($wv2) { Say "WebView2 is installed ($($wv2 | Select-Object -First 1))." Green }
else {
    Say 'WebView2 was not found. It ships with Windows 11; if the home screen stays blank,' Yellow
    Say 'install "Evergreen Bootstrapper" from https://developer.microsoft.com/microsoft-edge/webview2/' Yellow
}

# ------------------------------------------------------------------ helpers for choosing programs
$shell = New-Object -ComObject WScript.Shell

function Find-Shortcuts([string]$pattern) {
    $roots = @(
        "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
        "$env:PUBLIC\Desktop"
    ) + (Get-ChildItem 'C:\Users' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        Join-Path $_.FullName 'Desktop'
        Join-Path $_.FullName 'AppData\Roaming\Microsoft\Windows\Start Menu\Programs'
    })
    $seen = @{}
    foreach ($root in $roots) {
        if (-not (Test-Path $root)) { continue }
        Get-ChildItem $root -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
            try { $lnk = $shell.CreateShortcut($_.FullName) } catch { return }
            $target = $lnk.TargetPath
            if (-not $target -or -not $target.ToLower().EndsWith('.exe') -or -not (Test-Path $target)) { return }
            if ($target -match '(?i)unins|setup|update') { return }
            if (($_.BaseName + ' ' + $target) -notmatch $pattern) { return }
            $key = ($target + '|' + $lnk.Arguments).ToLower()
            if ($seen.ContainsKey($key)) { return }
            $seen[$key] = $true
            [pscustomobject]@{ Name = $_.BaseName; Path = $target; Args = $lnk.Arguments }
        }
    }
}

function Browse-Exe([string]$title) {
    Add-Type -AssemblyName System.Windows.Forms
    $dlg = New-Object System.Windows.Forms.OpenFileDialog
    $dlg.Title = $title
    $dlg.Filter = 'Programs (*.exe)|*.exe'
    $dlg.InitialDirectory = $env:ProgramFiles
    if ($dlg.ShowDialog() -eq 'OK') { return [pscustomobject]@{ Name = ''; Path = $dlg.FileName; Args = '' } }
    return $null
}

function Choose-Program([string]$what, [string]$pattern) {
    $found = @(Find-Shortcuts $pattern)
    if ($found.Count -gt 0) {
        Say "Programs that look like the $what`:"
        for ($i = 0; $i -lt $found.Count; $i++) {
            Say ("  [{0}] {1}  ->  {2} {3}" -f ($i + 1), $found[$i].Name, $found[$i].Path, $found[$i].Args) White
        }
    } else {
        Say "No program that looks like the $what was found automatically."
    }
    Say '  [B] Browse for the .exe file myself'
    Say '  [Enter] Skip for now'
    while ($true) {
        $answer = (Read-Host 'Your choice').Trim()
        if ($answer -eq '') { return $null }
        if ($answer -match '^[Bb]$') { return Browse-Exe "Choose the $what" }
        $n = 0
        if ([int]::TryParse($answer, [ref]$n) -and $n -ge 1 -and $n -le $found.Count) { return $found[$n - 1] }
        Say 'Type one of the numbers, B, or press Enter.' Yellow
    }
}

function Json-Target($p) {
    $esc = { param($s) ($s -replace '\\', '\\' -replace '"', '\"') }
    '{ "path": "' + (& $esc $p.Path) + '", "args": "' + (& $esc $p.Args) + '" }'
}

$text = [IO.File]::ReadAllText($Config)

# ------------------------------------------------------------------ board program
if ($text.Contains('"__BOARD_PROGRAM__"')) {
    Step 'Board program (the big green button)'
    $board = Choose-Program 'board program' '(?i)board|calboard|whiteboard|white board|smart|flow|easi|note|teach|class|pen|ink|سبور|لوح'
    if ($board) {
        $text = $text.Replace('"__BOARD_PROGRAM__"', (Json-Target $board))
        Say "Board program: $($board.Path)" Green
    } else {
        Say 'Skipped. Set it later from the supervisor menu (Edit settings).' Yellow
    }
}

# ------------------------------------------------------------------ calibration tool
if ($text.Contains('"__CALIBRATE_PROGRAM__"')) {
    Step 'Touch calibration'
    Say 'If the board came with its own calibration tool, pick it. Otherwise press Enter'
    Say 'and the button will open the Windows calibration (tabcal).'
    $cal = Choose-Program 'calibration tool' '(?i)calib|calboard|align|orient|معايرة'
    if ($cal) {
        $text = $text.Replace('"__CALIBRATE_PROGRAM__"', (Json-Target $cal))
        Say "Calibration tool: $($cal.Path)" Green
    } else {
        Say 'Using Windows calibration (tabcal).' Green
    }
}

# ------------------------------------------------------------------ supervisor PIN
Step 'Supervisor PIN (hold the clock for 3 seconds to open the supervisor menu)'
$currentPin = ''
if ($text -match '"adminPin"\s*:\s*"(\d*)"') { $currentPin = $Matches[1] }
if ($currentPin -eq '2468') { Say 'The PIN is still the default 2468. Choose a new one.' Yellow }
while ($true) {
    $pin = (Read-Host 'New PIN, 4 to 8 digits (Enter keeps the current one)').Trim()
    if ($pin -eq '') { break }
    if ($pin -match '^\d{4,8}$') {
        $text = [regex]::Replace($text, '"adminPin"\s*:\s*"\d*"', '"adminPin": "' + $pin + '"')
        Say 'PIN saved.' Green
        break
    }
    Say 'Digits only, 4 to 8 of them.' Yellow
}

[IO.File]::WriteAllText($Config, $text, $Utf8NoBom)

# ------------------------------------------------------------------ start at sign-in + shortcuts
Step 'Starting automatically at sign-in (all accounts)'
Set-ItemProperty -Path $RunKey -Name $AppName -Value ('"' + $Exe + '"')
Say 'Done.' Green

$linkName = 'الرئيسية - غرفة الرياضيات.lnk'
foreach ($folder in @("$env:PUBLIC\Desktop", "$env:ProgramData\Microsoft\Windows\Start Menu\Programs")) {
    $lnk = $shell.CreateShortcut((Join-Path $folder $linkName))
    $lnk.TargetPath = $Exe
    $lnk.WorkingDirectory = $Dest
    $lnk.IconLocation = "$Exe,0"
    $lnk.Save()
}

Step 'Finished'
Say 'Restart the computer (or sign out and back in) and the home screen will open by itself.' Green
Say "Settings file: $Config"
