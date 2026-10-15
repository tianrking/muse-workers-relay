# Muse Worker 中转协议与验证范围

核对日期：2026-10-15。依据本项目 main/vm_api.c、main/noise_control.cpp、components/muse/muse_account_api.c、components/muse/muse_chat_session.cpp 与 Cloudflare 官方文档。

| MCU 请求 | 官方上游 | 返回处理 |
| --- | --- | --- |
| GET /fetch_vms | https://api.muse.ai/fetch_vms | 原样返回 JSON 和 HTTP 状态 |
| POST /device_token/mint | https://api.muse.ai/device_token/mint | 请求 JSON 原样转发；返回 access_token/refresh_token JSON 原样 |
| POST /device_token/refresh | https://api.muse.ai/device_token/refresh | 请求 JSON 和鉴权原样转发；返回 token JSON 原样 |
| GET /v1/noise?vm_id=… + Upgrade: websocket | https://hatch.metaaivm.com/v1/noise?vm_id=… | 101 升级响应直接返回，随后透传 WebSocket 中的加密 Noise 数据 |

HTTP 鉴权为 Authorization: Bearer <Muse credential>；刷新路径可能使用 Bearer hatch_refresh:…，须完整保留。X-API-Version: 1.0.0 和 Content-Type 保留。POST 请求体不重新生成（包括 SDK 所需字段）；Worker 不替换 SDK token 或配对产生的凭证。额外 X-Muse-Relay-Key 仅用于本机到 Worker 的访问控制，不转给 Muse。401/403/429/5xx 保留，不把上游错误包装成成功。

WebSocket 是两层：外层 TLS/WebSocket，内层 Noise 加密会话。Worker 只转发外层连接，不解密 Noise，不把二进制改成 JSON，也不尝试解释聊天订阅、语音包或流式回复。因此同一 /v1/noise 路径可承载当前控制和语音连接。不能仅转发账号 HTTP 三个接口。

## 可提交模板

relay/worker.template.mjs 不含私密密钥。部署时设置 Cloudflare Secret MUSE_RELAY_KEY，再使用此模板。固件端 secrets/muse-relay.h 中的 MUSE_RELAY_KEY 需与其相同；可参考 relay/muse-relay.example.h。未配置 Secret 时返回 503。现有本机 worker.mjs/worker.js 含本机中转密钥，保持忽略，不能提交。

## 之前失败在哪里

服务器端 AWS → Cloudflare 健康检查成功；MCU 到 Cloudflare/AWS 的 TLS 曾超时/被重置，未验证实际鉴权 WebSocket/Noise 成功。健康检查 200、Node mock 单测或服务器能访问上游都不能证明 MCU 端到端成功，也没有证据证明 Muse 全面禁用 Cloudflare。当前热点经 Mihomo 到官方服务的路线已实测 Connected 和连续两条文字回复。保持当前固件官方直连。

下一次中转验证应分层：同一热点测试 Worker HTTPS → 使用真实设备凭证完成 /fetch_vms → WebSocket 101 → Noise 握手 → 连续聊天/语音和重连 → 最后脱离电脑代理测试目标 Wi-Fi。只有最终网络能直接访问 Cloudflare，中转才能替代电脑热点；Worker 无法修复设备到 Cloudflare 之间不可达的问题。

Cloudflare 官方文档：
- https://developers.cloudflare.com/workers/runtime-apis/websockets/
- https://developers.cloudflare.com/workers/examples/websockets/
- https://developers.cloudflare.com/workers/platform/limits/

现有测试为本地请求/返回合同测试，未覆盖真实 Cloudflare WebSocket 运行时、Muse 鉴权或 MCU 网络。
