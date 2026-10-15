# Muse personal Cloudflare relay

Copy all of worker.js into the muse-personal-relay Cloudflare Worker editor and deploy. This local file includes a random relay-only key and is gitignored; it does not contain the Muse SDK token. Keep the key unchanged to match the firmware in this workspace.

Allowed upstream routes: GET /fetch_vms, POST /device_token/mint, POST /device_token/refresh to api.muse.ai; GET /v1/noise?vm_id=... WebSocket upgrade to hatch.metaaivm.com. Health is public at /health. All other routes require the separate relay key and Muse authorization. No arbitrary destination proxying, storage or payload logging. Upstream 401/403/429 statuses are preserved. TLS verification and Noise are retained. Cloudflare terminates TLS and can see authorization headers; Noise application encryption remains between device and Muse.

Current Cloudflare service was created at https://muse-personal-relay.bkgr.workers.dev and its /health endpoint returned the expected service JSON after manual deployment. Selected firmware and custom-domain host is muse.w0x7ce.eu. Relay-enabled firmware has compiled successfully with ESP-IDF 6.1 but has not been flashed.

No published Cloudflare-specific prohibition was found in the reviewed SDK source and Gadget SDK terms. That is not proof of upstream IP acceptance. With no paired device token yet, an authenticated successful end-to-end session is still untested. Official issue #127 reports 403 from Vietnam and US IPs even with fresh VM tokens; this does not establish a Cloudflare ban.

Local test: node --test worker.test.mjs (7 tests passed). Runtime/real Noise connection needs deployment, Wi-Fi and legitimate app provisioning.

Sources reviewed 2026-10-14:
- https://gadgets.muse.ai/sdk-terms
- https://github.com/facebookincubator/muse-gadget-sdk/issues/127
- https://developers.cloudflare.com/workers/runtime-apis/websockets/

Custom domain muse.w0x7ce.eu bound successfully; HTTPS /health returned 200 with the expected relay service JSON. Workers Free currently allows 100000 requests/account/day and 10ms CPU/request; WebSocket messages do not count as requests, but initial Upgrade does. Health checks are not evidence of successful authenticated Muse sessions.


## 2026-10-14 当前运行模式

已按用户选择启用 `secrets/muse-relay.h` 的 `MUSE_RELAY_DIRECT`，统一关闭账号、控制连接、语音连接和设置 Test connection 的中转，使用官方服务。AWS → Cloudflare 的服务器端健康检查已通过，但 MCU 到中转的 TLS 尚未成功，不能视为端到端中转成功。保留中转部署与配置以便后续诊断。下一步使用能够让热点客户端访问官方服务的新加坡网络验证实际 Muse 连接。


## Verified follow-up (2026-10-15)

See [live verification](LIVE-VERIFICATION.zh-CN.md) for actual PC direct/relay and MCU results, the exact scope and current USB blocker. Deployable entry point is now worker.template.mjs; configure Cloudflare Secret MUSE_RELAY_KEY before deployment. Current production Worker was reused for live testing and was not replaced via CLI.
