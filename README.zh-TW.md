# Mori · Muse Workers 中轉

[English](README.md) · [Español](README.es.md)

本專案的核心是 **Cloudflare Workers 中轉服務**，負責轉送 Muse 帳號 API 和 Noise 加密 WebSocket。Mori Studio 是可選的 React 網頁客戶端，可由同一個 Worker 提供。本專案為社群獨立實作，非 Meta 官方服務。

## 專案結構

| 分支／目錄 | 用途 |
| --- | --- |
| `main` | 與硬體無關的中轉核心、測試及文件 |
| `relay/` | Worker 原始碼、部署範本和協定測試 |
| `studio/` | 可選 React + TypeScript 聊天頁，無需應用程式伺服器 |
| [`test/esp32-spotpear`](https://github.com/tianrking/muse-workers-relay/tree/test/esp32-spotpear) | 分支拆分前的完整 ESP32 SDK、Spotpear V1 適配、燒錄工具與硬體紀錄 |

部署中轉不需要 ESP-IDF 或開發板。ESP32 作為獨立整合測試分支保留；先前的韌體提交仍在共用 Git 歷史中。

## 運作方式

裝置或網頁透過 HTTPS／WebSocket 連到你的 Worker，再由 Worker 轉送至固定的 Muse 官方目標：帳號服務 `api.muse.ai`、Noise 服務 `hatch.metaaivm.com`。

帳號請求保留原始請求內容及上游 HTTP 狀態；WebSocket 升級直接傳遞，後續 Noise 應用資料維持端到端加密。Worker 不解密聊天或語音。Cloudflare 會終止外層 TLS，因此可見授權標頭，但不持有 Noise 工作階段金鑰。

共用中轉金鑰用於原生／自訂中轉路由，每個使用者仍須提供自己的有效 Muse 憑證。網頁介面另有 Origin 檢查及 WebSocket 授權轉接；Origin 白名單不是使用者身分驗證，也不能當作私人服務的隔離邊界。

## 只部署中轉

需要 Node.js 22.18+ 與 pnpm。從專案根目錄執行：

```sh
cd relay
pnpm install --frozen-lockfile
cp wrangler.example.jsonc wrangler.local.jsonc
pnpm exec wrangler login
pnpm exec wrangler deploy --config wrangler.local.jsonc
pnpm exec wrangler secret put MUSE_RELAY_KEY --config wrangler.local.jsonc
```

PowerShell 可用 `Copy-Item wrangler.example.jsonc wrangler.local.jsonc`。部署前修改副本中的 Worker 名稱。Secret 提示時輸入自己產生的隨機中轉金鑰，原生客戶端使用相同金鑰。未設定 Secret 時回傳 503；本機設定檔與 `.dev.vars` 不會提交到 Git。

用 `https://<你的-worker>/health` 檢查服務與網路可達性。健康檢查不代表帳號授權或聊天成功。可在 Cloudflare 加入自訂網域，也可使用可達的 workers.dev 網址。

## 可選：同一 Worker 提供聊天頁

從根目錄進入 `studio/`，執行 `pnpm install --frozen-lockfile`、`pnpm build`。接著進入 `relay/` 安裝依賴，將 `wrangler.web.example.jsonc` 複製為 `wrangler.local.jsonc`，修改名稱後依上述指令部署並設定 Secret。此版本綁定 `studio/dist` 靜態資源。

網頁預設使用同站中轉，使用者只需提供自己的 Muse 憑證，無需輸入共用中轉金鑰；金鑰不會嵌入 JavaScript。外站前端需將完整 Origin 加入 `BROWSER_ORIGINS` JSON 字串陣列，同站自動允許。

現有個人部署為 [muse.2fast.cfd](https://muse.2fast.cfd)；自行部署請使用自己的網域與 Secret。Studio 支援多帳號檔案、Muse 選擇、獨立 UUID 對話、明確選擇主對話、串流 Markdown、自訂中轉與可選本機加密憑證。詳見 [Studio 說明](studio/README.zh-CN.md)。

## 介面與授權

| 路徑 | 授權 |
| --- | --- |
| `GET /health` | 設定 Worker Secret 後公開 |
| `GET /fetch_vms` | Muse Bearer + `X-Muse-Relay-Key` |
| `POST /device_token/mint` | 合適的 Muse Bearer + 中轉金鑰 |
| `POST /device_token/refresh` | Refresh Bearer + 中轉金鑰 |
| `WS /v1/noise?vm_id=…` | VM Token + 中轉金鑰 |
| `GET /web/account`、`POST /web/refresh` | 對應 Bearer + 允許的 Origin |
| `WS /web/official-noise?vm_id=…` | VM Token 子協定 + 允許的 Origin |
| `WS /web/noise?vm_id=…` | VM Token 與中轉金鑰子協定 + 允許的 Origin |

瀏覽器傳送 `muse-v1` 及 `muse-auth.` 加上 base64url 編碼的 JSON：`{"token":"<vm_auth_token>","key":"<relay_key>"}`。同站轉接路徑可省略 `key`。Worker 選擇 `muse-v1`，將授權轉為官方標頭，不將含憑證的子協定轉交上游。Token 不放在 URL。

短版 `mgst_…` SDK Token 不能直接聊天。仍須透過官方 Muse App 完成裝置配對取得 device access token，再由帳號 API 取得 VM 憑證。Studio 可匯入 ESP32／Linux 配對憑證；本專案未替代官方登入或繞過配對。未修改的客戶端可能還需要設定中轉標頭與路徑，不能一概只改網域。

## 驗證與限制

在 `relay/` 執行 `pnpm test`、`pnpm exec wrangler deploy --dry-run --config wrangler.example.jsonc`；在 `studio/` 執行 `pnpm test`、`pnpm build`。目前有 16 項 Worker 協定測試與 9 項 Studio 測試；模擬測試不能替代部署後的真實驗證。

先前 PC 實測已完成中轉帳號查詢、WebSocket 101、Noise 握手與文字回覆。硬體分支保留 Spotpear 經使用者一般手機熱點連上中轉的紀錄。語音尚未完整驗收；本次分支整理不變更線上部署或韌體。

中轉仍需裝置可達 Cloudflare，且官方上游接受 Cloudflare 出口。不能保證全球所有網路可達或延遲一致。Worker 不儲存帳號憑證、不快取帳號回應，部署範本關閉觀測日誌；目前沒有內建按使用者配額管理，分享服務前應依自己的方案設定存取控制。

## 授權與來源

參閱 [LICENSE](LICENSE)、各檔案聲明及 [官方 Muse Gadget SDK](https://github.com/facebookincubator/muse-gadget-sdk)。ESP32 分支保留上游韌體授權與版權。SDK Token、裝置憑證、正式簽署私鑰及中轉 Secret 均不得提交。
