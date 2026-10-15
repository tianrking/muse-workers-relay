# 已验证的 Muse 联网方法

验证日期：2026-10-14。用户确认热点代理方案成功；随后 USB 状态实测：Wi-Fi Muse-PC，IP 192.168.137.174，RSSI -61 dBm，paired=true，Muse 状态 Connected，服务器 hatch.metaaivm.com。

## 当前固件

原生 ESP-IDF 6.1，Spotpear V1。secrets/muse-relay.h 定义 MUSE_RELAY_DIRECT 1，统一关闭账号、控制、语音和设置 Test connection 的中转；账号接口使用 api.muse.ai，控制和语音使用官方 hatch.metaaivm.com（允许官方 App 下发地址）。official-direct-flash.log 确认烧录和哈希校验成功。保留账号配对，不重置 NVS。Cloudflare/AWS 中转配置保留但未启用；之前服务器端健康检查通过，MCU 中转 TLS 未验证成功。

## 网络路径与操作

圆屏 → 电脑 2.4GHz Wi-Fi 热点 → Mihomo TUN → Clash 代理节点 → Muse 官方服务器。

1. 电脑正常联网，Clash Verge 保持运行且 TUN 开启，选择用户需要的可用代理节点。
2. 在当前登录用户会话运行 tools/hotspot/start-hotspot.ps1。脚本通过 Windows WinRT NetworkOperatorTetheringManager，从 GetInternetConnectionProfile() 取得当前 Mihomo 配置，设置并启动热点。不要用管理员会话替代此步骤：该会话曾只列出物理 Wi-Fi 配置。
3. 热点名称 Muse-PC，密码 12345678（用户指定），频段 2.4GHz，热点网关 192.168.137.1。
4. 圆屏连接此热点，在 Muse 设置中点 Test connection，确认 Connected。主页 Ready 不能作为云端在线证据。
5. 必要时读取 USB 状态：python tools/muse/chat.py --port COM3 --status。只输出网络和连接字段，不输出凭证。

## 排查经验

旧式 HNetCfg COM ICS 手动绑定曾返回 0x80040201。重启 SharedAccess 后 Mihomo 公共共享启用，但热点私有接口 COM 绑定仍失败；最终在普通用户会话使用 Windows 原生 WinRT 热点接口，得到 status Success、state On、source Mihomo，随后用户与 MCU Connected 状态共同确认可用。不要将 COM 接口失败直接等同于原生热点失败，也不要在未验证客户端前宣称代理转发成功。

实体网卡当时为 Intel AX201 无线网卡（发热点）和 Realtek USB FE 有线网卡（未连接）；用户另插网卡当时未出现在系统设备列表。本方法未依赖第三块网卡。

## DNS 与恢复

本次官方域名连接已成功，说明当时实际 DNS/网络/TLS 路径足够支持 Muse 会话；未独立验证每一种 DNS 查询或所有网络。固件使用官方域名，没有启用此前 AWS 固定 IP 中转地址。电脑休眠、重启、Clash/TUN 重启可能需要重新开启热点并测试。不要默认手机自身 VPN 自动共享给热点客户端。


## 2026-10-14 连接不稳定排查

USB 实测用户反馈掉线时 MCU 实际连接 Hera_803，官方请求超时。通过 USB 将 Wi-Fi 明确设置为 Muse-PC 后取得 192.168.137.174，账号接口 HTTP 200，控制 Noise 握手和独立聊天会话成功。修复 main/app.c 全扫描选网顺序：最近使用/用户选中的已保存网络先尝试，其他网络按信号排序作为备用，避免首选热点在扫描中被更强的旧网络抢先。首选连接失败仍允许备用网络，不代表无条件锁定热点。10 项 Wi-Fi 扫描回归检查通过；wifi-preference-flash.log 烧录及哈希校验成功。


### 最终修复与实测结果

仅调整扫描优先级不足：实测首选热点认证超时后仍会回落旧路由器。因此最终固件对 Spotpear V1 使用 JOIN_FIRST，启动和恢复时持续尝试当前首选/已保存列表第一项，其他板卡保留原选择策略；用户可通过设置改选网络。当前为 Muse-PC。热点短暂不可用时不会自动改连其他已保存网络。

最终 wifi-selected-flash.log 烧录哈希校验成功，10 项 Wi-Fi 回归检查通过。重启后热点认证发生 reason=2 重试，最终 13.8 秒取得 192.168.137.174，29.2 秒聊天会话连接成功，观察到 50 秒控制及聊天连接仍保持。随后通过 MCU 发出的两条文字请求分别得到“测试一成功”和“测试二成功”，均完成。该结果验证短期恢复与连续文本消息，不等于长期弱信号或语音压力测试全部完成。官方直连模式保持不变。
