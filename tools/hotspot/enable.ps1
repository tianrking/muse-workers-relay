$ErrorActionPreference='Stop'
$log=Join-Path $PSScriptRoot 'result.json'
try {
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Networking.Connectivity.NetworkInformation,Windows,ContentType=WindowsRuntime] > $null
[Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows,ContentType=WindowsRuntime] > $null
[Windows.Networking.NetworkOperators.NetworkOperatorTetheringAccessPointConfiguration,Windows,ContentType=WindowsRuntime] > $null
function Await-Action($op) { $method=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and !$_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'} | Select-Object -First 1; $task=$method.Invoke($null,@($op)); $task.GetAwaiter().GetResult() }
function Await-Result($op,$type) {
 $method=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name.StartsWith('IAsyncOperation')} | Select-Object -First 1
 $task=$method.MakeGenericMethod($type).Invoke($null,@($op)); $task.GetAwaiter().GetResult()
}
$profile=[Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
if(!$profile){throw 'No Internet profile available.'}
$manager=[Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)
$old=$manager.GetCurrentAccessPointConfiguration()
@{ssid=$old.Ssid;password=$old.Passphrase;band=[int]$old.Band;state=[int]$manager.TetheringOperationalState} | ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot 'previous-private.json') -Encoding UTF8
$config=New-Object Windows.Networking.NetworkOperators.NetworkOperatorTetheringAccessPointConfiguration
$config.Ssid='Muse-PC'
$config.Passphrase='MuseSG-428617'
$config.Band=1
Await-Action ($manager.ConfigureAccessPointAsync($config))
$result=Await-Result ($manager.StartTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult,Windows,ContentType=WindowsRuntime])
if([string]$result.Status -ne 'Success'){throw ('Hotspot start: '+$result.Status+' '+$result.AdditionalErrorMessage)}
Start-Sleep -Seconds 3
$sharing=New-Object -ComObject HNetCfg.HNetShare
$connections=@($sharing.EnumEveryConnection())
$public=$connections | Where-Object {($sharing.NetConnectionProps($_)).Name -eq 'Mihomo'} | Select-Object -First 1
$virtual=Get-NetAdapter -IncludeHidden | Where-Object {$_.InterfaceDescription -like 'Microsoft Wi-Fi Direct Virtual Adapter*' -and $_.Status -eq 'Up'} | Select-Object -First 1
if(!$public -or !$virtual){throw 'Hotspot running, but Mihomo or active Wi-Fi Direct adapter is unavailable.'}
$private=$connections | Where-Object {($sharing.NetConnectionProps($_)).Name -eq $virtual.Name} | Select-Object -First 1
if(!$private){throw 'Hotspot ICS connection not found.'}
$before=@($connections | ForEach-Object {$p=$sharing.NetConnectionProps($_);$c=$sharing.INetSharingConfigurationForINetConnection($_);[pscustomobject]@{Name=$p.Name;Shared=$c.SharingEnabled;Type=$c.SharingConnectionType}})
$before | ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot 'previous-sharing.json') -Encoding UTF8

$sharing.INetSharingConfigurationForINetConnection($public).EnableSharing(0)
$sharing.INetSharingConfigurationForINetConnection($private).EnableSharing(1)
@{sharedSource='Mihomo';hotspotAdapter=$virtual.Name;status=[string]$result.Status;message=$result.AdditionalErrorMessage;state=[string]$manager.TetheringOperationalState;source=$profile.ProfileName;ssid=$config.Ssid;band=[int]$config.Band} | ConvertTo-Json | Set-Content $log -Encoding UTF8
} catch { @{status='Failed';message=$_.Exception.Message} | ConvertTo-Json | Set-Content $log -Encoding UTF8 }
