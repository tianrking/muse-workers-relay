$ErrorActionPreference='Stop'
Restart-Service SharedAccess -Force
Start-Sleep -Seconds 3
& (Join-Path $PSScriptRoot 'fix.ps1')
