# Repository split verification — 2026-10-15

This change makes main Worker-first and preserves the complete pre-split repository on test/esp32-spotpear. The test branch was pushed before tracked hardware files were removed from main. No production Worker deployment, firmware flash or credential rotation was performed.

Validation on the reorganized main working tree:

- Worker contract tests: 16 passed, no skips.
- Studio tests: 9 passed, no skips.
- TypeScript no-emit check: passed.
- Vite production build: passed; output asset hashes unchanged.
- Wrangler relay-only dry-run: passed without an ASSETS binding.
- Wrangler optional-web dry-run: passed with studio/dist assets.

The local Node version manager was not active; verification used the explicit installed Node runtime and package CLI entry points. Earlier live test JSON files are historical evidence only. This change does not claim new live account, audio or network validation.
