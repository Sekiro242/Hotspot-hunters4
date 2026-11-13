# Start Burn Calendar FastAPI Backend
Write-Host "Starting Burn Calendar FastAPI backend on http://127.0.0.1:8000..." -ForegroundColor Cyan
$env:PYTHONPATH="backend"
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
