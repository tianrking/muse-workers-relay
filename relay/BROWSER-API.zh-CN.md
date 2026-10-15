# Muse Browser Relay v4

所有目标固定为 Muse 官方，不能传入任意上游 URL。

| 路由 | 方法 | 调用凭证 | 上游 |
|---|---|---|---|
| /health | GET | 无 | 公共版本／服务检查 |
| /web/account | GET | Bearer device access token | api.muse.ai/fetch_vms |
| /web/refresh | POST | Bearer hatch_refresh:… | api.muse.ai/device_token/refresh |
| /web/official-noise?vm_id=… | WS | muse-v1 + muse-auth 编码 VM token | hatch.metaaivm.com/v1/noise |
| /fetch_vms | GET | Bearer + X-Muse-Relay-Key | 官方相同路径 |
| /device_token/mint | POST | Bearer + X-Muse-Relay-Key | 官方相同路径 |
| /device_token/refresh | POST | Bearer + X-Muse-Relay-Key | 官方相同路径 |
| /web/noise?vm_id=… | WS | muse-auth 编码 VM token 与 relay key | 官方 Noise |
| /v1/noise?vm_id=… | WS | Authorization + X-Muse-Relay-Key | 官方 Noise，MCU 保持兼容 |

浏览器 auth 子协议：muse-auth. + base64url(JSON({token: vm_auth_token, key: relay_key}))；同时提供 muse-v1，服务端选择 muse-v1。官方兼容入口不需要 key。鉴权不放 URL，所有 token 均由调用者提供，Worker 不保存设备 token，也不解密 Noise 数据。

外站部署前端时，将该站 Origin 精确加入 Worker 的 BROWSER_ORIGINS（JSON 字符串数组）。不支持通配符。浏览器 API 预检允许 Authorization、Content-Type、X-API-Version、X-Muse-Relay-Key。WS 必须携带匹配 Origin。

MUSE_RELAY_KEY 通过 Secret 注入。关闭日志和追踪。静态资源目录为 ../studio/dist。官方账号 API 和 Noise 的错误状态保留给客户端；响应无账号缓存，Set-Cookie 不透传。

自定义中转需实现同样的 REST/WS 契约并允许前端 Origin。网页选择自定义服务器会将该账号凭证交给服务器，只有明确确认信任后才能保存外站配置。

凭证来源：ESP32 与 Linux 官方配对得到的 device access token 使用同一套鉴权和 Noise 链路，浏览器无需 source 参数。来源标记只在前端保存。Linux 官方 pairing.json 导入网页后可使用免共享密钥的同站入口；官方 Linux SDK 本身未自动适配共享中转请求头，不能直接替换其域名后使用传统受保护路由。
