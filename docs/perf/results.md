# Spotpear V1 slide benchmark

Identical eight alternating official face/settings transitions at 40MHz LCD clock, RGB565, 360x360.

| Configuration | Sliding frames sampled | Mean refresh | p95 | Max | Bands/frame |
|---|---:|---:|---:|---:|---:|
| Baseline internal 20 rows |24|105.41ms|111.68ms|113.60ms|18|
| PSRAM 180 rows, 16-row DMA |56|47.75ms|53.18ms|55.76ms|2|
| Final PSRAM 360 rows, 24-row DMA |64|39.33ms|43.59ms|55.03ms|1|

Final measured refresh work is 62.7% shorter than baseline (2.68x). These LVGL refresh-event measurements exclude final transfer completion and are not an FPS claim. Touch polling is 10ms. Two PSRAM rendering buffers total 518400 bytes; two internal DMA buffers total 34560 bytes. Final test heartbeat reported internal free 62KB, largest block 31KB, DMA free 55KB and PSRAM free 6563KB. No panic observed in benchmark. Real finger interaction and concurrent cloud voice load require user validation after Wi-Fi provisioning.

Raw logs remain locally at swipe-baseline.log, swipe-optimized.log and swipe-full-buffer.log.
