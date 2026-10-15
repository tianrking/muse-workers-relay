<!--
Copyright (c) Meta Platforms, Inc. and affiliates.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# Mori Workers development

Main contains the Cloudflare Worker relay in relay/ and an optional React browser demo in studio/. ESP32 firmware, IDF tooling and hardware records are preserved on test/esp32-spotpear. Do not introduce firmware build dependencies on main.

Keep upstream destinations fixed. Preserve Muse HTTP request bodies/statuses and Noise WebSocket upgrades. Never log, commit or embed caller credentials or MUSE_RELAY_KEY in browser bundles. Preserve existing source copyright and license notices. Local deployment configuration must stay ignored.

For relay changes, run relay contract tests and a Wrangler dry-run with the generic example config. For Studio changes, run its tests and TypeScript/Vite build. The relay-only example must work without studio/dist; the web example additionally binds those assets. Unit tests are not proof of live account/Noise/network success. Report verification scope accurately.

Repository reorganization does not authorize changing the running Worker, flashing hardware or rotating shared credentials.
