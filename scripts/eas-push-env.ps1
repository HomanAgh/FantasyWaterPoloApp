# scripts/eas-push-env.ps1
# One-time (re-run if values change): copies Supabase + Sentry settings from your LOCAL
# gitignored config files into EAS environment variables, so cloud (EAS) builds can start.
#
# Why: config/supabaseConfig.js and config/sentryConfig.js are gitignored, so EAS never
# uploads them. Without these env vars the iOS app throws "Supabase configuration is
# missing" at launch (white screen / instant close).
#
# Prereq: `npx eas login` (you must be logged in as the Expo account that owns the project).
# Usage:  .\scripts\eas-push-env.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

function Get-ConfigValue([string]$file, [string]$key) {
    $text = Get-Content $file -Raw
    $m = [regex]::Match($text, "$key\s*:\s*'([^']+)'")
    if (-not $m.Success) { throw "Could not find '$key' in $file" }
    return $m.Groups[1].Value
}

$supabaseUrl = Get-ConfigValue 'config/supabaseConfig.js' 'url'
$supabaseKey = Get-ConfigValue 'config/supabaseConfig.js' 'anonKey'
$sentryDsn   = $null
if (Test-Path 'config/sentryConfig.js') {
    $sentryDsn = Get-ConfigValue 'config/sentryConfig.js' 'dsn'
}

function Push-EasVar([string]$name, [string]$value, [string]$visibility) {
    Write-Host "Setting $name ($visibility) ..." -ForegroundColor Cyan
    npx eas env:create --name $name --value $value `
        --environment production --environment preview `
        --visibility $visibility --force --non-interactive
    if ($LASTEXITCODE -ne 0) { throw "eas env:create failed for $name" }
}

# The Supabase anon key is public-by-design (shipped in every app binary; protected by RLS),
# but we still hide it in the EAS dashboard/logs with "sensitive".
Push-EasVar 'EXPO_PUBLIC_SUPABASE_URL'      $supabaseUrl 'plaintext'
Push-EasVar 'EXPO_PUBLIC_SUPABASE_ANON_KEY' $supabaseKey 'sensitive'
if ($sentryDsn) {
    Push-EasVar 'EXPO_PUBLIC_SENTRY_DSN'    $sentryDsn   'plaintext'
}

Write-Host ""
Write-Host "Done. Verify with:  npx eas env:list production" -ForegroundColor Green
