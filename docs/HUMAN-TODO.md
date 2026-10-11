# Things only Gaven can do

The build continues with placeholders for each item; nothing here blocks local development. Exact steps are in [docs/dev/release.md](dev/release.md).

- [x] Create the GitHub repository `gavenrobertson/linewise` and push this code.
- [ ] **Push the milestone tags.** This environment can push only its working branch (tag pushes are refused with HTTP 403), so each milestone tag is listed here with the commit whose CI run verified it. Create and push them from a clone; each push runs `release.yml`, which makes a draft release with unsigned installers:

  | Tag                                           | Commit                                     | Verified by CI run                                                                 |
  | --------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
  | `v0.0.1`                                      | `50b84d27cfe1cc00ae8cb05b97e32718fe0b7a19` | [38080684053](https://github.com/gavenrobertson/LineWise/actions/runs/38080684053) |
  | `v0.1.0`                                      | `fca725230cc9ef11b49a0a9a94293e36c861f0f6` | [38081402516](https://github.com/gavenrobertson/LineWise/actions/runs/38081402516) |
  | `v0.2.0`                                      | `088ced79dbe48e2853b4466dc6cecec934f95422` | [38082073359](https://github.com/gavenrobertson/LineWise/actions/runs/38082073359) |
  | `v0.3.0`                                      | `1f4f0691e99cb61b3c774612cda61b9d8476d882` | [38082073359](https://github.com/gavenrobertson/LineWise/actions/runs/38082073359) |
  | `v0.4.0`                                      | `314473229765d809f82c1f365425ddd789fdadc5` | [38082073359](https://github.com/gavenrobertson/LineWise/actions/runs/38082073359) |
  | `v0.9.0-beta`                                 | `45afa99d69a5b40612923cf74ff1404093944131` | [38145974927](https://github.com/gavenrobertson/LineWise/actions/runs/38145974927) |
  | `v1.0.0` (after the release checklist, below) | `fd5ea8a20e4e3af43fd4511dc808303e4dfe5613` | [38145974927](https://github.com/gavenrobertson/LineWise/actions/runs/38145974927) |

  ```bash
  git fetch origin claude/wizardly-bohr-l366zp
  git tag -a v0.0.1 50b84d27cfe1cc00ae8cb05b97e32718fe0b7a19 -m "LineWise 0.0.1 — M0 Foundation"
  git tag -a v0.1.0 fca725230cc9ef11b49a0a9a94293e36c861f0f6 -m "LineWise 0.1.0 — M1 Core model and canvas"
  git tag -a v0.2.0 088ced79dbe48e2853b4466dc6cecec934f95422 -m "LineWise 0.2.0"
  git tag -a v0.3.0 1f4f0691e99cb61b3c774612cda61b9d8476d882 -m "LineWise 0.3.0"
  git tag -a v0.4.0 314473229765d809f82c1f365425ddd789fdadc5 -m "LineWise 0.4.0"
  git tag -a v0.9.0-beta 45afa99d69a5b40612923cf74ff1404093944131 -m "LineWise 0.9.0-beta — M5 Export, polish, accessibility, performance"
  git push origin v0.0.1 v0.1.0 v0.2.0 v0.3.0 v0.4.0 v0.9.0-beta
  ```

  The CI run on the `1.0.0` release commit verified `v0.9.0-beta` too: the two differ only in version numbers, `CHANGELOG.md` and docs. Push `v1.0.0` only after the v1.0 acceptance steps below.

- [ ] Decide when to merge `claude/wizardly-bohr-l366zp` into `main` (and make `main` the default branch). The milestone tags point at commits on this branch.
- [ ] **Updater key pair:** `pnpm --filter @linewise/desktop tauri signer generate -w ~/.tauri/linewise.key`; put the public key in `apps/desktop/src-tauri/tauri.conf.json` (`plugins.updater.pubkey`, replacing `REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY`); add secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Until then releases have no updater artifacts and installed apps cannot auto-update (REL-10..12).
- [ ] **Apple:** Developer Program membership → "Developer ID Application" certificate → App Store Connect API key. Secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_P8` (contents of the .p8). Until then the macOS build is ad-hoc signed and Gatekeeper blocks it (REL-02).
- [ ] **Windows signing:** apply to SignPath Foundation (free for OSS) or set up Azure Trusted Signing (secrets `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`; variables `TRUSTED_SIGNING_ENDPOINT`, `TRUSTED_SIGNING_ACCOUNT`, `TRUSTED_SIGNING_PROFILE`), or buy an OV/EV certificate. Until then SmartScreen warns (REL-01).
- [ ] **Branch protection for `main` (REL-21):** after `main` is the default branch, import `.github/rulesets/protect-main.json` under Settings → Rules → Rulesets → New ruleset → Import. It requires every CI job and `DCO sign-off` (`dco.yml` checks contributor sign-offs, OSS-05; the [DCO GitHub app](https://github.com/apps/dco) is an alternative), one review (admins may merge their own pull requests), linear history, and blocks force-pushes and deletion.
- [ ] Enable GitHub private vulnerability reporting (Settings → Code security) so the link in SECURITY.md works (NFR-SEC-08).
- [ ] Enable GitHub Pages with source "GitHub Actions" for the docs site; optionally register a domain (for example `linewise.dev`) and set it as the Pages custom domain (DOC-01).
- [ ] Choose a contact email for Code of Conduct reports and add it to `CODE_OF_CONDUCT.md`.
- [ ] Install the Renovate GitHub app on the repository.
- [ ] **Vendor datasheets (FR-TPL-03):** this cloud environment's network policy blocks the vendor sites, so no vendor-model templates could be checked against datasheets. Either allow these hosts in the environment's Network access settings (`www.cisco.com`, `documentation.meraki.com`, `www.juniper.net`, `www.arista.com`, `www.fortinet.com`, `www.paloaltonetworks.com`, `docs.paloaltonetworks.com`, `techspecs.ui.com`) so the agent can verify and add them, or add templates yourself following CONTRIBUTING.md. Until then only the generic templates ship.
- [ ] **v1.0 acceptance (M6), in this order** (`docs/reports/M6.md`):
  1. Set up the updater key pair and, if you can, Apple and Windows signing (items above).
  2. Push `v0.9.0-beta` (table above). Review its draft release and publish it, then install it on each test machine.
  3. Tag the 1.0.0 release commit: `git tag -a v1.0.0 <commit> -m "LineWise 1.0.0"` and `git push origin v1.0.0`. Use the `v1.0.0` commit in the tag table above. Review the draft release.
  4. Run the release checklist (`docs/release-checklist.md`) on Windows 10, Windows 11 ARM, macOS Intel and macOS Apple Silicon. The auto-update row is the v0.9.0-beta → v1.0.0 update. Then publish v1.0.0.
