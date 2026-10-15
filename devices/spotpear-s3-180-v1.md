# Spotpear ESP32-S3 1.8 inch round V1

Native ESP-IDF 6.1 port of Meta Muse Gadgets SDK, upstream commit 8e613f77f3a95a63e70cf8be549db9e589105ea0.

## Build and flash on this machine

Use C:/Espressif/tools/python/v6.1/venv/Scripts/python.exe tools/spotpear.py build (or flash --port COM3) from muse_meta. The wrapper selects the installed IDF 6.1 and reads secrets/sdk-token.txt locally. Secrets and generated firmware must remain private.

## Hardware

360x360 ST77916 QSPI at 40MHz; CST816S touch at 400kHz with 10ms polling. PCM5100A DAC and V1 MSM261S4030H0R microphone use separate I2S controllers. SDMMC uses four data lines. All pin assignments are in components/muse/boards/spotpear_v1/spotpear.h. No battery or PMIC is present in this adapter.

The official Muse UI, BLE provisioning, encrypted link, settings and voice application remain in place. SDK-token configuration alone does not provision Wi-Fi or the cloud device identity. Phone Bluetooth connection alone is insufficient. Confirm with tools/muse/chat.py --port COM3 --status.

## Verification

Firmware built and flashed using IDF 6.1. Display and official UI confirmed by user. SD mounted; microphone self-test measured 16133Hz capture and 16161Hz playback against nominal 16000Hz. Audible output still needs user verification.

Windows portable host suite: 129 tests passed, 28 skipped. Full upstream host suite requires POSIX tools unavailable on this machine and did not pass here.

## Display performance

Run tools/benchmark_spotpear.py --port COM3 --output swipe-benchmark.log for eight alternating official face/settings transitions. Metrics measure LVGL refresh start to ready during sliding, not complete panel presentation or true FPS. Baseline direct 20-row renderer: mean 105.41ms, p95 111.68ms, 18 bands per refresh. Pipelined 180-row PSRAM renderer: mean 47.75ms, p95 53.18ms, 2 bands per refresh. RGB565 and LCD clock are unchanged. Final tuning results are recorded under docs/perf.

Final selected profile: two 360-row PSRAM buffers and two 24-row internal DMA buffers. Mean refresh 39.33ms, p95 43.59ms, 62.7% less refresh work than baseline. See ../docs/perf/results.md for definitions and memory measurements.

Chinese network-name display: Settings now copies its Montserrat 16/20 and unscii-16 descriptors and attaches the existing muse_font_cjk_16 fallback. Labels and text entry retain Latin metrics and icons. Scan/join SSID bytes are unchanged. CJK coverage comes from the existing Unifont basic ideograph/punctuation/kana/fullwidth subset; arbitrary legacy SSID byte encodings are not converted.

## 2026-10-15 current relay flash

COM4 was positively identified as MuseGadget-1E613C and flashed with the muse.2fast.cfd relay configuration using IDF 6.1. Write hash verification succeeded and existing pairing was retained. Device status returned Connected / Online on the omg phone hotspot; the user confirmed local Internet without a proxy/VPN and reported the device usable. See [the detailed verification record](../relay/MCU-HOTSPOT-VERIFICATION.md) for the weak Hera_803 trial, the occupied voice turn and acceptance limits.
