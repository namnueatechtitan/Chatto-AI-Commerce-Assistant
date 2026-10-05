[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$ollamaCommand = Get-Command ollama -ErrorAction SilentlyContinue
$ollamaPath = if ($ollamaCommand) { $ollamaCommand.Source } else { Join-Path $env:LOCALAPPDATA 'Chatto\ollama-v0.33.3\ollama.exe' }
if (-not (Test-Path -LiteralPath $ollamaPath)) { throw 'Install Ollama from https://ollama.com/download/windows first.' }
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_MODELS = Join-Path $env:LOCALAPPDATA 'Chatto\models'
$env:OLLAMA_NUM_PARALLEL = '2'
try { $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/version' -TimeoutSec 2 }
catch {
  $logDir = Join-Path $env:LOCALAPPDATA 'Chatto'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  Start-Process -FilePath $ollamaPath -ArgumentList 'serve' -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'ollama.out.log') -RedirectStandardError (Join-Path $logDir 'ollama.err.log')
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    try { $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/version' -TimeoutSec 2; break } catch { }
  }
}
foreach ($model in @('qwen3.5:9b', 'bge-m3')) {
  & $ollamaPath pull $model
  if ($LASTEXITCODE -ne 0) { throw ('Model download failed: ' + $model) }
}
Write-Output 'Qwen 3.5-9B and BGE-M3 ready on localhost:11434.'
