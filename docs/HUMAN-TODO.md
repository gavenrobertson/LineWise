# Gaven's setup and release todo

Last updated: **2026-10-11**. Repository setup, updater signing and all six milestone draft builds are complete. The remaining owner actions are below. Exact signing steps are in [the release guide](dev/release.md).

## Still to do

- [ ] **Keep an offline updater-key backup.** Copy the private key and its password from the protected local `LineWise-updater-backup` directory to a private offline location; follow its README. The local backup exists, but an offline copy has not been confirmed. Never commit the key or password. Keep the existing key pair for future releases; replacing it would break updates for copies using the original public key.
- [ ] **Apple installer signing and notarization (REL-02).** Provide Developer Program membership, a Developer ID Application certificate exported as `.p12`, and an App Store Connect API key. Configure `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_API_KEY`, `APPLE_API_ISSUER` and `APPLE_API_KEY_P8` as Actions secrets. Rebuild and verify the notarized installer. Current macOS drafts are ad-hoc signed; Gatekeeper acceptance has not been verified.
- [ ] **Windows installer signing (REL-01).** Choose a signing service or certificate. The workflow supports Azure Trusted Signing: secrets `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, and variables `TRUSTED_SIGNING_ENDPOINT`, `TRUSTED_SIGNING_ACCOUNT`, `TRUSTED_SIGNING_PROFILE`. SignPath or another certificate requires its signing integration before rebuilding. Current drafts have updater signatures but no verified publisher signature; SmartScreen acceptance remains untested.
- [ ] **Vendor datasheets and templates (FR-TPL-03).** Share/open the cloud environment's Network access settings so its allowlist can be configured, or add verified templates following [CONTRIBUTING.md](../CONTRIBUTING.md). Hosts: `www.cisco.com`, `documentation.meraki.com`, `www.juniper.net`, `www.arista.com`, `www.fortinet.com`, `www.paloaltonetworks.com`, `docs.paloaltonetworks.com`, `techspecs.ui.com`. Allowing the hosts is only the first step: verify the datasheets and add the corresponding templates. Only generic templates currently ship.
- [ ] **Install the beta on the four test machines.** `v0.9.0-beta` is published as a pre-release (2026-10-12) and its installers download without signing in. Install it on the four test machines, following [the release guide](dev/release.md).
- [ ] **Create the `v1.0.0` draft when ready.** Use a green commit on current `main` containing the docs, public updater key and workflow fixes from [PR #2](https://github.com/gavenrobertson/LineWise/pull/2) and [PR #4](https://github.com/gavenrobertson/LineWise/pull/4). Confirm version files and release notes before tagging. Do not use the obsolete `fd5ea8a20e4e3af43fd4511dc808303e4dfe5613` baseline, which predates these fixes. No `v1.0.0` tag exists yet.
- [ ] **Complete four-platform acceptance and publish `v1.0.0`.** Run [the release checklist](release-checklist.md) on Windows 10 x64, Windows 11 ARM64, macOS Intel and macOS Apple Silicon. Record installer names, SHA-256 hashes and every result, including the `v0.9.0-beta` → `v1.0.0` update. Keep 1.0 as a draft until the checklist and signing requirements pass. Building updater artifacts does not establish that an installed app successfully updates.

- [ ] **Put the website on `linewise.online`.** The download page is the docs site's home; it reads the newest published release from GitHub and shows the right installer.
  1. At the registrar, add `A` records for `@` to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`; `AAAA` records for `@` to `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153` and `2606:50c0:8003::153`; and a `CNAME` for `www` to `gavenrobertson.github.io`. Remove any parking records.
  2. Optional: Account settings → Pages → add and verify `linewise.online`, so no one else can claim it.
  3. Repository Settings → Pages → Custom domain: `linewise.online` → Save. Then, without waiting, Settings → Secrets and variables → Actions → Variables → add `DOCS_DOMAIN` = `linewise.online`, and re-run the latest `docs` workflow on `main` (Actions → docs → Re-run). Until it finishes, the site's styles may not load.
  4. When GitHub shows the certificate is issued, tick **Enforce HTTPS**. `gavenrobertson.github.io/LineWise/` then redirects to the domain, so the app's Help → Documentation link keeps working.

## Other implementation follow-ups

[TRACEABILITY.md](../TRACEABILITY.md) still lists seven SHOULD requirements as todo: format painter and presentation mode (FR-CAN-16/17); routing annotations, gateway redundancy groups and rack elevation (FR-NET-11/12/13); the NetBox device-library importer and template contribution pipeline (FR-TPL-06/07). Visio export (FR-EXP-09, MAY) is deferred until after 1.0. These are development backlog items, separate from the owner account and release actions above. FR-TPL-03 is the only MUST requirement still open in the matrix.

## Completed

- [x] Create and populate [gavenrobertson/LineWise](https://github.com/gavenrobertson/LineWise). Keep the repository's **LineWise** capitalization.
- [x] Merge `claude/wizardly-bohr-l366zp` into `main` and make `main` the default branch. All milestone commits are in its history.
- [x] Push six annotated milestone tags through `v0.9.0-beta`, at the specified commits. No need to recreate or push them again.
- [x] Generate and validate the password-encrypted updater key pair. Commit the public key in `apps/desktop/src-tauri/tauri.conf.json`, configure repository variable `TAURI_UPDATER_PUBKEY`, and configure Actions secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. The private values were never committed.
- [x] Fix the draft-ID handoff and the size checker used for older tags. All six drafts contain Windows x64, Windows ARM64 and universal macOS installers, updater signatures, `latest.json`, `SHA256SUMS.txt`, a CycloneDX SBOM and third-party notices. All remain **unpublished drafts**; Apple/Windows installer signing is separate.
- [x] Activate `Protect main`, matching `.github/rulesets/protect-main.json`: twelve required CI/DCO checks, one review, linear history, no force-pushes or deletion, and admin bypass only through pull requests.
- [x] Enable GitHub private vulnerability reporting (NFR-SEC-08).
- [x] Enable GitHub Pages with source GitHub Actions and permit `main` in the deployment environment. Fix the docs base and app Documentation link to [https://gavenrobertson.github.io/LineWise/](https://gavenrobertson.github.io/LineWise/). Verify the guide opens after a fresh reload.
- [x] Add `gaven.robertson@gmail.com` to `CODE_OF_CONDUCT.md` for conduct reports.
- [x] Install Renovate with access to this repository only.
- [x] Merge the docs/updater fix in [PR #2](https://github.com/gavenrobertson/LineWise/pull/2) after 13 passing checks, and the historical packaging fix in [PR #4](https://github.com/gavenrobertson/LineWise/pull/4) after all twelve required checks passed. One unchanged macOS canvas test passed on retry.

## Milestone build evidence

Each linked release workflow completed successfully. These are historical milestone commits; future releases should use current, verified `main`.

| Tag           | Tagged commit                              | Successful draft build                                                             |
| ------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `v0.0.1`      | `50b84d27cfe1cc00ae8cb05b97e32718fe0b7a19` | [38172973421](https://github.com/gavenrobertson/LineWise/actions/runs/38172973421) |
| `v0.1.0`      | `fca725230cc9ef11b49a0a9a94293e36c861f0f6` | [38172976099](https://github.com/gavenrobertson/LineWise/actions/runs/38172976099) |
| `v0.2.0`      | `088ced79dbe48e2853b4466dc6cecec934f95422` | [38172978542](https://github.com/gavenrobertson/LineWise/actions/runs/38172978542) |
| `v0.3.0`      | `1f4f0691e99cb61b3c774612cda61b9d8476d882` | [38172980996](https://github.com/gavenrobertson/LineWise/actions/runs/38172980996) |
| `v0.4.0`      | `314473229765d809f82c1f365425ddd789fdadc5` | [38172983320](https://github.com/gavenrobertson/LineWise/actions/runs/38172983320) |
| `v0.9.0-beta` | `45afa99d69a5b40612923cf74ff1404093944131` | [38171695782](https://github.com/gavenrobertson/LineWise/actions/runs/38171695782) |
