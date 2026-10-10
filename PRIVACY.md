# Privacy

LineWise is an offline desktop app. Your diagrams stay on your computer.

## Network access

- **Update check (on by default, can be turned off).** At most once every 24 hours, and when you choose Help → Check for Updates, LineWise downloads a small `latest.json` file from GitHub Releases (`github.com/gavenrobertson/linewise/releases`). The request carries nothing beyond what any HTTPS request implies (your IP address and a generic user agent): no identifiers, no diagram data, no usage data. Turn it off in Preferences → Updates. If you install an update, the installer is downloaded from the same place.
- **Links you click** (documentation, license pages) open in your default browser.
- **Nothing else.** The app loads no remote fonts, scripts, images or analytics. Device templates, icons and fonts are bundled.

## Telemetry and crash reports

Off by default and opt-in only (NFR-PRIV-02). LineWise 1.0 has **no telemetry or crash-reporting service configured**, so nothing is sent even if you turn the preference on. If a future version adds one, this document will describe exactly what is sent before it is enabled, and it will never include diagram content, hostnames or IP addresses.

## What is stored on your computer

| What                                                    | Where                                                   | Why                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Your `.lwise` files and one `.bak` of the previous save | Where you save them                                     | Your work; the backup protects against a bad save                                                                     |
| Recovery copies of unsaved diagrams                     | App-data folder → `recovery/`                           | Crash recovery; removed after you save or discard                                                                     |
| Recent files list (last 10)                             | App-data folder → `recent.json`                         | Welcome screen                                                                                                        |
| Preferences and imported icon packs                     | The app's web view storage, inside the app-data folders | Settings                                                                                                              |
| Logs (5 files × 5 MB, rotated)                          | Log folder (below)                                      | Troubleshooting; open with Help → Open Logs Folder. Logs record events such as "saved <path>", never diagram contents |

The app-data folder is `%APPDATA%\dev.gavenrobertson.linewise` on Windows and `~/Library/Application Support/dev.gavenrobertson.linewise` on macOS. Logs are in `%LOCALAPPDATA%\dev.gavenrobertson.linewise\logs` on Windows and `~/Library/Logs/dev.gavenrobertson.linewise` on macOS.

## Imported configurations

When you import `show running-config` output, passwords, enable secrets, SNMP communities and keys are removed before anything is stored. LineWise never connects to your devices.

## Diagnostics

If the app hits an unexpected error it shows a recovery screen with **Copy diagnostics**. That copies text to your clipboard only; nothing is uploaded. Review it before sharing.
