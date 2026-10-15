# Relay wire contract

Implementation: [worker.template.mjs](../relay/worker.template.mjs). This document describes the implemented relay routes, not a new official Muse API specification. All credentials and IDs below are **placeholders**. Successful token issuance and additional official response fields depend on the upstream service.

## One origin, two upstream services

```text
https://<relay-host>/fetch_vms               → https://api.muse.ai/fetch_vms
https://<relay-host>/device_token/mint       → https://api.muse.ai/device_token/mint
https://<relay-host>/device_token/refresh    → https://api.muse.ai/device_token/refresh
wss://<relay-host>/v1/noise?vm_id=<id>       → official /v1/noise at hatch.metaaivm.com
```

The relay has no `target`, `url`, region or account-owner-token parameter. Both upstream hosts are fixed in source. REST requests accept no query string. WS requires exactly one `vm_id`, 1–128 ASCII letters, digits, underscores or hyphens, with no other query parameters. Paths are exact and case-sensitive.

## Native account lookup

```http
GET /fetch_vms HTTP/1.1
Host: <relay-host>
Authorization: Bearer <device-access-token>
X-Muse-Relay-Key: <deployment-relay-key>
X-API-Version: 1.0.0
```

An illustrative successful JSON shape, consumed by Studio:

```json
{
  "vm_list": [
    {
      "vm_id": "example_vm_id",
      "vm_name": "My Muse",
      "default": true,
      "vm_auth_token": "<vm-auth-token>",
      "vm_ws_url": "<official-websocket-url>"
    }
  ]
}
```

The Worker does not parse, rebuild or remove JSON fields. The upstream may return additional fields such as state, type, expiry and notary information. Treat the response as credential-bearing. Choose the desired VM, then use **that VM's** auth token for Noise. A relay client must construct its relay WS URL instead of blindly connecting to the returned official `vm_ws_url`.

## Token mint and refresh

```http
POST /device_token/mint HTTP/1.1
Host: <relay-host>
Authorization: Bearer <authorized-user-or-session-token>
X-Muse-Relay-Key: <deployment-relay-key>
X-API-Version: 1.0.0
Content-Type: application/json

{"device_id":"<paired-device-id>","sdk_token":"<developer-sdk-token-if-required>"}
```

Mint needs the authorization accepted by the official issuance flow. A short `mgst_…` token in a body/header is not a replacement for account authorization. Our invalid-auth comparison returned matching upstream/relay 401 errors; it is not proof that SDK-only mint works.

```http
POST /device_token/refresh HTTP/1.1
Host: <relay-host>
Authorization: Bearer hatch_refresh:<raw-refresh-token>
X-Muse-Relay-Key: <deployment-relay-key>
X-API-Version: 1.0.0
Content-Type: application/json

{"device_id":"<paired-device-id>","sdk_token":"<developer-sdk-token-if-required>"}
```

`device_id` is the paired device identity, not a freshly generated browser conversation UUID. Send the optional `sdk_token` according to the official client flow. The preserved SDK also attempts access-token-based refresh before a refresh-token fallback; the Worker forwards the caller's Bearer unchanged and does not select a refresh method.

Illustrative token pair:

```json
{"access_token":"<new-device-access-token>","refresh_token":"<new-device-refresh-token>"}
```

Studio accepts token fields at the JSON root or under `payload`; that tolerance is in the **client**, not a Worker transformation. Official status, body and fields remain unchanged. Refresh may rotate credentials shared with hardware. The relay never refreshes automatically, updates a gadget or retries issuance on the caller's behalf. A successful real credential rotation was not performed in this documentation/UI update.

## Native Noise WebSocket

```http
GET /v1/noise?vm_id=example_vm_id HTTP/1.1
Host: <relay-host>
Upgrade: websocket
Connection: Upgrade
Authorization: Bearer <vm-auth-token>
X-Muse-Relay-Key: <deployment-relay-key>
Sec-WebSocket-Version: 13
Sec-WebSocket-Key: <generated-by-your-websocket-library>
```

A WS library should generate the standard handshake fields. Use `wss://` on the public client; the Worker's outbound Fetch upgrade uses the corresponding HTTPS endpoint. Native HTTP 101 responses pass through from upstream. Non-101 errors retain their status/body.

After 101, **the client** performs the Noise handshake, registration and encrypted stream protocol. Text chat, thread creation, acknowledgements and replies travel inside that transport. There is no public `POST /chat/stream` route on this Worker and no plaintext JSON chat conversion. The relay does not distinguish text and audio Noise frames; this does not mean audio has been verified end to end.

## Browser adapters

| Route | Method | Caller credential | Shared relay key |
| --- | --- | --- | --- |
| `/web/account` | GET | Device Bearer in Authorization | Not required |
| `/web/refresh` | POST | Official refresh Bearer; same body as refresh | Not required |
| `/web/official-noise?vm_id=…` | WS | VM token in subprotocol | Not required |
| `/fetch_vms`, `/device_token/refresh` | GET / POST | Corresponding official Bearer | Required in `X-Muse-Relay-Key` |
| `/web/noise?vm_id=…` | WS | VM token in subprotocol | Required inside auth subprotocol |

“Official” in the adapter path and legacy profile mode means the site's default adapter; it still routes through your Worker.

The browser cannot add an arbitrary WS Authorization header. For default-mode WS on the site's own origin:

```js
const auth = { token: vmAuthToken }; // token returned by account lookup
const encoded = btoa(JSON.stringify(auth)) // Muse tokens are ASCII
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const endpoint = new URL("/web/official-noise", location.origin);
endpoint.protocol = "wss:";
endpoint.searchParams.set("vm_id", vmId);
const socket = new WebSocket(endpoint, ["muse-v1", "muse-auth." + encoded]);
// This opens the transport only. A Noise implementation must handle socket data.
```

Custom-browser mode uses your trusted relay origin, path `/web/noise` and auth JSON `{"token":"<vm-auth-token>","key":"<relay-key>"}`. There must be exactly one `muse-auth.` protocol and also `muse-v1`. The Worker converts the token to `Authorization: Bearer …`, removes the credential protocol upstream, and selects `muse-v1` on a successful browser upgrade. Base64url is encoding, not encryption; always use HTTPS/WSS. Never put tokens in URL query strings.

Browser WS needs an allowed `Origin`. Account/refresh adapters accept an allowed Origin or the browser's `Sec-Fetch-Site: same-origin` signal. Same-origin is automatically allowed. External Origins must match an entry in the `BROWSER_ORIGINS` JSON string array exactly (scheme, host and port). Preflight permits GET, POST, OPTIONS and Authorization, Content-Type, X-API-Version, X-Muse-Relay-Key for the supported REST routes.

These browser checks can be imitated by non-browser clients and do not authenticate an invited user. Keyless adapters remain in the relay-only build. See [trust boundaries](ARCHITECTURE.md#native-routes-and-browser-adapters) before treating a deployment as private.

## Response and header rules

The Worker copies only these request headers when present: `Content-Type`, `X-API-Version`, `Upgrade`, `Connection`, `Sec-WebSocket-Key`, `Sec-WebSocket-Version`, `Sec-WebSocket-Protocol`; it then supplies the caller's Authorization. Browser credential subprotocols are excluded. `X-Muse-Relay-Key`, cookies, incoming Host and Origin are not sent as upstream authentication. POST body bytes stream through unchanged; the Worker does not validate the upstream JSON schema.

For ordinary upstream responses, status/body are preserved, `Set-Cookie` is removed and `Cache-Control` is set to `no-store`. Exact allowed-origin CORS headers are added when relevant. Redirects are returned without following them. This is protocol-compatible forwarding of these routes, not arbitrary header-for-header HTTP tunneling.

Local relay failures are plain text, not a synthetic official JSON envelope:

| Status | Local response examples |
| --- | --- |
| 400 | `Invalid VM id` |
| 401 | `Unauthorized`, `Muse authorization required`, `Browser authorization required`, `Invalid authorization` |
| 403 | `Origin not allowed` |
| 404 | `Not found` (after access checks) |
| 405 | `Method not allowed` |
| 426 | `WebSocket required` |
| 502 | `Upstream unavailable` (outbound fetch failed) |
| 503 | `Relay secret not configured` |

Access checks occur before some route checks: an unknown native path without the correct key can return 401 before 404. Upstream 401/403/429/5xx are returned as received, so status alone cannot identify a local versus official error. Check the body safely without publishing credentials. No automatic retry, caching, credential persistence or payload logging is implemented.

## Public health metadata

```http
GET /health HTTP/1.1
Host: <relay-host>
```

```json
{"service":"muse-personal-relay","version":4,"build":"2026-10-15"}
```

The service string is retained for compatibility; it is not a required Worker name. Health is public only after `MUSE_RELAY_KEY` is configured globally. It does not contact Muse, test a token, measure WS/Noise or prove chat availability.

Run `node --test worker.test.mjs` in `relay/` for the current contract suite. Historical live results and new UI-only evidence are separated in [SCREENSHOTS.md](SCREENSHOTS.md) and [the English UI verification record](../studio/docs/ENGLISH-UI-VERIFICATION.md).
