# Muse 小小会客厅（历史原型）

当前线上版本已经升级为 React Mori Studio。最新项目和说明见 ../studio/README.zh-CN.md；这里保留早期纯 JavaScript 原型。

打开：https://muse.2fast.cfd/

只有 HTML、CSS 和 JavaScript；运行不需要 Python、Node 或本机服务。网页和中转都由现有 Cloudflare Worker muse 提供。支持文字流式回复、连接状态、连续对话、窗口清空及响应式布局。

## 怎么玩

1. 打开网页，点「连接我的 Muse」。
2. 点「导入连接配置」，选择本机文件 C:\b1_round_display_muse\muse_meta\secrets\web-playground.json。
3. 点「连接 Muse」，显示已连接后输入文字。Enter 发送，Shift+Enter 换行。

当前浏览器已经完成连接和真实聊天测试，可以直接继续发送。刷新页面会清除内存中的凭证，需要重新导入。配置文件是私人凭证，不要发送给别人。该文件位于 Git 忽略的 secrets 目录，未上传到网页静态资源。

## 通信实现

- muse-client.mjs：浏览器原生 Web Crypto 实现 X25519、AES-GCM、SHA-256/HMAC，移植官方 Noise XX、protobuf 封装、控制流及聊天事件。参考官方 SDK 8e613f77 的 linux/src/musegadget/noise 和 link_client.py。
- app.mjs：连接配置、纯 DOM 流式渲染；模型输出使用 textContent，不执行回复中的 HTML。
- index.html / app.css：界面、原创 CSS 桃子头像、适配窄屏及减少动态效果偏好。
- relay/worker.template.mjs：保留 MCU 的 /v1/noise 和 REST 透传，新增 /web/noise 浏览器入口及静态资源服务。

浏览器 WebSocket 无法设置 Authorization 请求头。网页通过 Sec-WebSocket-Protocol 传递短期 VM token 和中转密钥；Worker 校验同源 Origin 与密钥，转换为官方需要的 Authorization。凭证不放 URL；后续 Noise 密文原样传输，Worker 不解密聊天。日志和追踪关闭。

这是个人试玩入口。使用已有配对设备凭证；不提供新的账号登录/配对，不自动刷新 token，不授予网页任何设备命令执行能力。授权过期时会提示重新配置。聊天使用 Muse 账号主会话，清空窗口不会删除官方聊天记录。

## 验证

真实 Chrome 浏览器完成账号鉴权、WebSocket、Noise 握手、设备注册及文字回复。具体结果见 browser-verification.json 和截图。测试电脑仍经 Mihomo TUN；不代表国内任意 Wi-Fi 无代理可达。此次未刷 MCU，也未验证语音。

本地检查：

```text
node --test relay/worker.test.mjs
node --test playground/client.test.mjs
```

部署使用 relay/wrangler.test-account.jsonc；assets 指向 playground/web，保留现有 MUSE_RELAY_KEY Secret。先 wrangler versions upload，再将确认的版本部署到 100% 生产流量。
