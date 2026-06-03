# setup_android.ps1 - Setup Android SDK for Tauri Android build
# Jalankan: powershell -ExecutionPolicy Bypass -File setup_android.ps1

$ANDROID_SDK = "C:\Android\Sdk"
$CMDLINE_TOOLS = "$ANDROID_SDK\cmdline-tools\latest"
$TEMP_ZIP = "$env:TEMP\cmdline-tools.zip"
$TEMP_EXTRACT = "$env:TEMP\cmdline-tools-extract"

Write-Host "[1/5] Mengekstrak Android SDK command-line tools..."
if (Test-Path $TEMP_EXTRACT) { Remove-Item $TEMP_EXTRACT -Recurse -Force }
Expand-Archive -Path $TEMP_ZIP -DestinationPath $TEMP_EXTRACT -Force

# Pindah ke lokasi yang benar (Tauri butuh struktur cmdline-tools/latest/)
if (!(Test-Path "$ANDROID_SDK\cmdline-tools")) {
    New-Item -ItemType Directory -Path "$ANDROID_SDK\cmdline-tools" | Out-Null
}
if (Test-Path $CMDLINE_TOOLS) { Remove-Item $CMDLINE_TOOLS -Recurse -Force }
Move-Item "$TEMP_EXTRACT\cmdline-tools" $CMDLINE_TOOLS
Write-Host "    Extracted to: $CMDLINE_TOOLS"

# Set PATH sementara
$env:PATH = "$CMDLINE_TOOLS\bin;$env:PATH"
$env:ANDROID_HOME = $ANDROID_SDK
$env:JAVA_HOME = "C:\java25\jdk-25.0.2"

Write-Host "[2/5] Menerima lisensi Android SDK..."
$licenseProcess = Start-Process -FilePath "$CMDLINE_TOOLS\bin\sdkmanager.bat" `
    -ArgumentList "--licenses" `
    -RedirectStandardInput "$PSScriptRoot\accept_licenses.txt" `
    -Wait -PassThru -NoNewWindow
Write-Host "    Licenses accepted."

Write-Host "[3/5] Menginstall Android SDK packages..."
& "$CMDLINE_TOOLS\bin\sdkmanager.bat" `
    "platform-tools" `
    "platforms;android-34" `
    "build-tools;34.0.0" `
    "ndk;27.0.12077973"
Write-Host "    SDK packages installed!"

Write-Host "[4/5] Set environment variables permanen..."
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $ANDROID_SDK, "User")
[System.Environment]::SetEnvironmentVariable("NDK_HOME", "$ANDROID_SDK\ndk\27.0.12077973", "User")
$currentPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
if ($currentPath -notlike "*$ANDROID_SDK\platform-tools*") {
    [System.Environment]::SetEnvironmentVariable("PATH", "$ANDROID_SDK\platform-tools;$ANDROID_SDK\cmdline-tools\latest\bin;$currentPath", "User")
}
Write-Host "    Environment variables set!"

Write-Host "[5/5] Selesai! Sekarang jalankan:"
Write-Host "    npm run tauri android init"
Write-Host "    npm run tauri:android"
