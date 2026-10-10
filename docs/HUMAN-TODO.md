# Things only Gaven can do

The build continues with placeholders for each item; nothing here blocks local development. Exact steps are in [docs/dev/release.md](dev/release.md).

- [x] Create the GitHub repository `gavenrobertson/linewise` and push this code.
- [ ] Decide when to merge `claude/wizardly-bohr-l366zp` into `main` (and make `main` the default branch). The milestone tags point at commits on this branch.
- [ ] **Updater key pair:** `pnpm --filter @linewise/desktop tauri signer generate -w ~/.tauri/linewise.key`; put the public key in `apps/desktop/src-tauri/tauri.conf.json` (`plugins.updater.pubkey`, replacing `REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY`); add secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Until then releases have no updater artifacts and installed apps cannot auto-update (REL-10..12).
- [ ] **Apple:** Developer Program membership → "Developer ID Application" certificate → App Store Connect API key. Secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_P8` (contents of the .p8). Until then the macOS build is ad-hoc signed and Gatekeeper blocks it (REL-02).
- [ ] **Windows signing:** apply to SignPath Foundation (free for OSS) or set up Azure Trusted Signing (secrets `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`; variables `TRUSTED_SIGNING_ENDPOINT`, `TRUSTED_SIGNING_ACCOUNT`, `TRUSTED_SIGNING_PROFILE`), or buy an OV/EV certificate. Until then SmartScreen warns (REL-01).
- [ ] Turn on branch protection for `main` (required checks: `ci`; one review for external PRs; linear history) and install the [DCO GitHub app](https://github.com/apps/dco) (REL-21, OSS-05).
- [ ] Enable GitHub private vulnerability reporting (Settings → Code security) so the link in SECURITY.md works (NFR-SEC-08).
- [ ] Enable GitHub Pages with source "GitHub Actions" for the docs site; optionally register a domain (for example `linewise.dev`) and set it as the Pages custom domain (DOC-01).
- [ ] Choose a contact email for Code of Conduct reports and add it to `CODE_OF_CONDUCT.md`.
- [ ] Install the Renovate GitHub app on the repository.
- [ ] **Vendor datasheets (FR-TPL-03):** this cloud environment's network policy blocks the vendor sites, so no vendor-model templates could be checked against datasheets. Either allow these hosts in the environment's Network access settings (`www.cisco.com`, `documentation.meraki.com`, `www.juniper.net`, `www.arista.com`, `www.fortinet.com`, `www.paloaltonetworks.com`, `docs.paloaltonetworks.com`, `techspecs.ui.com`) so the agent can verify and add them, or add templates yourself following CONTRIBUTING.md. Until then only the generic templates ship.
- [ ] Run the manual release checklist (`docs/release-checklist.md`) on Windows 10, Windows 11 ARM, macOS Intel and macOS Apple Silicon, including the v0.9 → v1.0 auto-update check (M6 acceptance).
