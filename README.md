# Mori · Muse Gadgets for Spotpear

[English](README.md) · [Español](README.es.md) · [繁體中文](README.zh-TW.md)

Native **ESP-IDF 6.1** firmware for the **Spotpear ESP32-S3 1.8-inch round LCD V1**, a React browser chat client, and a Cloudflare Worker for Muse device traffic.

Website and relay share one Worker. Current personal deployment: [muse.2fast.cfd](https://muse.2fast.cfd/). Self-hosting is supported. Reachability and latency depend on your network, Cloudflare and the official upstream; worldwide acceleration is not guaranteed.

Based on [Meta Muse Gadget SDK](https://github.com/facebookincubator/muse-gadget-sdk), reference revision `8e613f77f3a95a63e70cf8be549db9e589105ea0`. This is an independent project, not an official Meta product. The original guide is preserved in [README.upstream.md](README.upstream.md).

## Components

| Component          | Purpose                                                                       | Directory                               |
| ------------------ | ----------------------------------------------------------------------------- | --------------------------------------- |
| Spotpear firmware  | Display, touch, audio interfaces, SD, BLE provisioning and Muse UI            | `main/`, `components/muse/`, `devices/` |
| Mori Studio        | React + TypeScript browser client with streaming text and independent threads | `studio/`                               |
| Relay              | Fixed-destination REST and WebSocket forwarding with a browser adapter        | `relay/worker.template.mjs`             |
| Tools and evidence | Build wrapper, network diagnostics, tests and measurements                    | `tools/`, `docs/`, `studio/docs/`       |

The website is static browser code plus a Worker: no Python web server. Python is used for firmware tooling and the optional offline Linux credential exporter. Arduino demos outside this repository are reference material, not runtime dependencies.

## Architecture and authorization

```text
First pairing: SDK token in gadget → encrypted BLE with official Muse phone app
                                  → device access token + refresh token

ESP32 ── HTTPS / Noise WebSocket ──┐
                                  ├── Worker ── official Muse services
Mori browser ── browser adapter ───┘
```

The Worker forwards to `api.muse.ai` and the official VM Noise endpoint. It does not decrypt Noise chat data, store device tokens, or proxy arbitrary URLs. Browser adaptation handles CORS and translates WebSocket authentication subprotocols into upstream headers. A relay supplies transport, not a Muse account.

| Credential                | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| SDK token, `mgst_…`       | Configure a gadget and participate in pairing; cannot chat alone        |
| Device access token       | Access the account's Muse device services                               |
| Refresh token + device ID | Rotate an existing device credential pair                               |
| Relay key                 | Protect traditional MCU/custom routes; separate from Muse authorization |

### ESP32: primary onboarding

1. Create your own SDK token at [Muse Gadgets](https://gadgets.muse.ai/settings/sdk-tokens).
2. Save it locally in `secrets/sdk-token.txt`, build and flash the board.
3. In the official phone app: **Settings → Devices → Developer mode → Add Device**.
4. Select `MuseGadget-XXXXXX`, confirm on the round screen and complete Wi-Fi setup.
5. For Mori, import your own paired JSON containing `access_token`. Include `refresh_token` and its matching `device_id` for manual refresh.

The gadget sends its SDK token to the phone in an encrypted BLE confirmation record. The phone provides account authorization and returns device credentials. The phone's own cloud requests do not automatically follow MCU relay settings. After provisioning, normal chat uses the network, not BLE.

There is no documented one-click ESP32 credential export in this project yet. Existing local credential files are excluded from Git. Never distribute another user's credentials.

### Linux: optional credential source

The [official Linux SDK](https://github.com/facebookincubator/muse-gadget-sdk/tree/main/linux) replaces the development board with a Linux machine. It still needs a local BLE peripheral-capable adapter, BlueZ, network access and the official phone app. Its `confirm_app` policy removes a physical button, not account authorization.

After installing the official SDK and running `sudo musegadget pair`, import `/var/lib/musegadget/pairing.json`. The editor also accepts the matching `identity.json` to supplement `device_id`. Alternatively, download [our offline exporter](studio/public/assets/mori-linux-export.py) and run on Linux:

```sh
sudo python3 mori-linux-export.py --output ./mori-device.json
```

The exporter reads local files, exports only required fields, creates a private new file, and never prints tokens. It neither installs nor stops services. Avoid simultaneous refresh-token rotation by the Linux service and browser. Real Linux BLE pairing remains untested here.

Linux credentials imported into Mori use the same relay. The unmodified official Linux SDK does not add our relay key; changing its API hostname alone is not a complete standalone SDK relay adaptation. No Android pairing assistant is included.

### Why not sign in with the short token?

PC tests found SDK-token-only `POST /device_token/mint` returns **401**, directly and through the relay with identical responses. Official source describes minting from a user/session credential. No public personal-Muse web login flow has been verified to supply that credential to this app. We do not extract browser cookies or implement private login APIs. See [the research record](relay/pc-login-authorization-research.json).

## Firmware build and flash

The measured V1 board has ESP32-S3, 16 MB flash, 8 MB octal PSRAM, ST77916 360 × 360 QSPI display, CST816S touch, PCM5100A DAC, MSM261S4030H0R microphone and SDMMC. See [board setup](devices/spotpear-s3-180-v1.md) and [pin definitions](components/muse/boards/spotpear_v1/spotpear.h). V2 microphone compatibility is not claimed.

The Windows wrapper requires an installed **ESP-IDF 6.1** entry in `C:/Espressif/tools/eim_idf.json`; it does not install the SDK. It reads the private SDK token and uses `build-spotpear/`. Historical upstream instructions use 6.0.1; this local Spotpear profile uses 6.1.

From the repository root with a suitable Python interpreter:

```powershell
python tools/spotpear.py build
python tools/spotpear.py flash --port COM3
python tools/spotpear.py monitor --port COM3
```

Replace COM3 with your actual device port and identify the attached board before flashing. Normal flashing preserves pairing in NVS. Erasing flash removes it and is not part of this guide.

### Select official direct or relay

Copy [the backend example](relay/muse-relay.example.h) to `secrets/muse-relay.h`. Defining `MUSE_RELAY_DIRECT` selects official services. To use a relay, remove that definition, set `MUSE_RELAY_HOST` and `MUSE_RELAY_KEY`, then rebuild and flash. Keep real values out of the tracked example.

The relay-enabled client covers VM lookup, mint, refresh and Noise connections. Publishing the website does not update the physical MCU or its stored backend.

## Mori Studio

Open the website → Add account → choose ESP32/Linux credential source → import paired JSON → name, save and connect. The default hosted relay requires no relay key from webpage users; each user still supplies their own Muse device credential. Advanced settings support a compatible custom HTTPS relay and require trust confirmation for another origin.

Features:

- Named account profiles with isolated credentials and local histories.
- UUID-backed independent conversations by default; main chat must be selected explicitly.
- Server acknowledgement validation of session ID and thread status.
- Streaming Markdown, code blocks, tables, copy, scroll follow and stop receiving.
- Search, rename, local archive/restore and Markdown export.
- Light/dark appearance, mobile sidebar and connection diagnostics.
- Three reconnect attempts with 2/4/8-second backoff; no automatic chat resend.
- Optional local credential vault: AES-256-GCM, PBKDF2-SHA256 with 210,000 iterations; unlock passwords stay local.
- Manual refresh with an explicit warning about credentials shared with another device.

Credentials default to page memory and disappear on reload. Optional encrypted persistence is local to the browser. Chat text is stored locally in plain text. Local archive does not delete cloud records, and stop receiving does not guarantee upstream task cancellation. Use a modern HTTPS browser with Web Crypto X25519 support. Browser audio is outside current acceptance.

### Frontend development

Use Node.js compatible with the pinned Vite/TypeScript versions (Node 22.18+ or a supported newer LTS is a practical baseline) and pnpm.

```sh
cd studio
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm test
```

Development uses `http://127.0.0.1:5173`. Set `VITE_DEV_ADAPTER_URL` in `studio/.env.local` to your Worker; Vite proxies REST and WebSocket requests. Local environment files are ignored.

## Self-host the Worker and website

Build `studio` first. Use your own Cloudflare account and the generic config:

```sh
cd relay
pnpm install --frozen-lockfile
# Copy wrangler.example.jsonc to wrangler.local.jsonc; choose your Worker name.
pnpm exec wrangler login
pnpm exec wrangler deploy --config wrangler.local.jsonc
pnpm exec wrangler secret put MUSE_RELAY_KEY --config wrangler.local.jsonc
```

The first deploy creates the Worker; requests return 503 until its Secret is set. Enter a strong private relay key at the prompt. Never embed it in JavaScript or Git. `ASSETS` serves `../studio/dist` alongside the API.

The workers.dev address is usable for both website and relay. Optionally bind your own custom domain in Cloudflare. Same-origin browser requests are accepted automatically; list exact external frontend origins in `BROWSER_ORIGINS` when needed. Wildcards are not supported. Redeploy after config or asset changes.

`wrangler.test-account.jsonc` records the current personal deployment and `wrangler.jsonc` an older one. Do not deploy those account-specific files unchanged for another user. Start with `wrangler.example.jsonc`. Cloudflare quotas and plan limits apply; free or unlimited service is not promised.

| Route                            | Authorization                                          |
| -------------------------------- | ------------------------------------------------------ |
| `GET /health`                    | Public, after Worker Secret configuration              |
| `GET /web/account`               | Caller device bearer + allowed browser context         |
| `POST /web/refresh`              | Caller refresh bearer + allowed browser context        |
| `WS /web/official-noise?vm_id=…` | VM token in subprotocol + allowed Origin               |
| `GET /fetch_vms`                 | Muse bearer + relay key                                |
| `POST /device_token/mint`        | Suitable Muse bearer + relay key                       |
| `POST /device_token/refresh`     | Refresh bearer + relay key                             |
| `WS /v1/noise?vm_id=…`           | Muse bearer + relay key                                |
| `WS /web/noise?vm_id=…`          | VM token and relay key in subprotocol + allowed Origin |

Internal profile `mode=official` means the same-origin official-service adapter, displayed as Default relay, not browser-to-official direct access. See [the detailed API contract](relay/BROWSER-API.zh-CN.md).

## Verification and limits

Status recorded **2026-10-15**:

| Area              | Verified                                                                   | Limits                                                                                      |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Firmware          | IDF 6.1 build/flash, user-confirmed screen/UI and successful conversations | Audible DAC output unverified; current COM4 flash and Online status verified                |
| Display           | Mean refresh work improved from 105.41 ms to 39.33 ms                      | LVGL refresh measurement, not panel FPS                                                     |
| Browser           | Account/Noise, main and independent replies, custom relay, thread resume   | Same account used in different profiles; not new-account registration                       |
| Tests             | 9 client/export + 16 Worker tests passed                                   | Local contracts do not prove long-term reliability                                          |
| Authorization     | SDK-only mint 401; existing device lookup via relay 200                    | Web-login-to-device-token flow not verified                                                 |
| Linux             | Import/export parsing and handling                                         | Real BLE pairing and Linux file ownership untested                                          |
| Network           | PC proxy path and earlier MCU relay conversations                          | MCU Online on omg, reported without proxy; other networks and worldwide coverage unverified |
| Refresh/reconnect | Manual refresh and bounded retry implemented                               | Shared-token rotation and forced-drop endurance not accepted                                |

Historical firmware host tests reported 129 passed and 28 skipped; the complete upstream POSIX suite did not pass on this Windows host. Evidence: [browser](studio/docs/VERIFICATION.zh-CN.md), [Linux](studio/docs/LINUX-ONBOARDING.zh-CN.md), [relay](relay/LIVE-VERIFICATION.zh-CN.md), [display](docs/perf/results.md). Chrome automated file import was blocked by missing extension file-URL permission; import parsing has local test coverage.

Current web deployment: `mori-studio-v1.4`, version `3fd6e9ef-8f9f-4def-a262-a0ce047e9385`. The MCU has now been flashed with muse.2fast.cfd and returned Connected / Online on the omg phone hotspot. The user confirmed no proxy/VPN and reported the device usable. See [the hardware verification record](relay/MCU-HOTSPOT-VERIFICATION.md); this does not establish worldwide reachability or a long-duration reliability result.

## Troubleshooting

- Ready is not proof of cloud connectivity: check account HTTP and Noise diagnostics.
- For 401, check credential type, expiry/revocation and relay key separately.
- For cross-origin/WS errors, check HTTPS, Origin allowlist, VM ID and compatible relay contract. Credentials do not belong in query strings.
- Avoid simultaneous refresh of the same credentials from MCU, Linux and browser.
- PC reachability does not prove MCU Wi-Fi reachability. See [the Windows proxy-hotspot procedure](docs/NETWORK-HOTSPOT.zh-CN.md); review its machine-specific paths and hotspot credentials before reuse.

## Publishing and attribution

Commit source, lockfiles, templates and documentation. Keep `secrets/`, builds, packet captures, `.dev.vars`, local Wrangler settings and `.env.local` private. Firmware binaries contain the SDK token. Before pushing, inspect tracked files and history for actual credentials. The current repository has incremental local commits and no remote; add the owner's GitHub URL when provided.

SDK-derived code retains Meta copyright and [Apache-2.0](LICENSE). Preserve upstream notices. The Jollybot avatar is not covered by the SDK Apache license; review upstream asset terms before distributing firmware/assets. Dependencies retain their own licenses; see [the preserved upstream guide](README.upstream.md). Muse service access and SDK tokens have separate [Gadget SDK Terms](https://gadgets.muse.ai/sdk-terms). The source license does not grant unrestricted service access or permission to share account credentials.

The inherited `dev_signing_key.pem` is a publicly distributed development signing private key, not a private production credential. Never use it for production trust or publish your own release signing keys.
