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
if([string]$manager.TetheringOperationalState -eq 'On'){ $stop=Await-Result ($manager.StopTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult,Windows,ContentType=WindowsRuntime]) }
$old=$manager.GetCurrentAccessPointConfiguration()
@{ssid=$old.Ssid;password=$old.Passphrase;band=[int]$old.Band;state=[int]$manager.TetheringOperationalState} | ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot 'previous-private.json') -Encoding UTF8
$config=New-Object Windows.Networking.NetworkOperators.NetworkOperatorTetheringAccessPointConfiguration
$config.Ssid='Muse-PC'
$config.Passphrase='12345678'
$config.Band=1
Await-Action ($manager.ConfigureAccessPointAsync($config))
$result=Await-Result ($manager.StartTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult,Windows,ContentType=WindowsRuntime])
@{status=[string]$result.Status;message=$result.AdditionalErrorMessage;state=[string]$manager.TetheringOperationalState;source=$profile.ProfileName;ssid=$config.Ssid;band=[int]$config.Band;passwordMatches=($manager.GetCurrentAccessPointConfiguration().Passphrase -eq '12345678')} | ConvertTo-Json | Set-Content $log -Encoding UTF8
} catch { @{status='Failed';message=$_.Exception.Message;line=$_.InvocationInfo.ScriptLineNumber} | ConvertTo-Json | Set-Content $log -Encoding UTF8 }
