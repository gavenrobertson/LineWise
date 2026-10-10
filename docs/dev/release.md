# Releases, signing and updates

Releases are built only by GitHub Actions from a version tag (spec section 11). Nothing is built or signed on a laptop.

## Cutting a release

1. Make sure `main` is green.
2. Pick the version (Semantic Versioning; prereleases use a suffix such as `0.9.0-beta`).
3. Update the version everywhere from the single source of truth (REL-03):

   ```bash
   node scripts/version.mjs set 1.2.3
   ```

   This writes `apps/desktop/package.json` (which `tauri.conf.json` reads), every workspace `package.json`, `Cargo.toml` and `Cargo.lock`.

4. Move the **Unreleased** notes in `CHANGELOG.md` under a `## [1.2.3] - YYYY-MM-DD` heading.
5. Commit (`chore(release): 1.2.3`), merge, then tag and push the tag:

   ```bash
   git tag -a v1.2.3 -m "LineWise 1.2.3" && git push origin v1.2.3
   ```

6. `release.yml` checks the tag against the version, creates a **draft** release with the changelog section as notes, builds Windows x64 (NSIS + MSI), Windows ARM64 (NSIS) and macOS universal (DMG), signs and notarizes when the secrets exist, uploads `latest.json`, `SHA256SUMS.txt`, a CycloneDX SBOM and `THIRD_PARTY_NOTICES.md`. The workflow summary says what was and was not signed.
7. Review the draft (download and install at least one build, check the notes) and **Publish**. `publish-channel.yml` then copies `latest.json` to the beta feed.
8. Run the manual [release checklist](../release-checklist.md) for anything the automation cannot cover.

## Update channels (REL-10..12)

| Channel                      | Feed URL the app checks                                                           | Receives                                       |
| ---------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| Stable (default)             | `https://github.com/gavenrobertson/linewise/releases/latest/download/latest.json` | Published non-prerelease versions              |
| Beta (opt-in in Preferences) | `https://github.com/gavenrobertson/linewise/releases/download/beta/latest.json`   | Every published version, including prereleases |

GitHub serves `releases/latest` from the newest published non-prerelease, so a prerelease never reaches stable users. The `beta` release is a feed holder created by `publish-channel.yml`; it is marked prerelease and carries only `latest.json`.

The app checks on launch at most once every 24 hours (and from Help → Check for Updates), shows the notes, and installs only if the user picks **Install and restart**. The Tauri updater verifies each package against the public key compiled into the app; a failed verification aborts the install and is logged.

## Secrets and variables

Add these under **Settings → Secrets and variables → Actions** in `gavenrobertson/linewise`. Every one is optional: without it the matching step is skipped and the release notes say the build is unsigned.

### Updater signing (all platforms)

1. Generate the key pair once, on a trusted machine:

   ```bash
   pnpm --filter @linewise/desktop tauri signer generate -w ~/.tauri/linewise.key
   ```

2. Secrets: `TAURI_SIGNING_PRIVATE_KEY` (the contents of `linewise.key`) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
3. The public key: either replace `REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY` in `apps/desktop/src-tauri/tauri.conf.json` (`plugins.updater.pubkey`) and commit it, or set the repository **variable** `TAURI_UPDATER_PUBKEY`; the release build bakes it in. Committing it is preferred so local builds match.
4. Keep an offline backup of the private key. If it is lost, installed apps can no longer verify updates and users must reinstall manually.

### macOS (Developer ID + notarization, REL-02)

1. Join the Apple Developer Program, create a **Developer ID Application** certificate, export it with its private key as a `.p12`.
2. In App Store Connect → Users and Access → Integrations, create an API key with the Developer role; download the `.p8`.
3. Secrets:

   | Secret                       | Value                                               |
   | ---------------------------- | --------------------------------------------------- |
   | `APPLE_CERTIFICATE`          | `base64 -i cert.p12` output                         |
   | `APPLE_CERTIFICATE_PASSWORD` | the `.p12` export password                          |
   | `APPLE_SIGNING_IDENTITY`     | e.g. `Developer ID Application: Your Name (TEAMID)` |
   | `APPLE_TEAM_ID`              | your 10-character team ID                           |
   | `APPLE_API_KEY`              | the API key ID                                      |
   | `APPLE_API_ISSUER`           | the issuer ID                                       |
   | `APPLE_API_KEY_P8`           | the full contents of the `.p8` file                 |

The workflow writes the `.p8` to a temporary file and passes its path as `APPLE_API_KEY_PATH`. Tauri signs with the hardened runtime and minimal entitlements, notarizes and staples the DMG.

### Windows (REL-01)

LineWise supports **Azure Trusted Signing** out of the box (spec section 11 lists the options; SignPath Foundation is free for qualifying open-source projects and can be wired in the same way with a custom `signCommand`).

| Name                                                        | Kind     | Value                                                                                |
| ----------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` | secrets  | an Entra app registration with the _Trusted Signing Certificate Profile Signer_ role |
| `TRUSTED_SIGNING_ENDPOINT`                                  | variable | e.g. `https://eus.codesigning.azure.net`                                             |
| `TRUSTED_SIGNING_ACCOUNT`                                   | variable | the Trusted Signing account name                                                     |
| `TRUSTED_SIGNING_PROFILE`                                   | variable | the certificate profile name                                                         |

When all six are present, `scripts/release-config.mjs` sets `bundle.windows.signCommand` to `trusted-signing-cli` and every executable and installer is signed.

Without signing, Windows SmartScreen warns on first run.

### Windows ARM64 and MSI

Tauri builds MSI installers with WiX 3, which cannot target ARM64. Windows ARM64 therefore ships the NSIS installer only; IT can deploy it silently with `/S`, or deploy the x64 MSI, which runs on Windows 11 ARM under emulation. See `docs/decisions-log.md`.

## Installer details

- **NSIS** (`*-setup.exe`): per-user install, no admin rights, optional desktop shortcut, `.lwise` file association, WebView2 via the embedded bootstrapper. Silent: `/S`.
- **MSI**: per-machine. Silent: `msiexec /i LineWise_<v>_x64_en-US.msi /qn`; uninstall `msiexec /x {ProductCode} /qn`.
- **DMG**: universal binary (`universal-apple-darwin`), Applications shortcut, macOS 12+.

## Local builds

```bash
cd apps/desktop
pnpm tauri build --config src-tauri/tauri.debug.conf.json          # unsigned, no updater artifacts
pnpm tauri build --debug --no-bundle --config src-tauri/tauri.debug.conf.json   # for the smoke test
```
