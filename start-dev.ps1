# start-dev.ps1
# Run this every time you want to develop. It handles everything in the right order.
# Works with both a physical phone (USB) and the Android emulator.
# Usage: right-click -> "Run with PowerShell"  OR  run .\start-dev.ps1 in a terminal

Write-Host ""
Write-Host "=== FantasyWaterPolo Dev Startup ===" -ForegroundColor Cyan
Write-Host ""

function IsDeviceReady {
    $deviceLine = adb devices 2>$null | Select-String "`tdevice$"
    if (-not $deviceLine) { return $false }
    $boot = adb shell getprop sys.boot_completed 2>$null
    return ($boot -and $boot.Trim() -eq "1")
}

# Step 1: Wait for device
Write-Host "[1/3] Checking for device..." -ForegroundColor Yellow

if (IsDeviceReady) {
    Write-Host "      Device ready." -ForegroundColor Green
} else {
    Write-Host "      Waiting for a device..." -ForegroundColor DarkYellow
    Write-Host "      (Phone: connect USB cable and accept the USB Debugging prompt)" -ForegroundColor DarkGray
    Write-Host "      (Emulator: start it in Android Studio Device Manager)" -ForegroundColor DarkGray
    Write-Host ""

    $timeout = 120
    $elapsed = 0
    $ready = $false

    while ($elapsed -lt $timeout) {
        if (IsDeviceReady) {
            $ready = $true
            break
        }
        Start-Sleep 3
        $elapsed += 3
        Write-Host "      Still waiting... ($elapsed / $timeout s)" -ForegroundColor DarkGray
    }

    if (-not $ready) {
        Write-Host ""
        Write-Host "  ERROR: No device found after ${timeout}s." -ForegroundColor Red
        Write-Host "  - Phone: make sure USB Debugging is on and you accepted the prompt on the phone" -ForegroundColor Red
        Write-Host "  - Emulator: start it in Android Studio Device Manager first" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }

    Write-Host "      Device ready." -ForegroundColor Green
    Start-Sleep 1
}

# Step 2: Set up adb reverse so Metro can talk to the device
Write-Host "[2/3] Configuring adb tunnel..." -ForegroundColor Yellow
adb reverse tcp:8081 tcp:8081 | Out-Null
Write-Host "      Done." -ForegroundColor Green

# Step 3: Start Metro
Write-Host "[3/3] Starting Metro bundler..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  -------------------------------------------------------" -ForegroundColor Cyan
Write-Host "  When Metro says 'Dev server ready':" -ForegroundColor Cyan
Write-Host "    1. Open the app on your phone / emulator" -ForegroundColor Cyan
Write-Host "    2. The app loads - you are ready to develop" -ForegroundColor Cyan
Write-Host "" -ForegroundColor Cyan
Write-Host "  To reload after code changes: press R in this terminal" -ForegroundColor Cyan
Write-Host "  -------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

npm start
