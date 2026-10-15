# Muse PC hotspot

Run `start-hotspot.ps1` in the logged-in Windows user session to configure and start the 2.4 GHz Muse-PC hotspot using the current Internet connection profile. The password is configured as requested by the owner. Current successful result: source Mihomo, state On, status Success, gateway 192.168.137.1. This is configuration evidence only; validate client DHCP, DNS and Muse TLS before claiming working proxy forwarding.

The legacy COM ICS binding attempts failed with HRESULT 0x80040201. Restarting SharedAccess allowed the Mihomo public share, but binding the private adapter through COM still failed. Native WinRT hotspot startup then reported success. `enable.ps1`, `fix.ps1`, and `retry-sharing.ps1` are diagnostic attempts, not recommended startup commands. Private backup JSON files can contain the previous hotspot password; do not publish them.
