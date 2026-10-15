# Muse Workers relay

The platform-independent core of Mori. Entry point: [worker.template.mjs](worker.template.mjs).

- [Root deployment guide and full API contract](../README.md)
- [Browser authentication details](BROWSER-API.zh-CN.md)
- `wrangler.example.jsonc`: relay-only deployment; no Studio build needed.
- `wrangler.web.example.jsonc`: same Worker with optional Studio static assets.
- `worker.test.mjs`: fixed-upstream REST/WebSocket contract and failure tests.

Copy the chosen config to ignored `wrangler.local.jsonc`, select your Worker name, deploy, and configure `MUSE_RELAY_KEY` with Wrangler secret put. Never place credentials in source or committed configuration.

Historical sanitized PC evidence: [contract results](new-account-contract-results.json), [account/Noise/text results](pc-preflash-relay-results.json). These are dated test snapshots, not current uptime or a guarantee for other networks. Hardware-specific evidence and prior account deployment configurations are preserved on [test/esp32-spotpear](https://github.com/tianrking/muse-workers-relay/tree/test/esp32-spotpear).

The running personal deployment is https://muse.2fast.cfd. Examples use a generic Worker name and do not modify that service.
