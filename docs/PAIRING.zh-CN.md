# 圆屏绑定 Muse

当前硬件：Spotpear ESP32-S3 Round 1.8 V1，设备名 MuseGadget-1E613C。

1. 在手机 Muse App 登录你的账号并打开蓝牙。进入设置 → 装置，开启 Developer mode。
2. 点击＋／Add Device，选择 MuseGadget-1E613C。不要仅在手机系统的蓝牙设置中连接。
3. 等圆屏显示 Pair with Muse app / Tap to confirm pairing，轻点屏幕确认；也可短按 BOOT。提前乱按不会代替尚未开始的握手。
4. 按手机流程完成网络与账号配置；圆屏已有 Wi-Fi，不代表账号绑定完成。
5. 通过串口 status 确认 Wi-Fi connected、link paired=true、设备认证令牌存在，再检查实际云端会话。
6. 绑定完成后按住屏幕麦克风说话，松开发送。当前没有免按键语音唤醒。

中转地址：muse.w0x7ce.eu。Cloudflare 中转只影响设备联网后的传输，不会自动给设备签发 Muse 账号认证令牌，也不会替代手机蓝牙配对。

## 2026-10-14 配对失败诊断

已实际进入手机确认后的云端认证流程。设备 HTTPS 日志出现 No matching trusted root certificate found 和 mbedtls_ssl_handshake -0x3000。中转域名提供 WE1 → GTS Root R4（由旧 GlobalSign Root CA 交叉签名）的链。IDF 完整根库有 GTS Root R4，但不再包含该旧 GlobalSign 根。板卡配置启用 MBEDTLS_CERTIFICATE_BUNDLE_CROSS_SIGNED_VERIFY，使用可信 GTS 根完成链构建；不关闭证书或域名校验，不加入已弃用根。

用 python tools/check_spotpear_network.py 检查板子本身的 DNS 与 HTTPS /health。预期 health=200 result=ESP_OK；这仅验证中转可达性，账号授权和 Noise 会话还需真实配对验证。

修正版实测：板子 DNS 解析得到 172.67.210.235，TCP 443 建连 error=0；HTTPS /health 超时 ESP_ERR_HTTP_CONNECT，账号 API 还出现 HTTP_EAGAIN。独立 Muse 语音会话也已改用中转并附加中转认证头。当前尚未证明 MCU 到中转 HTTPS 连通，不能宣称绑定与语音成功。用户确认只有电脑/手机开代理、路由器未给 MCU 提供代理出网。
