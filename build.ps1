# Build script — copies project to C: drive to avoid WiX UNC path issues
$ErrorActionPreference = "Stop"

$src = $PSScriptRoot
$tmp = "C:\todo-app-build"
$out = "$src\dist"

Write-Host "`n[1/5] Cleaning build dir..." -ForegroundColor Cyan
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }

Write-Host "[2/5] Copying project to $tmp..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path "$tmp\src-tauri\src" -Force | Out-Null
New-Item -ItemType Directory -Path "$tmp\src-tauri\icons" -Force | Out-Null
New-Item -ItemType Directory -Path "$tmp\src-tauri\capabilities" -Force | Out-Null

# Copy Tauri backend
Copy-Item "$src\src-tauri\Cargo.toml"       "$tmp\src-tauri\"
Copy-Item "$src\src-tauri\Cargo.lock"       "$tmp\src-tauri\" -ErrorAction SilentlyContinue
Copy-Item "$src\src-tauri\build.rs"         "$tmp\src-tauri\"
Copy-Item "$src\src-tauri\tauri.conf.json"  "$tmp\src-tauri\"
Copy-Item "$src\src-tauri\src\*"            "$tmp\src-tauri\src\"
Copy-Item "$src\src-tauri\icons\*"          "$tmp\src-tauri\icons\"
Copy-Item "$src\src-tauri\capabilities\*"   "$tmp\src-tauri\capabilities\"

# Copy frontend (use robocopy to exclude node_modules and dist)
robocopy "$src\frontend" "$tmp\frontend" /E /XD node_modules dist .cache /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null

Write-Host "[3/5] Installing frontend deps..." -ForegroundColor Cyan
Push-Location "$tmp\frontend"
npm install --silent 2>&1 | Out-Null
Pop-Location

Write-Host "[4/5] Building..." -ForegroundColor Cyan
Push-Location $tmp
cargo tauri build
Pop-Location

Write-Host "[5/5] Copying installers back..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $out -Force | Out-Null

$bundleDir = "$tmp\src-tauri\target\release\bundle"
if (Test-Path "$bundleDir\msi")  { Copy-Item "$bundleDir\msi\*.msi"   $out -Force }
if (Test-Path "$bundleDir\nsis") { Copy-Item "$bundleDir\nsis\*.exe"  $out -Force }
Copy-Item "$tmp\src-tauri\target\release\todo-app.exe" $out -Force

Write-Host "`nDone! Installers are in: $out" -ForegroundColor Green
Get-ChildItem $out | ForEach-Object { Write-Host "  $_" }

# Cleanup
Remove-Item $tmp -Recurse -Force
