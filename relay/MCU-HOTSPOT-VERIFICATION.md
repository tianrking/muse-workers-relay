# MCU relay verification on a local phone hotspot

Date: 2026-10-15. Relay: https://muse.2fast.cfd. Worker implementation: [worker.template.mjs](worker.template.mjs).

## Firmware and hardware

- Identified COM4 as Spotpear ESP32-S3 Round 1.8 V1, USB identity F0:9E:9E:1E:61:3C, name MuseGadget-1E613C.
- COM3 was a different ESP32-S3 behind a CH343 bridge and was not flashed.
- Selected the relay explicitly with `python tools/muse_backend.py relay --host muse.2fast.cfd`.
- ESP-IDF 6.1 build succeeded; signed application size 0x2e1000, application slot 0x400000, 28% free.
- Flashed COM4 successfully with write hash verification. Existing pairing remained present; flash was not erased.
- Firmware SHA-256: `099aa7eeed4fbf5743f6a8516d392e93ac0b96b68a4afaf0e40f20f9eed58d25`.
- Binary and real backend credentials remain ignored local artifacts.

## Results

Before flashing, PC relay validation returned account HTTP 200, one VM, WebSocket 101, successful Noise handshake and registration, completed text reply and keepalive pong. See [the PC report](pc-preflash-relay-results.json). This PC path may use the computer's proxy and is distinct from the MCU test.

The initial Hera_803 trial received an IP temporarily but repeatedly lost Wi-Fi with RSSI around -80 to -83 dBm. It did not establish a useful relay acceptance result; no claim is made that the relay itself failed on that network.

The user subsequently switched the round display to the phone hotspot `omg` and explicitly reported that the phone had no proxy/VPN and used local Internet. The MCU returned:

```json
{
  "board": "Spotpear ESP32-S3 Round 1.8 V1",
  "wifi": { "state": "connected", "ssid": "omg", "rssi": -65 },
  "muse": { "host": "muse.2fast.cfd", "state": "Connected" },
  "link": { "paired": true, "state": "Online" }
}
```

The user confirmed the device was usable and requested that further testing stop for now. This supports successful MCU relay connectivity on that particular local hotspot; the absence of a hotspot proxy is user-reported, not an independent routing capture.

## Boundaries

- The additional USB text acceptance command was rejected locally with `BUSY WITH A VOICE TURN`; it did not produce a separate verified MCU text reply in this run. We did not cancel the user's voice turn.
- No long-duration reconnect test, audible output check or global network coverage test was performed.
- PC probes of TTS for a text-modality message returned 400, and the dictation path returned 403. They are recorded as protocol responses, not successful audio acceptance.
- The production Worker source was already tracked and unchanged in this verification. Do not replace the working deployment with credential-bearing generated worker copies.
- Wi-Fi passwords, device tokens, relay keys, firmware binaries and raw private logs are not included in this record.
