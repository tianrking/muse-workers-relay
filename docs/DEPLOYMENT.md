# Deploy and verify the relay

This guide deploys the Worker first. Studio and hardware are optional clients. The example name is `mori-muse-relay`; choose your own name. The existing personal `muse.2fast.cfd` service is not automatically configured by these examples.

## 1. Choose a deployment

| Choice | Configuration | Needs a Studio build? | Result |
| --- | --- | --- | --- |
| Relay only (default) | `relay/wrangler.example.jsonc` | No | Account APIs, WebSocket relay and browser adapters; no homepage |
| Relay + demo | `relay/wrangler.web.example.jsonc` | Yes | Identical relay plus Mori static files on the same origin |
| Dashboard editor | Copy `relay/worker.template.mjs` | No | Relay only, without local deployment tools |

The Worker source has no external runtime imports. Do not copy ignored `worker.js` / `worker.mjs` from someone's local installation: old generated files may contain a private relay key.

## 2. Deploy with Wrangler

Install Node.js 22.18+ and pnpm, and sign into the Cloudflare account that will own the service. Acquire the repository using an account with access (it may be private):

```sh
git clone git@github.com:tianrking/muse-workers-relay.git
cd muse-workers-relay/relay
pnpm install --frozen-lockfile
cp wrangler.example.jsonc wrangler.local.jsonc
```

PowerShell: replace the last command with `Copy-Item wrangler.example.jsonc wrangler.local.jsonc`. If you already have a local config, edit it instead of overwriting it.

Edit `wrangler.local.jsonc`:

- `name`: your chosen Worker name.
- `main`: keep `worker.template.mjs`.
- `compatibility_date`: keep the tested example date unless intentionally upgrading.
- `workers_dev`: enables a workers.dev address; a custom domain is optional.
- `observability.enabled`: examples disable collection; the source does not log tokens or payloads.
- `vars.BROWSER_ORIGINS`: exact external frontend Origins, encoded as a JSON string array. Same-origin browser requests do not need an extra entry. For native-only use, `"[]"` is a suitable value; this does not disable same-origin adapters.

Authenticate, check and deploy:

```sh
pnpm exec wrangler login
pnpm test
pnpm exec wrangler deploy --dry-run --config wrangler.local.jsonc
pnpm exec wrangler deploy --config wrangler.local.jsonc
pnpm exec wrangler secret put MUSE_RELAY_KEY --config wrangler.local.jsonc
```

At the secret prompt enter your own cryptographically random key. One generation option is `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`; keep the output private and configure it in clients. This is a relay key, not an SDK/device/VM token. Do not commit it or place it in `vars`.

On a new deployment, all requests return 503 until the secret is set. `wrangler secret put` creates and deploys a new Worker version immediately; do not run it casually against a production service just to inspect configuration. See [Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

Wrangler prints the workers.dev URL. Your computer can stop running after deployment. The source does not require a VPS or a persistent local process.

## 3. Dashboard-only alternative

Create a Worker in Workers & Pages, open its code editor and replace the starter module with the complete contents of `relay/worker.template.mjs`. Save/deploy. In Worker **Settings → Variables and Secrets**, add a **Secret** named `MUSE_RELAY_KEY`; save/deploy the setting. For a separate browser frontend, add `BROWSER_ORIGINS` as a text variable containing its exact Origin array. Configure logs/observability consistently with your intended deployment.

This installs the relay only. Pasting the module does not upload Studio assets. To serve the demo, use the web-config build/upload flow below.

## 4. Optional custom domain

In the chosen Worker: **Settings → Domains & Routes → Add → Custom Domain**, enter a hostname in your own active Cloudflare zone, such as `muse.example.com`. Cloudflare creates the routing DNS record and certificate. A conflicting existing CNAME must be resolved before adding the hostname. No VPS address or manually created origin A record is required. See [Cloudflare Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

For reproducible domain configuration, add this to your local Wrangler config and redeploy:

```json
"routes": [
  { "pattern": "muse.example.com", "custom_domain": true }
]
```

This is a property fragment, not a complete JSON file. Use your own domain. Confirm `/health` on the final domain and change both account and WS client settings to that host.

## 5. Configure a native client

| Setting | Value |
| --- | --- |
| Account API base | `https://<your-host>` |
| Noise endpoint | `wss://<your-host>/v1/noise?vm_id=<official-vm-id>` |
| Relay authorization | `X-Muse-Relay-Key: <your-relay-key>` on account requests and WS handshake |
| Muse account authorization | Original device access Bearer for `/fetch_vms`; appropriate authorization for mint/refresh |
| Muse VM authorization | `Authorization: Bearer <vm_auth_token>` from account results for Noise |

Do not keep using the official `vm_ws_url` unchanged if the goal is to route Noise through the relay. Do not send a device access token where a VM token is required. Preserve bodies and `X-API-Version` from the official client protocol. The relay does not add your key automatically or perform the client-side Noise/chat implementation. Our adapted ESP32 integration is preserved on [test/esp32-spotpear](https://github.com/tianrking/muse-workers-relay/tree/test/esp32-spotpear); other clients may require equivalent configuration/code changes.

## 6. Verify in layers

Start without a credential:

```sh
curl -i https://<your-host>/health
```

Expect HTTP 200 with service/version metadata after secret setup. Opening `/` on a relay-only deployment does not show a webpage; 401 without a key, or 404 with a key, is expected. It does not mean the API deployment failed.

Then use legitimate credentials, supplied via your local client or privately set environment variables. For POSIX shells:

```sh
curl -i "$MUSE_RELAY_URL/fetch_vms" \
  -H "X-Muse-Relay-Key: $MUSE_RELAY_KEY" \
  -H "Authorization: Bearer $MUSE_DEVICE_TOKEN" \
  -H "X-API-Version: 1.0.0"
```

PowerShell uses `curl.exe` and `$env:VARIABLE` syntax instead. The response contains VM credentials; do not publish the output. Avoid plaintext tokens in shared command history. Confirm each stage:

1. `/health` 200: configured Worker is reachable.
2. `/fetch_vms` 200 with VM information: account authorization succeeded.
3. `/v1/noise` 101: WebSocket upgraded using the selected VM token.
4. Client reports Noise and registration success: encrypted protocol is established.
5. A unique test message receives the expected new reply: chat works end to end.
6. Repeat on the actual target network, observe idle/reconnect behavior, and test audio separately if needed.

An HTTP curl command cannot complete steps 4–5. Use an adapted gadget, a protocol-aware PC client or the optional Studio. Never infer worldwide reachability from a PC using a VPN or from a single hotspot test.

| Symptom | Check |
| --- | --- |
| 503 `Relay secret not configured` | Secret exists on the correct Worker/environment |
| 401 `Unauthorized` | Native/custom route relay key matches the deployed Secret |
| 401 `Muse authorization required` | Valid Bearer header is present |
| Upstream 401/403 | Credential type/expiry, VM authorization and official account/egress restrictions; errors are preserved |
| 403 `Origin not allowed` | Same-origin adapter usage or exact external Origin allowlist |
| 400 `Invalid VM id` | One valid `vm_id`, no duplicate/additional WS query parameters |
| 426 `WebSocket required` | Real WebSocket Upgrade instead of a plain GET |
| 502 `Upstream unavailable` | Worker could not fetch the upstream; separate this from client-to-Worker DNS/TLS failures |
| DNS/TLS timeout before HTTP | Client network reachability and certificate/time settings; no API token fixes this |
| Noise succeeds but no reply | Client registration, stream framing, thread acknowledgement and official application errors |

## 7. Optional demo on the same relay

From the repository root:

```sh
cd studio
pnpm install --frozen-lockfile
pnpm test
pnpm build
cd ../relay
pnpm install --frozen-lockfile
```

For a new deployment, copy `wrangler.web.example.jsonc` to `wrangler.local.jsonc`, set your Worker name and follow the deployment/secret steps above. To extend an existing relay, keep its name, domain and variables and add the example's `assets` object; do not overwrite the existing local config or rotate its Secret unnecessarily.

Visit `/`, add a profile and import your own paired device credentials. “Default relay” uses this site's Worker and does not ask for the relay's shared key. “Custom relay” uses your specified HTTPS origin and its key, with the frontend Origin allowed by that server. Select a Muse and create an independent conversation; select main explicitly when intended. See [screenshots and verification scope](SCREENSHOTS.md).

## Updates and operating scope

Run relay tests and dry-run before deploying source updates with the same local config. For demo updates, rebuild Studio first. Keep local configs, `.dev.vars` and tokens out of Git; a local development Secret is not automatically a deployed Secret.

Plan limits, official service policy and your own access/usage controls still apply. This project has no per-user quota, automatic regional failover or delivery queue. Review the [architecture and trust boundaries](ARCHITECTURE.md) before sharing a deployment. All commands here are documentation; editing these docs does not redeploy the existing service.
