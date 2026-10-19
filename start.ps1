# Run backend and frontend together on Windows (start.sh is the Linux/macOS version).
#   powershell -ExecutionPolicy Bypass -File .\start.ps1
# Ctrl+C stops both.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

Write-Host "Starting F1 Dashboard..."

# ── Backend ──────────────────────────────────────────────────────────────────
$backendDir = Join-Path $root 'backend'
$python = Join-Path $backendDir 'venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    Write-Host "Creating Python virtualenv (Python 3.12/3.13 required)..."
    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -3.13 -m venv (Join-Path $backendDir 'venv')
    } else {
        & python -m venv (Join-Path $backendDir 'venv')
    }
}
& $python -m pip install -q -r (Join-Path $backendDir 'requirements.txt')
$backend = Start-Process -PassThru -NoNewWindow -WorkingDirectory $backendDir `
    -FilePath $python -ArgumentList '-m', 'uvicorn', 'main:app', '--reload', '--port', '8000'

# ── Frontend ─────────────────────────────────────────────────────────────────
$frontendDir = Join-Path $root 'frontend'
if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
    Write-Host "Installing npm packages..."
    Push-Location $frontendDir
    try { & npm.cmd install } finally { Pop-Location }
}
$frontend = Start-Process -PassThru -NoNewWindow -WorkingDirectory $frontendDir `
    -FilePath 'npm.cmd' -ArgumentList 'run', 'dev'

Write-Host ""
Write-Host "F1 Dashboard ready"
Write-Host "  Frontend -> http://localhost:5173"
Write-Host "  API docs -> http://127.0.0.1:8000/docs"
Write-Host "Press Ctrl+C to stop both servers"

try {
    Wait-Process -Id $backend.Id, $frontend.Id
} finally {
    # Kill whole process trees: uvicorn's reloader has a worker child and
    # npm runs node, and orphans would keep ports 8000/5173 busy.
    foreach ($p in $backend, $frontend) {
        if ($p -and -not $p.HasExited) { & taskkill.exe /T /F /PID $p.Id | Out-Null }
    }
    Write-Host "Stopped."
}
