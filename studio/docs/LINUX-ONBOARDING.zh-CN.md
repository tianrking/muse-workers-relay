# Linux 凭证路线接入记录

2026-10-15，生产部署 mori-studio-v1.4：3fd6e9ef-8f9f-4def-a262-a0ce047e9385，100% 流量。

## 实现

- 账号编辑器新增 ESP32 / Linux 凭证来源选择，默认保留 ESP32；来源只影响引导及账号元数据，不改变后端协议。
- Linux 官方 pairing.json 可直接导入，缺少 device_id 时提示补充同设备 identity.json。只读取 device_id，不导入身份私钥。
- Linux 离线导出工具合并 pairing.json 与 identity.json，输出可直接导入的 mori-device.json。不会联网、安装或停止服务，不打印 Token，也不覆盖已有文件。
- 网页仍是纯 React，Python 仅是用户在 Linux 上运行的离线导出工具。
- 默认 Worker 路由接受两种来源的相同设备凭证；没有更改 MCU 路由或既有 ESP32 固件。官方 Linux SDK 本身没有添加共享 relay key，独立运行 SDK 经中转尚未适配与实测。

## 官方实现依据

- https://github.com/facebookincubator/muse-gadget-sdk/blob/main/linux/README.md
- https://github.com/facebookincubator/muse-gadget-sdk/blob/main/linux/src/musegadget/pair.py
- https://github.com/facebookincubator/muse-gadget-sdk/blob/main/linux/src/musegadget/ble_setup.py
- https://github.com/facebookincubator/muse-gadget-sdk/blob/main/linux/src/musegadget/pairing.py
- https://github.com/facebookincubator/muse-gadget-sdk/blob/main/linux/src/musegadget/config.py

首次仍需手机 App 与 BLE 外设。Linux confirm_app 策略省掉实体按钮，不等于省掉账号授权。未发现仅用 SDK token 换取个人 Muse device token 的官方公开路线。

## 验证与边界

TypeScript 和 Vite 生产构建成功；9 项客户端/导出测试及 16 项 Worker 测试通过。新增用例验证 Linux 配置只导入需要字段、忽略文件中服务器地址；离线导出合并设备 ID、不打印凭证、拒绝覆盖已有文件与 SDK token。

Chrome 线上页面已实际打开，验证 ESP32 默认、切换 Linux、查看完整步骤及下载链接；截图 linux-onboarding.png。下载工具通过 HTTP 获取，与本地源码逐字一致。

Chrome 自动化文件导入被扩展缺少 Allow access to file URLs 权限阻止，未扩大权限，因此未完成浏览器文件导入端到端验证。配置解析已由本地测试验证。本次未做真实 Linux 蓝牙配对、Linux 文件所有权实测、Linux 新凭证聊天、MCU 刷机或真实 refresh_token 轮换。
