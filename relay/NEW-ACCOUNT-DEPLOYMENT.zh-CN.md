# 新账号 Worker 上线与验证

日期：2026-10-15。账号：Tienjuiwong@gmail.com。Worker：muse。

- 主地址：https://muse.2fast.cfd
- workers.dev：https://muse.tienjuiwong.workers.dev
- 版本：relay-v2 / fa6b4331-9304-41a3-b7af-224c17e99071，100% 生产流量。
- 源码：worker.template.mjs；配置：wrangler.test-account.jsonc。
- MUSE_RELAY_KEY 通过 Secret 配置，沿用本机 secrets/relay-key.txt；源码无真实密钥。
- 两个域名的 /health 均返回 version=2、build=2026-10-15。未携带中转密钥的 /fetch_vms 返回 401。

## 实际测试

11 项本地 Worker 合约测试通过。pc-new-account-results.json 记录官方直连与新中转对照；pc-new-account-relay-results.json 记录新中转单独复测。真实账号列表 200，WebSocket 101，Noise 握手和设备注册成功，文字对话返回预期标记，ping/pong 正常。

new-account-contract-results.json 记录 fetch_vms、device_token/mint、device_token/refresh 的无效凭证对照：官方和中转均 401，响应体及 Content-Type 一致。没有用真实配对凭证执行 mint/refresh，避免改变板子当前账号凭证。

PC 当前经过 Mihomo TUN；这里的官方直连指直接请求官方域名。此结果不能证明中国普通 Wi-Fi 不经代理可达，也不能证明全球加速。TTS 对文字回复返回 400，旧 dictation 路径返回 403，与官方一致；尚未证明音频成功输出。

MCU 本次未连接、未刷写，实体板仍为之前的固件。新域名尚未在实体板上验证。

## 复现

在 muse_meta 目录运行：

```text
C:/Espressif/tools/python/v6.1/venv/Scripts/python.exe -X utf8 tools/test_relay_live.py --mode both --relay-host muse.2fast.cfd --report relay/pc-new-account-results.json
```

通过官方 Wrangler versions upload 上传后，再 versions deploy VERSION@100% 切换生产；使用 --config relay/wrangler.test-account.jsonc。此次未修改旧账号 Worker 或旧域名配置。
