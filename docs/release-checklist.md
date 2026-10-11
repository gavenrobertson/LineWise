# Release checklist

Run this on the **draft** release before publishing it (spec section 10). The automation covers
the rest: unit, component and end-to-end tests in Chromium and WebKit, the native smoke test on
Windows and Linux, the installers' document-icon registration, benchmarks, checksums and the SBOM.
macOS has no WebDriver for WKWebView, so the macOS rows here are the only end-to-end check of the
macOS build.

Copy the table into the release's tracking issue and tick each cell. Note the build you tested
(file name and SHA-256 from `SHA256SUMS.txt`).

| Check                                                                                                                                                                                     | Windows 10 x64 | Windows 11 ARM64 | macOS Intel | macOS Apple Silicon |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------- | ----------- | ------------------- |
| **Install** on a clean machine or VM: NSIS per user without admin rights (Windows), MSI per machine (`msiexec /i … /qn`, x64 and ARM64 under emulation), DMG drag to Applications (macOS) |                |                  |             |                     |
| **Signing:** SmartScreen shows the publisher and no warning (signed) or the documented warning (unsigned); Gatekeeper opens the app without a warning (notarized)                         |                |                  |             |                     |
| **First run:** the welcome screen opens; a starter diagram opens; save, close and reopen it                                                                                               |                |                  |             |                     |
| **File association:** `.lwise` files show the LineWise document icon; double-clicking one opens it; double-clicking a second one while the app is open adds a tab                         |                |                  |             |                     |
| **Auto-update** from the previous release: Help → Check for updates offers this version with its notes; **Later** leaves it; **Install and restart** updates and reopens                  |                |                  |             |                     |
| **Beta channel:** with Preferences → Update channel set to Beta, a beta release is offered; with Stable it is not                                                                         |                |                  |             |                     |
| **Dark mode:** the app follows the OS theme; Preferences → Theme overrides it; the canvas and exports stay legible                                                                        |                |                  |             |                     |
| **Display scaling at 200%:** text and icons are sharp, nothing is clipped; on Windows the app follows Settings → Accessibility → Text size                                                |                |                  |             |                     |
| **Screen reader:** Narrator (Windows) or VoiceOver (macOS) reads the toolbar, the outline tree, a device's name and problems, and the inspector fields                                    |                |                  |             |                     |
| **High contrast:** Windows contrast themes show links and text in system colors (Windows only)                                                                                            |                | n/a for macOS    | n/a         | n/a                 |
| **Native dialogs and menus:** File → Open, Save As, Export and Print use the OS dialogs; the macOS app menu and Edit menu work; shortcuts match the shortcut sheet                        |                |                  |             |                     |
| **Offline:** with the network off, the app starts, edits, saves and exports; the update check fails quietly                                                                               |                |                  |             |                     |
| **Uninstall** removes the app, its Start menu or Launchpad entry and the `.lwise` association; diagrams and preferences stay                                                              |                |                  |             |                     |

## Before publishing

- [ ] CI is green on the tagged commit, and the release workflow's summary says what was signed.
- [ ] Installers are under 25 MB (the release workflow checks this) and `SHA256SUMS.txt` matches
      the files you downloaded.
- [ ] The release notes match the `CHANGELOG.md` section, and known issues are listed.
- [ ] For a stable release, the beta channel feed is updated by publishing (`publish-channel.yml`).
