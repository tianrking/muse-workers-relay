# AWS entrance, Cloudflare retained

Route: ESP32 -> https://aws.w0x7ce.eu -> https://muse.w0x7ce.eu -> official Muse.

The existing AWS HTTPS vhost now proxies only /health, /fetch_vms, /device_token/mint, /device_token/refresh and /v1/noise. Its other paths retain the existing redirect to nanomuse.w0x7ce.eu. Existing applications and private-login rules were not changed. WebSocket upgrade headers and bidirectional streaming are enabled. Upstream TLS verification and SNI are enabled. Credentials stay in headers and scoped proxy access logging is disabled. The Worker still enforces its private relay key and Muse bearer authentication.

Deployment verified: nginx -t passed; AWS /health returned the Cloudflare relay JSON; root path remained 301; missing credentials returned 401. This does not prove a real authenticated Muse session.

Original nginx file backup on VPS: /etc/nginx/sites-available/nanomuse.before-muse-relay-1791973949. Scoped include: /etc/nginx/muse-gadget-relay.inc. No SSH password is saved in these scripts or firmware. Deployment scripts read SSH credentials from stdin.

The firmware entrance is configured by secrets/muse-relay.h; the same key remains in use. Do not share private generated worker.js/worker.mjs or secrets files.
