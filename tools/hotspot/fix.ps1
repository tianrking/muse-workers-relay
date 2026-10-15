$mgr=New-Object -ComObject HNetCfg.HNetShare
$notes=@()
foreach($name in @('Mihomo','本地连接* 2')) {
 foreach($conn in $mgr.EnumEveryConnection()) {$p=$mgr.NetConnectionProps($conn);if($p.Name -eq $name){$c=$mgr.INetSharingConfigurationForINetConnection($conn);try {$type=0;if($name -ne 'Mihomo'){$type=1};if(!$c.SharingEnabled -or $c.SharingConnectionType -ne $type){$c.EnableSharing($type)};$notes+=($name+': enabled')}catch{$notes+=($name+': '+$_.Exception.Message)}}}
}
$notes | ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot 'fix-result.json') -Encoding UTF8
& (Join-Path $PSScriptRoot 'verify.ps1')
