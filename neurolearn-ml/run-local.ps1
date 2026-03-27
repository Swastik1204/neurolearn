$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not (Test-Path '.deps')) {
  New-Item -ItemType Directory -Path '.deps' | Out-Null
}

py -3 -m pip install --upgrade --target ".deps" -r requirements.txt
$env:PYTHONPATH = (Resolve-Path ".deps").Path
py -3 -m uvicorn main:app --host 127.0.0.1 --port 8000
