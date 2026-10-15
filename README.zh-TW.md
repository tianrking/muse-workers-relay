# Mori · Spotpear Muse Gadgets

[English](README.md) · [Español](README.es.md) · [繁體中文](README.zh-TW.md)

儲存庫：[tianrking/mori-muse-gadgets](https://github.com/tianrking/mori-muse-gadgets)。

適用於 **Spotpear ESP32-S3 1.8 吋圓形 LCD V1** 的原生 **ESP-IDF 6.1** 韌體、React 網頁聊天客戶端，以及連接 Muse 官方服務的 Cloudflare Worker 中轉。

網頁與中轉可放在同一個 Worker。現有個人部署：[muse.2fast.cfd](https://muse.2fast.cfd/)。也可自行部署。實際連線能力與延遲取決於所在地網路、Cloudflare 和官方服務，未保證全球可達、加速效果或免代理存取。

本專案基於 [Meta Muse Gadget SDK](https://github.com/facebookincubator/muse-gadget-sdk)，參考版本 `8e613f77f3a95a63e70cf8be549db9e589105ea0`，並非 Meta 官方產品。原始說明保留於 [README.upstream.md](README.upstream.md)。

## 專案內容

| 元件          | 用途                                              | 位置                                    |
| ------------- | ------------------------------------------------- | --------------------------------------- |
| Spotpear 韌體 | 圓屏、觸控、音訊介面、SD、BLE 配對及 Muse UI      | `main/`、`components/muse/`、`devices/` |
| Mori Studio   | React + TypeScript 網頁、串流文字及獨立對話       | `studio/`                               |
| 中轉          | 固定官方目的地的 REST／WebSocket 轉送與瀏覽器適配 | `relay/worker.template.mjs`             |
| 工具與證據    | 建置、網路診斷、測試及效能量測                    | `tools/`、`docs/`、`studio/docs/`       |

網頁執行時只需瀏覽器和 Worker，不需要 Python 網頁伺服器。Python 僅用於韌體工具、診斷及選用的 Linux 離線憑證匯出。工作區外部 Arduino 範例是參考資料，不是本專案的執行相依項目。

## 架構與授權

```text
首次配對：裝置中的 SDK token → 與官方手機 App 建立加密 BLE 通道
                            → 取得 device access token + refresh token

ESP32 ── HTTPS / Noise WebSocket ──┐
                                  ├── Worker ── Muse 官方服務
Mori 瀏覽器 ── 網頁適配入口 ──────┘
```

Worker 轉送至 `api.muse.ai` 與官方 VM Noise 端點，不解密 Noise 聊天內容、不儲存裝置 Token，也不接受任意上游網址。瀏覽器入口處理 CORS，並將 WebSocket 子協定中的鑑權轉換為官方要求的標頭。中轉提供傳輸能力，不提供 Muse 帳號或帳號授權。

| 憑證                      | 用途                                         |
| ------------------------- | -------------------------------------------- |
| SDK token，`mgst_…`       | 設定 gadget 並參與官方配對，不能單獨用來聊天 |
| Device access token       | 存取該帳號的 Muse 裝置服務                   |
| Refresh token + device ID | 更新既有裝置憑證                             |
| 中轉密鑰                  | 保護 MCU／自訂中轉入口，與 Muse 帳號授權不同 |

### ESP32：主要接入方式

1. 在 [Muse Gadgets](https://gadgets.muse.ai/settings/sdk-tokens) 建立自己的 SDK token。
2. 存入本機 `secrets/sdk-token.txt`，建置並燒錄韌體。
3. 官方 Muse 手機 App：**Settings → Devices → Developer mode → Add Device**。
4. 選擇 `MuseGadget-XXXXXX`，依圓屏提示確認配對，完成 Wi-Fi 設定。
5. 在 Mori 匯入自己已配對裝置的 JSON，至少包含 `access_token`；手動更新另需 `refresh_token` 與對應的 `device_id`。

裝置會在加密的 BLE 配對確認訊息中把 SDK token 交給手機，手機透過已登入帳號完成授權，再下發裝置憑證。手機自己的登入／授權請求不會因 MCU 設定中轉就自動經過 Worker。配對完成後，日常聊天走網路，不需 BLE 持續連線。

本專案目前沒有已記錄的一鍵 ESP32 憑證匯出功能。本機測試憑證檔已排除 Git；請勿發布或使用他人的帳號憑證。

### Linux：選用的憑證來源

[官方 Linux SDK](https://github.com/facebookincubator/muse-gadget-sdk/tree/main/linux) 可讓 Linux 電腦取代開發板，但仍需本機支援 BLE 外設廣播的藍牙介面、BlueZ、網路及官方手機 App。`confirm_app` 省去實體按鈕，沒有省去帳號授權。

依官方文件安裝 SDK、執行 `sudo musegadget pair` 並在手機完成配對後，可匯入 `/var/lib/musegadget/pairing.json`。另可匯入同裝置的 `identity.json` 補齊 `device_id`，或下載 [離線匯出工具](studio/public/assets/mori-linux-export.py) 後在 Linux 執行：

```sh
sudo python3 mori-linux-export.py --output ./mori-device.json
```

工具只讀本機設定，僅匯出所需欄位，建立新的私有檔案，不列印 Token、不連網、不安裝或停止服務。避免 Linux 服務與網頁同時更新同一個 refresh token。真實 Linux BLE 配對尚未在本機實測。

Linux 憑證匯入 Mori 後可使用相同中轉。未修改的官方 Linux SDK 不會自動附加本專案的中轉鑑權標頭，因此只更改其 API 網域並不等於完成獨立 SDK 中轉適配。本專案不包含 Android 配對助手。

### 為何不能直接使用短 Token 登入？

PC 實測：只有 SDK token 的 `POST /device_token/mint` 請求，直連官方與經過中轉都回傳 **401**，內容完全一致。官方原始碼描述的是使用 user/session 憑證簽發裝置 Token。目前未驗證到可將個人 Muse 登入憑證交給本網頁的公開授權流程；不擷取瀏覽器 Cookie，也不實作私有登入介面。[研究紀錄](relay/pc-login-authorization-research.json)。

## 韌體建置與燒錄

實測 V1 硬體：ESP32-S3、16 MB flash、8 MB octal PSRAM、ST77916 360 × 360 QSPI 螢幕、CST816S 觸控、PCM5100A DAC、MSM261S4030H0R 麥克風及 SDMMC。詳見 [板卡說明](devices/spotpear-s3-180-v1.md) 和 [腳位定義](components/muse/boards/spotpear_v1/spotpear.h)。不宣稱支援 V2 的不同麥克風。

Windows 建置工具需要 `C:/Espressif/tools/eim_idf.json` 中已有 **ESP-IDF 6.1** 安裝項目，不會自行安裝 SDK。工具讀取私有 SDK token，輸出至 `build-spotpear/`。上游原始說明的 6.0.1 是歷史基準，本機 Spotpear 移植使用 6.1。

在儲存庫根目錄，以適當的 Python 執行環境執行：

```powershell
python tools/spotpear.py build
python tools/spotpear.py flash --port COM3
python tools/spotpear.py monitor --port COM3
```

COM3 請換成實際連接埠，燒錄前確認板型。一般燒錄保留 NVS 配對資料；整片清除 flash 會刪除配對，不屬於此快速流程。

將 [後端範例](relay/muse-relay.example.h) 複製至 `secrets/muse-relay.h`。定義 `MUSE_RELAY_DIRECT` 時走官方服務；要走中轉，移除該定義並設定 `MUSE_RELAY_HOST`、`MUSE_RELAY_KEY`，再重新建置及燒錄。不要把真實值寫入受版本控制的範例。

啟用中轉的客戶端涵蓋 VM 查詢、Token 簽發／更新與 Noise 連線。部署新網頁不會自動更新實體 MCU 或其後端設定。

## 使用 Mori Studio

開啟網頁 → 新增帳號 → 選擇 ESP32／Linux 憑證來源 → 匯入配對 JSON → 命名、儲存並連線。預設中轉不要求網頁使用者填寫中轉密鑰，但仍需要自己的 Muse 裝置憑證。進階設定可使用其他相容的 HTTPS 中轉，向外部網域傳送憑證前須明確確認信任。

功能包含：

- 具名帳號設定檔，憑證及本機歷史依帳號隔離。
- 預設使用 UUID 獨立對話，主對話需明確選擇。
- 驗證官方回應中的 session ID 與獨立執行緒狀態。
- 串流 Markdown、程式碼、表格、複製、捲動跟隨及停止接收。
- 搜尋、重新命名、本機封存／還原及 Markdown 匯出。
- 淺色／深色模式、手機側欄及連線診斷。
- 最多三次重連，延遲 2／4／8 秒，不自動重送聊天訊息。
- 選用 AES-256-GCM 本機憑證庫；PBKDF2-SHA256 210,000 次，解鎖密碼不上傳。
- 手動更新憑證，操作前提示與其他裝置共用憑證的影響。

預設憑證只在頁面記憶體中，重新整理即清除；加密保存需主動選擇。對話文字以明文保存在本機瀏覽器。封存不刪除雲端記錄，停止接收不保證取消雲端工作。需使用支援 Web Crypto X25519 的現代 HTTPS 瀏覽器；網頁音訊不在目前驗收範圍內。

### 前端開發

使用符合鎖定 Vite／TypeScript 版本需求的 Node.js；Node 22.18+ 或相容的較新 LTS 是可用基準。另需 pnpm。

```sh
cd studio
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm test
```

開發位址為 `http://127.0.0.1:5173`。在 `studio/.env.local` 設定 `VITE_DEV_ADAPTER_URL` 指向自己的 Worker，Vite 會代理 REST 及 WebSocket。本機環境設定檔排除 Git。

## 自行部署 Worker 與網頁

先建置 `studio`，再使用自己的 Cloudflare 帳號及通用範本：

```sh
cd relay
pnpm install --frozen-lockfile
# 複製 wrangler.example.jsonc 至 wrangler.local.jsonc，設定自己的 Worker 名稱。
pnpm exec wrangler login
pnpm exec wrangler deploy --config wrangler.local.jsonc
pnpm exec wrangler secret put MUSE_RELAY_KEY --config wrangler.local.jsonc
```

第一次部署建立 Worker；Secret 尚未設定時請求會回傳 503。依 Wrangler 提示輸入強度足夠的私有中轉密鑰，不要寫入 JavaScript 或 Git。`ASSETS` 會將 `../studio/dist` 與 API 部署在同一服務。

workers.dev 位址可同時作為網頁及中轉入口，也可在 Cloudflare 綁定自己的網域。同源瀏覽器請求自動允許；前端放在別處時，在 `BROWSER_ORIGINS` 加入精確來源，不支援萬用字元。變更設定或重新建置資源後需再次部署。

`wrangler.test-account.jsonc` 與 `wrangler.jsonc` 分別保留現有／歷史個人部署資訊，其他使用者不應原樣套用其中帳號。請從 `wrangler.example.jsonc` 開始。Cloudflare 方案與配額仍適用，未承諾免費或無限使用。

| 路由                             | 鑑權                                        |
| -------------------------------- | ------------------------------------------- |
| `GET /health`                    | Worker Secret 設定完成後公開                |
| `GET /web/account`               | 呼叫者裝置 bearer + 允許的瀏覽器來源        |
| `POST /web/refresh`              | 呼叫者 refresh bearer + 允許的瀏覽器來源    |
| `WS /web/official-noise?vm_id=…` | 子協定內 VM token + 允許的 Origin           |
| `GET /fetch_vms`                 | Muse bearer + 中轉密鑰                      |
| `POST /device_token/mint`        | 適用的 Muse bearer + 中轉密鑰               |
| `POST /device_token/refresh`     | Refresh bearer + 中轉密鑰                   |
| `WS /v1/noise?vm_id=…`           | Muse bearer + 中轉密鑰                      |
| `WS /web/noise?vm_id=…`          | 子協定內 VM token／中轉密鑰 + 允許的 Origin |

內部設定 `mode=official` 是保留的相容欄位，指同源官方服務適配入口，介面顯示為預設中轉；並非瀏覽器直連官方。[詳細介面規格](relay/BROWSER-API.zh-CN.md)。

## 驗證結果與限制

以下狀態記錄於 **2026-10-15**：

| 項目       | 已驗證                                              | 限制                                                        |
| ---------- | --------------------------------------------------- | ----------------------------------------------------------- |
| 韌體       | IDF 6.1 建置／燒錄，使用者確認畫面及 UI，曾完成對話 | DAC 可聽輸出未確認；本次 COM4 燒錄及 Online 狀態已確認      |
| 顯示       | 平均更新工作量由 105.41 ms 降至 39.33 ms            | LVGL 更新量測，不代表面板 FPS                               |
| 網頁       | 真實帳號／Noise、主對話、獨立對話、自訂中轉及續接   | 多個設定檔使用同帳號，不代表新帳號註冊                      |
| 測試       | 9 項客戶端／匯出 + 16 項 Worker 通過                | 不等於硬體或長時間可靠性驗收                                |
| 授權       | 短 Token 簽發 401，既有裝置查詢經中轉 200           | 網頁登入直接取裝置 Token 未打通                             |
| Linux      | 匯入／匯出解析與檔案處理                            | 真實 BLE、Linux 檔案所有權未實測                            |
| 網路       | PC 代理路徑及先前 MCU 中轉對話                      | omg 熱點 Online，使用者確認無代理；其他網路及全球可達未驗證 |
| 更新／重連 | 手動更新、有限次重試已實作                          | 真實共用 Token 輪換與強制斷線耐久未驗收                     |

歷史韌體主機測試為 129 通過、28 略過；完整上游 POSIX 測試未在此 Windows 主機通過。Chrome 自動匯入因擴充功能未開啟檔案網址權限而受阻，解析器已有本機測試。詳見 [網頁紀錄](studio/docs/VERIFICATION.zh-CN.md)、[Linux 紀錄](studio/docs/LINUX-ONBOARDING.zh-CN.md)、[中轉紀錄](relay/LIVE-VERIFICATION.zh-CN.md) 與 [效能量測](docs/perf/results.md)。

現有網頁部署為 `mori-studio-v1.4`，版本 `3fd6e9ef-8f9f-4def-a262-a0ce047e9385`。實體 MCU 現已燒錄 muse.2fast.cfd，於 omg 手機熱點回報 Connected / Online，使用者確認未開代理／VPN 並可使用。詳見 [硬體驗證紀錄](relay/MCU-HOTSPOT-VERIFICATION.md)；尚不代表長時間或全球網路可靠性驗收。

## 排查與發布

- 首頁 Ready 不代表雲端連線成功，請查看 HTTP 與 Noise 診斷。
- 401 需分別檢查 SDK Token、裝置 Token、有效期／撤銷狀態與中轉密鑰。
- CORS／WS 錯誤請檢查 HTTPS、精確 Origin、VM ID 及中轉契約；不要把憑證放在網址。
- 避免 MCU、Linux 服務與網頁同時更新同一份憑證。
- PC 能連線不代表 MCU 的 Wi-Fi 能連線。[Windows 代理熱點操作紀錄](docs/NETWORK-HOTSPOT.zh-CN.md) 保留已成功的方法；重用前應檢查其本機路徑及熱點密碼。

應提交原始碼、鎖定檔、範本與說明，保留 `secrets/`、建置產物、封包擷取、`.dev.vars`、本機 Wrangler 設定與 `.env.local` 在本機。韌體二進位含有 SDK token，不應隨意發布。推送前檢查受追蹤檔案和歷史中的真實憑證。儲存庫保留逐步提交歷史，作者與提交者統一使用 tianrking 的 GitHub 身分。

## 授權與來源

SDK 衍生程式碼保留 Meta 著作權與 [Apache-2.0](LICENSE)。Jollybot 虛擬替身不受 SDK 的 Apache 授權涵蓋，發布資源或韌體前需確認上游條款。相依元件各自保有其授權，詳見 [原始說明](README.upstream.md)。Muse 服務及 SDK token 另受 [Gadget SDK 條款](https://gadgets.muse.ai/sdk-terms) 規範；開源程式碼不等於無限制存取服務或分享帳號憑證的許可。

上游保留的 `dev_signing_key.pem` 是已公開的開發用途簽章私鑰，不是私有正式環境憑證。請勿用於正式環境信任，也不要發布自己的正式簽章金鑰。
