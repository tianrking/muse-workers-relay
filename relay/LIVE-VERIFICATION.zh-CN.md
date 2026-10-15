# Cloudflare Muse 中转：实测记录与部署

日期：2026-10-15。基于 Meta muse-gadget-sdk 提交 8e613f77f3a95a63e70cf8be549db9e589105ea0、当前 Spotpear V1 ESP-IDF 6.1 固件，以及已部署的 muse-personal-relay（muse.w0x7ce.eu）。

## 结论与边界

现有 Cloudflare Worker 已通过真实账号查询、WebSocket 101、Noise XX、控制注册、文字聊天与保活测试。此前“无法连接”不能归因于 Muse 全面禁止 Cloudflare。PC 对照中的 direct 表示直接访问官方域名；电脑仍运行 Mihomo TUN，因此这些结果不证明无代理网络能访问 Cloudflare。

MCU 首轮经 Muse-PC 热点访问中转成功：日志记录 TLS 目标 muse.w0x7ce.eu、/fetch_vms HTTP 200、WebSocket 升级、Noise 32/132/64 字节握手、控制会话和独立聊天会话建立；连续两个文本请求得到中转测试一成功、中转测试二成功。

最后准备刷入“实际服务器域名显示”修复时，USB 串口列表为空，烧录未进行；新代码已构建成功。原路由器 Hera_803 无电脑代理的 MCU 对照尚未完成。当前无法声称中转在所有国家/运营商均可达或一定加速。

## 请求覆盖与结果

| 链路 | 真实验证 |
| --- | --- |
| GET /fetch_vms | PC 官方与 Worker 均 200；返回 vm_list 和相同字段结构 |
| POST /device_token/mint | 无效凭证对照：两边 401，正文和 Content-Type 相同；未重新执行手机配对或创建新设备 |
| POST /device_token/refresh | 无效凭证对照相同；MCU 中转启动日志证明 refresh-token 分支成功 200 并保存凭证 |
| GET /v1/noise?vm_id=… | PC 两边真实凭证均 101、Noise 成功 |
| POST /link-control（加密流内） | PC 两边 link.register 成功；测试不提供命令执行能力 |
| POST /chat/subscribe（加密流内） | 两边接收 NDJSON 分块事件 |
| POST /chat/stream（加密流内） | 两边 200，文字请求收到预期回复 |
| WAV 语音便笺（同一 chat/stream） | 合成语音样本经约 250KB JSON 分块上传，两边 200；本次未收到预期回复，不能声明语音识别通过 |
| GET /api/voice/tts-stream、/voice/tts-stream | 两边返回 400：tts-stream only synthesizes voice-modality assistant messages；未验证实际 MP3 输出 |
| POST /api/voice/dictation?sample_rate_hz=24000 | 两边 403：path not allowed for device token；当前固件 VOICE_NOTE=1，不走此旧路径 |
| WebSocket ping/pong | PC 两边成功 |

注意：上传接口 200 不等于模型完成识别/生成；鉴权失败返回一致也不等于成功鉴权。测试未覆盖真实手机重新配对 mint 成功路径、长时间语音压力、多地区公网和 OTA/任意外部资源下载。

## 透明中转结构

MCU → HTTPS/WSS muse.w0x7ce.eu → api.muse.ai 或 hatch.metaaivm.com。Worker 外层只需四条路径：fetch_vms、device_token/mint、device_token/refresh、v1/noise。聊天、语音便笺、TTS、订阅、设备控制请求都封装在 Noise 的加密二进制数据中，由相同 WebSocket 透明承载；不应把它们重写成 Worker 明文接口。

保留 Authorization、Content-Type、X-API-Version 和升级头；POST body 原样流式转发；上游 101 直接返回原 Response，保留其 webSocket；普通 HTTP 状态和正文原样传回。账号数据不缓存。固定上游白名单，额外中转密钥不发给 Muse，不记录 token 或语音正文。

## 可重复部署

relay/worker.template.mjs 是无真实密钥的可提交入口，relay/wrangler.jsonc 已指向它，并声明现有自定义域名。部署前须在同一 Cloudflare 账号设置 Secret MUSE_RELAY_KEY，其值与本机 secrets/relay-key.txt 相同。不要把秘密粘贴进公开代码。

从项目目录，在已登录且有权限的 Wrangler 环境执行：

    npx wrangler secret put MUSE_RELAY_KEY --config relay/wrangler.jsonc
    npx wrangler deploy --config relay/wrangler.jsonc

本次实测复用现有已部署 Worker；没有通过未授权/未登录 CLI 替换生产代码。当前生产代码与模板的转发逻辑相同，主要差别是模板从 Secret 读取中转密钥。

## 固件模式

    python tools/muse_backend.py relay --host muse.w0x7ce.eu
    python tools/spotpear.py flash --port COM3

恢复官方：

    python tools/muse_backend.py direct
    python tools/spotpear.py flash --port COM3

模式变更需要重新构建/烧录。SDK token、配对 token 和中转密钥留在 ignored secrets/；新检出项目用 spotpear.py 构建时，缺少中转配置会生成官方直连默认配置。

## PC 测试

    node --test relay/worker.test.mjs
    python tools/test_relay_live.py --report relay/pc-verified-results.json
    python tools/test_relay_live.py --voice-note-file LOCAL_PCM16_MONO_16KHZ.wav --report relay/voice-results.json
    python tools/test_relay_live.py --voice-output --report relay/tts-results.json

依赖官方 linux/src 的 Python Noise 实现、cryptography 和 websockets。PC 凭证只从本机 secrets/pc-relay-credentials.json 读取；不能用 SDK token 代替设备 access token。测试不自动轮换设备凭证，不启动官方 Linux 系统服务，也不开放 system.run/file.write。报告仅含状态、大小和受控测试回复的诊断信息。音频请求中的语音样本必须是自有/允许使用的样本。

## 访问体验与性能

Worker 全球入口可以统一域名、TLS、路由和连接流程，但不能使客户端到 Cloudflare 的丢包/阻断消失，也不能改变 Muse 所在区域和推理耗时。本机测试既有中转更快的样本，也有更慢的样本；不应把功能验证写成全球加速证明。长期使用仍需保活、重连和实际地区测量。

官方依据：
- https://developers.cloudflare.com/workers/runtime-apis/websockets/
- https://developers.cloudflare.com/workers/examples/websockets/
- https://developers.cloudflare.com/workers/platform/limits/
