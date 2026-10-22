#Requires -Version 5.1
[CmdletBinding()]
param([switch]$Restore, [switch]$NoRestart)
$ErrorActionPreference = 'Stop'
$appName = 'expressive-studio'
$extensionName = 'expressive-studio.js'
$legacyName = 'ExpressiveMotion'
$command = Get-Command spicetify -ErrorAction Stop
$configOutput = @(& $command.Source -c)
if ($LASTEXITCODE -ne 0) { throw 'Cannot locate the Spicetify configuration.' }
$configPath = ($configOutput -join "`n").Trim()
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { throw 'Spicetify configuration not found.' }
$configPath = (Resolve-Path -LiteralPath $configPath).Path
$configDir = Split-Path -Parent $configPath
$appsRoot = Join-Path $configDir 'CustomApps'
$appDir = Join-Path $appsRoot $appName
$extensionsRoot = Join-Path $configDir 'Extensions'
$extensionPath = Join-Path $extensionsRoot $extensionName
$themesRoot = Join-Path $configDir 'Themes'
$legacyDir = Join-Path $themesRoot $legacyName
$backupRoot = Join-Path (Join-Path $configDir 'mod-backups') 'ExpressiveStudio'
$statePath = Join-Path $backupRoot 'active-backup.json'
$sourceExtension = Join-Path (Join-Path $PSScriptRoot 'Extensions') $extensionName
$files = @('index.js', 'manifest.json', 'style.css', 'extension.js')
$sections = @{ current_theme='Setting'; color_scheme='Setting'; inject_css='Setting'; replace_colors='Setting'; inject_theme_js='Setting'; overwrite_assets='Setting'; custom_apps='AdditionalOptions'; extensions='AdditionalOptions' }
$encoding = New-Object Text.UTF8Encoding($false)

function Assert-InDirectory([string]$Target, [string]$Parent) {
    $full = [IO.Path]::GetFullPath($Target)
    $prefix = [IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Path outside the intended directory: $full" }
    return $full
}

function Read-Values {
    $values = [ordered]@{}
    $section = ''
    foreach ($line in [IO.File]::ReadAllLines($configPath)) {
        if ($line -match '^\s*\[([^\]]+)\]') { $section = $Matches[1]; continue }
        if ($line -match '^\s*([a-z_]+)\s*=\s*(.*?)\s*$') {
            $key = $Matches[1]
            if ($sections.ContainsKey($key) -and $sections[$key] -eq $section) { $values[$key] = $Matches[2] }
        }
    }
    foreach ($key in $sections.Keys) { if (-not $values.Contains($key)) { throw "Missing Spicetify setting: $key" } }
    return $values
}

function Write-Values($Values) {
    $lines = [IO.File]::ReadAllLines($configPath)
    $section = ''
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match '^\s*\[([^\]]+)\]') { $section = $Matches[1]; continue }
        if ($lines[$i] -match '^\s*([a-z_]+)\s*=') {
            $key = $Matches[1]
            if ($sections.ContainsKey($key) -and $sections[$key] -eq $section) {
                $value = [string]$Values[$key]
                if ($value -match '[\r\n]') { throw "Invalid setting value: $key" }
                $lines[$i] = '{0,-22} = {1}' -f $key, $value
            }
        }
    }
    [IO.File]::WriteAllLines($configPath, $lines, $encoding)
}

function Read-State {
    if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) { throw 'Expressive Studio backup was not found.' }
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if ($state.app -ne $appName -or $state.configPath -ne $configPath) { throw 'This backup belongs to a different installation.' }
    $state.backupFolder = Assert-InDirectory $state.backupFolder $backupRoot
    if (-not (Test-Path -LiteralPath $state.backupFolder -PathType Container)) { throw 'The backup folder is missing.' }
    # Upgrade the original Custom App snapshot without replacing its theme backup.
    if (-not $state.extensionCaptured) {
        $currentValues = Read-Values
        if ($null -eq $state.settings.PSObject.Properties['extensions']) {
            $state.settings | Add-Member -NotePropertyName extensions -NotePropertyValue ([string]$currentValues['extensions'])
        }
        $extensionEntries = @(([string]$currentValues['extensions']).Split('|') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        Capture-Extension $state ($extensionEntries -contains $extensionName)
        [IO.File]::WriteAllText($statePath, ($state | ConvertTo-Json -Depth 5), $encoding)
    }
    foreach ($key in $sections.Keys) { if ($null -eq $state.settings.PSObject.Properties[$key]) { throw "Backup is missing setting: $key" } }
    return $state
}

function Capture-Extension($State, [bool]$HadEntry) {
    $null = Assert-InDirectory $extensionPath $extensionsRoot
    if (Test-Path -LiteralPath $extensionPath -PathType Leaf) {
        Copy-Item -LiteralPath $extensionPath -Destination (Join-Path $State.backupFolder 'previous-extension.js') -Force
    }
    $State | Add-Member -NotePropertyName hadExtensionEntry -NotePropertyValue $HadEntry -Force
    $State | Add-Member -NotePropertyName extensionCaptured -NotePropertyValue $true -Force
}

function Apply-Spicetify {
    if ($NoRestart) { & $command.Source -n apply } else { & $command.Source apply }
    if ($LASTEXITCODE -ne 0) { throw 'Spicetify apply failed. See its output above.' }
}

function Restore-State($State) {
    $null = Assert-InDirectory $appDir $appsRoot
    foreach ($file in $files) {
        $destination = Join-Path $appDir $file
        $saved = Join-Path (Join-Path $State.backupFolder 'previous-app') $file
        if (Test-Path -LiteralPath $saved -PathType Leaf) {
            New-Item -ItemType Directory -Path $appDir -Force | Out-Null
            Copy-Item -LiteralPath $saved -Destination $destination -Force
        } elseif (Test-Path -LiteralPath $destination -PathType Leaf) { Remove-Item -LiteralPath $destination -Force }
    }
    $null = Assert-InDirectory $extensionPath $extensionsRoot
    $savedExtension = Join-Path $State.backupFolder 'previous-extension.js'
    if (Test-Path -LiteralPath $savedExtension -PathType Leaf) {
        New-Item -ItemType Directory -Path $extensionsRoot -Force | Out-Null
        Copy-Item -LiteralPath $savedExtension -Destination $extensionPath -Force
    } elseif (Test-Path -LiteralPath $extensionPath -PathType Leaf) { Remove-Item -LiteralPath $extensionPath -Force }
    $savedTheme = Join-Path $State.backupFolder 'original-theme'
    if ($State.hadLegacyTheme -and -not (Test-Path -LiteralPath $legacyDir)) {
        $null = Assert-InDirectory $legacyDir $themesRoot
        $null = Assert-InDirectory $savedTheme $State.backupFolder
        if (-not (Test-Path -LiteralPath $savedTheme -PathType Container)) { throw 'The original theme backup is missing.' }
        New-Item -ItemType Directory -Path $themesRoot -Force | Out-Null
        Copy-Item -LiteralPath $savedTheme -Destination $legacyDir -Recurse
    }
    $values = @{}
    foreach ($key in $sections.Keys) { $values[$key] = [string]$State.settings.PSObject.Properties[$key].Value }
    # Keep apps the user added since installing this mod; remove only our entry.
    $current = Read-Values
    $remainingApps = @(([string]$current['custom_apps']).Split('|') | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -ne $appName })
    if ($State.hadAppEntry) { $remainingApps += $appName }
    $values['custom_apps'] = $remainingApps -join '|'
    $remainingExtensions = @(([string]$current['extensions']).Split('|') | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -ne $extensionName })
    if ($State.hadExtensionEntry) { $remainingExtensions += $extensionName }
    $values['extensions'] = $remainingExtensions -join '|'
    Write-Values $values
}

if ($Restore) {
    $state = Read-State
    Restore-State $state
    Apply-Spicetify
    Remove-Item -LiteralPath $statePath -Force
    Write-Host 'Previous appearance restored. Expressive Studio settings and backup retained.' -ForegroundColor Green
    Write-Host "Backup: $($state.backupFolder)"
    return
}

if (-not (Test-Path -LiteralPath $sourceExtension -PathType Leaf)) { throw "Incomplete mod package: Extensions/$extensionName" }
$current = Read-Values
$existingApps = @(([string]$current['custom_apps']).Split('|') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$existingExtensions = @(([string]$current['extensions']).Split('|') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if (Test-Path -LiteralPath $statePath -PathType Leaf) {
    $state = Read-State
    if ($current['current_theme'] -and $current['current_theme'] -ne $legacyName) { throw 'Another standalone theme is active. Restore the previous installation before changing its theme.' }
} else {
    $backupFolder = Join-Path $backupRoot ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
    $null = Assert-InDirectory $backupFolder $backupRoot
    New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
    Copy-Item -LiteralPath $configPath -Destination (Join-Path $backupFolder 'config-xpui.ini')
    foreach ($file in $files) {
        $existing = Join-Path $appDir $file
        if (Test-Path -LiteralPath $existing -PathType Leaf) {
            $savedDir = Join-Path $backupFolder 'previous-app'
            New-Item -ItemType Directory -Path $savedDir -Force | Out-Null
            Copy-Item -LiteralPath $existing -Destination (Join-Path $savedDir $file)
        }
    }
    $hadLegacy = Test-Path -LiteralPath $legacyDir -PathType Container
    if ($hadLegacy) {
        $null = Assert-InDirectory $legacyDir $themesRoot
        $savedTheme = Join-Path $backupFolder 'original-theme'
        $null = Assert-InDirectory $savedTheme $backupFolder
        Copy-Item -LiteralPath $legacyDir -Destination $savedTheme -Recurse
    }
    $state = [pscustomobject]@{ app=$appName; configPath=$configPath; backupFolder=$backupFolder; settings=$current; hadLegacyTheme=$hadLegacy; hadAppEntry=($existingApps -contains $appName) }
    Capture-Extension $state ($existingExtensions -contains $extensionName)
    [IO.File]::WriteAllText($statePath, ($state | ConvertTo-Json -Depth 5), $encoding)
}

try {
    $null = Assert-InDirectory $extensionPath $extensionsRoot
    New-Item -ItemType Directory -Path $extensionsRoot -Force | Out-Null
    Copy-Item -LiteralPath $sourceExtension -Destination $extensionPath -Force
    $newApps = @($existingApps | Where-Object { $_ -ne $appName })
    $newExtensions = @($existingExtensions | Where-Object { $_ -ne $extensionName }) + @($extensionName)
    Write-Values @{ current_theme=''; color_scheme=''; inject_css='1'; replace_colors='1'; inject_theme_js='0'; overwrite_assets='0'; custom_apps=($newApps -join '|'); extensions=($newExtensions -join '|') }
    Apply-Spicetify
    if (Test-Path -LiteralPath $appDir -PathType Container) {
        $null = Assert-InDirectory $appDir $appsRoot
        $retiredApp = Join-Path $state.backupFolder ('retired-app-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
        $null = Assert-InDirectory $retiredApp $state.backupFolder
        Move-Item -LiteralPath $appDir -Destination $retiredApp
    }
    # Retire the old theme only after the replacement has been applied.
    if (Test-Path -LiteralPath $legacyDir -PathType Container) {
        $null = Assert-InDirectory $legacyDir $themesRoot
        $retired = Join-Path $state.backupFolder ('retired-theme-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
        $null = Assert-InDirectory $retired $state.backupFolder
        Move-Item -LiteralPath $legacyDir -Destination $retired
    }
} catch {
    $failure = $_
    try {
        Restore-State (Read-State)
        & $command.Source -n apply
        if ($LASTEXITCODE -ne 0) { Write-Warning 'Configuration restored, but reapplying it failed. Run Install.ps1 -Restore after resolving the Spicetify error.' }
    } catch { Write-Warning "Rollback could not finish: $($_.Exception.Message). Backup: $backupRoot" }
    throw $failure
}
Write-Host 'Expressive Studio installed as a mod. Standalone theme dependency removed.' -ForegroundColor Green
Write-Host "Backup: $($state.backupFolder)"
Write-Host 'The single Appearance button opens the popup editor after restarting.'
if ($NoRestart) { Write-Host 'Spotify was not restarted. Restart it manually to load the mod.' }
