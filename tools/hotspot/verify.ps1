$ErrorActionPreference='Stop'
$mgr=New-Object -ComObject HNetCfg.HNetShare
$rows=@($mgr.EnumEveryConnection() | ForEach-Object {$p=$mgr.NetConnectionProps($_);$c=$mgr.INetSharingConfigurationForINetConnection($_);[pscustomobject]@{Name=$p.Name;Shared=$c.SharingEnabled;Type=$c.SharingConnectionType}})
$rows | ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot 'sharing-current.json') -Encoding UTF8
