# Mori · Muse Studio

一个独立的 React + TypeScript Muse 网页客户端，运行时只有浏览器与 Cloudflare Worker，不需要 Python 或本机服务。

地址：https://muse.2fast.cfd/

## 已实现

- 多账号连接档案：命名、导入配对 JSON、编辑、切换、锁定、停用与恢复。各档案的凭证按 ID 独立保存在内存。
- 默认中转（推荐）：通过本站 Worker（生产域名 https://muse.2fast.cfd）访问官方服务，用户只填自己的 device access token；无需填写中转地址或中转 Token。共享中转密钥只保留在 Worker Secret，不嵌入网页。内部兼容字段 mode=official 保持不变，已有此模式的账号自动显示为默认中转；自定义线路仍保留。
- 自定义 HTTPS 中转：可编辑域名、密钥、检测连通性；跨域服务需要配置 CORS 与 Origin 白名单。保存其他域名前须明确确认信任。
- 独立会话：默认生成 UUID，通过官方 session_id 创建线程，校验官方回包的会话 ID 和 is_thread=true，不把独立会话成功冒充成 main。主会话需要显式选择。
- 会话命名、搜索、本机归档与恢复、Markdown 导出；本机记录与账号 ID 隔离。
- 流式 Markdown、代码块、表格、消息复制、滚动跟随／回到最新、停止接收、断线提示、连接诊断和多 Muse 选择；空闲断线最多三次 2/4/8 秒退避重连，不重发聊天。
- 可选本机加密凭证：PBKDF2-SHA256（210000 次）派生 AES-256-GCM 密钥；随机 salt/IV，密码不上传。默认不持久保存凭证。
- 手动 token 轮换：需要 refresh_token/device_id，可附 SDK token；操作前说明共享设备影响，不自动刷新 MCU 共用凭证。
- 浅色／深色、移动端侧栏、原生可访问对话框、键盘快捷键、减少动态效果偏好。

## 新用户接入

SDK token（mgst_…）用于官方 gadget 配对，不能单独作为聊天 token。官方 SDK 的配对仍通过手机 Muse App 与 ESP32/Linux gadget 完成。

1. 在 https://gadgets.muse.ai 创建自己的 SDK token。
2. 按官方 SDK 文档配置 gadget，在 Muse App 的 Settings → Devices 开启 Developer mode，添加并确认设备。
3. 从自己的配对配置导入 access_token。可选提供 refresh_token、device_id、sdk_token 以支持手动刷新。
4. 在 Mori 添加账号，使用默认中转，或在连接方式中选择你信任的自定义中转，然后连接。也可只保存 SDK token 作为待配对档案，界面不会将其标记为已授权。

纯网页无法充当官方手机配对所需的蓝牙外设。项目不抓取官方网页登录 cookie，不提供未公开的账号 OAuth，不假装 SDK token 可以直接绑定聊天账号。官方说明：https://github.com/facebookincubator/muse-gadget-sdk

## 本机已有配置

可导入 ../secrets/web-playground.json（旧版 access_token/relay_key 格式仍兼容）。此文件不会进入 Git 或构建产物。现有两种测试档案可以使用同一个已配对账号进行线路对照；这不表示创建了两个官方账号。

## 开发与构建

使用安装时锁定的 pnpm 依赖（pnpm-lock.yaml）。

```text
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm test
```

开发前端默认 127.0.0.1:5173；Vite 将 /web、/fetch_vms 等请求代理到 VITE_DEV_ADAPTER_URL（默认当前生产适配入口），因此可以联调真实接口。后端应将本机 Origin 加入 BROWSER_ORIGINS；先复制 ../relay/wrangler.web.example.jsonc 为忽略的 wrangler.local.jsonc，并设置自己的 Worker 名称。要本地调试 Worker，可先构建，再从 ../relay 执行 Wrangler dev --config wrangler.local.jsonc，并通过忽略的 .dev.vars 配置 Secret；生产部署使用同一配置的 versions upload 与 versions deploy。

## 工程结构

- src/components：账号编辑、可访问 Modal、消息列表与独立消息组件。
- src/hooks/useMuse.ts：连接生命周期、竞态隔离、发送和停止。
- src/lib/noise.mjs：原生 Web Crypto 与 Noise XX／protobuf 原语。
- src/lib/muse-client.mjs：控制流、聊天流、线程确认、分片与资源释放。
- src/lib/account-api.ts：官方兼容／自定义中转适配和手动刷新。
- src/lib/storage.ts：版本化本机元数据、配置校验、会话模型。
- src/lib/vault.ts：本机加密凭证。
- ../relay/worker.template.mjs：固定官方目标的 API/WS 透传和浏览器适配，保留 MCU 原接口。
- tests/core.test.mjs：凭证、服务器、加密、独立会话和重放隔离。

## 运行边界

个人客户端，非 Meta 官方产品。只有已配对并获得有效 device 凭证的用户可访问官方服务；SDK token 不能绕过官方授权。云端聊天记录与本机记录不同，本机归档不删除云端数据。停止接收只停止前端流，不承诺取消云端任务。聊天记录以明文保存在此浏览器，凭证只有选择保存时才加密持久化。

电脑当前使用 Mihomo TUN；测试不证明国内任意普通 Wi-Fi 无代理可达。语音不在当前版本验收范围。真实新账号注册/手机配对、真实 refresh token 轮换需要该账号所有者完成，不用现有 MCU 共用凭证代替这些验证。

## ESP32 与 Linux 凭证来源

添加账号时选择获取路线，查看「新账号接入」步骤。现有 ESP32 路线保留；Linux 可以不用开发板，但官方首次配对仍需本地 BLE 外设广播和手机 Muse App。来源选项只记录获取方式，不改变协议或自动发起配对。

Linux 官方 pairing.json 可以直接导入；文件不含 device_id 时页面提示补充同设备 identity.json。也可下载 /assets/mori-linux-export.py，在 Linux 执行 sudo python3 mori-linux-export.py --output ./mori-device.json。离线工具只读官方配对与身份文件，只导出需要的字段，不包含身份私钥、不访问网络、不打印 Token、不覆盖已有文件；Linux 输出权限 0600，并交还 sudo 调用用户。网页本身仍是纯 React 静态应用，不需要 Python 服务。

默认中转的 /web/account、/web/refresh、/web/official-noise 与传统 /fetch_vms、/device_token/refresh、/v1/noise 都不区分 Token 来源。将 Linux 凭证导入网页即可使用同一中转。未经修改的官方 Linux SDK 不会自动添加 X-Muse-Relay-Key，因此不能只把其 API 域名改成受密钥保护的 MCU 路由就宣称支持；此版本支持的是 Linux 凭证经网页接入中转。

避免 Linux 服务与网页同时轮换同一 refresh_token；可在导出后停用 Linux 服务。网页刷新保持手动确认。真实 Linux 蓝牙配对与 Linux 输出文件所有权仍待 Linux 主机实测。
