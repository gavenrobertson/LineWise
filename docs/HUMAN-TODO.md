# Things only Gaven can do

The build continues with placeholders for each item; nothing here blocks local development.

- [ ] Create the GitHub repository `gavenrobertson/linewise` and push this code.
- [ ] Apple Developer Program membership → "Developer ID Application" certificate → App Store Connect API key for notarization. Add secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_P8` (contents of the .p8 file), `APPLE_TEAM_ID`.
- [ ] Windows code signing: apply to SignPath Foundation (free for OSS), or set up Azure Trusted Signing, or buy an OV/EV certificate. Add the matching secrets (see `docs/dev/release.md`).
- [ ] Generate the Tauri updater key pair (`pnpm tauri signer generate -w ~/.tauri/linewise.key`), put the public key in `apps/desktop/src-tauri/tauri.conf.json` (`plugins.updater.pubkey`), and add secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- [ ] Turn on branch protection for `main` (required checks, linear history) and the DCO GitHub app.
- [ ] Register a domain for the docs site (for example `linewise.dev`) and point GitHub Pages at it.
- [ ] Run the manual release checklist (`docs/release-checklist.md`) on Windows 10, Windows 11 ARM, macOS Intel and macOS Apple Silicon.
