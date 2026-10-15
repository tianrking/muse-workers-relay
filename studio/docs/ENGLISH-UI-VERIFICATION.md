# English UI verification — 2026-10-15

The repository's primary deliverable is the Cloudflare Worker relay. This change adds a real English/Chinese interface to its optional browser client and documents the relay wire contract. It does not change Worker routing or Muse protocol bytes.

## Environment and screenshot provenance

- Actual React production build, served with Vite preview at `http://127.0.0.1:5175/`.
- Chrome browser, native application language selector set to English.
- Desktop screenshots at the browser's existing viewport; responsive check at 390 × 844, then reset.
- JPEGs saved directly from the browser screenshot API, without image generation, translation overlays or pixel editing.
- No real device token, relay secret or account profile was loaded in this UI test.
- Local preview served static assets only; it was not a local Worker / authenticated Muse connection.
- The previous generated English illustration was removed from the current tree and README. Original historical Chinese test captures remain separate.

## Actual browser checks

| Check | Result and evidence |
| --- | --- |
| Chinese browser default | First load selected Chinese, matching browser language |
| Explicit English switch | Sidebar, prompts, composer, status and profile controls changed to English |
| Draft preserved | Typed a mixed English/Chinese draft, switched language both ways; text remained unchanged |
| Reload persistence | English remained selected after reload |
| Document language | DOM `html.lang=en`; description in English |
| Default relay settings | English same-site relay explanation, no shared-key input required |
| Custom relay settings | English origin/key/trust controls; entered public origin but did not save or connect |
| Local validation | Custom origin required explicit trust; SDK-token-as-device-token rejected in English |
| Onboarding | ESP32 and Linux instructions rendered in English; Linux export link points to the local asset |
| Diagnostics | Displayed Not connected, Not measured, zero Muses; no invented success state |
| Mobile | English controls/composer remained usable at 390 px; sidebar opened and closed |
| Console | No warning/error entries recorded during these UI checks |

Reload is expected to clear an unsaved draft and in-memory credentials; this test only asserts draft preservation during language changes, not across a reload. Profile names, user-authored thread titles and chat content are not translated. Existing Chinese history stays as entered.

## Screenshots

- [English homepage](studio-home.en.jpg): optional client running with no profile / no connection.
- [English relay settings](studio-relay-settings.en.jpg): actual custom relay editor, public example origin, empty key, trust unchecked.
- [English diagnostics](studio-diagnostics.en.jpg): actual disconnected diagnostics, not an authenticated-session result.
- [English mobile](studio-mobile.en.jpg): actual responsive homepage.

## Automated checks

- 16 Worker contract tests passed.
- 13 Studio tests passed: existing 9 protocol/storage/export tests plus 4 language tests.
- Language tests cover preference negotiation, blocked storage, subscriber cleanup, dynamic status/error formatting, translated defaults and missing dictionary entries.
- Strict TypeScript check and Vite production build passed.
- Both relay-only and optional-web Wrangler dry-runs passed.
- Documentation links and removal of references to the deleted generated asset checked.

The application uses a small external locale store with `useSyncExternalStore`; changing language does not remount the workspace or replace its protocol client. Protocol status strings remain internal to the existing retry logic and are translated at the presentation boundary.

## Scope of network verification

No new account pairing, token mint, refresh rotation, authenticated Noise handshake, chat reply, audio test, hardware flash or production deployment was performed for this English UI change. Historical authenticated results are linked from [the evidence guide](../../docs/SCREENSHOTS.md). These new screenshots prove the running English UI only.

The relay contract is described independently in [API.md](../../docs/API.md): paths, methods, header forwarding, illustrative JSON, browser subprotocol authentication, local errors and end-to-end Noise boundaries. Contract tests exercise those routes; they are not a new deployed-runtime acceptance result.
