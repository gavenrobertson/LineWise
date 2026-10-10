<p align="center">
  <img src="packages/brand/svg/lockup-light-subline.svg" alt="LineWise — network architecture diagrams" width="420">
</p>

**LineWise is a free, open-source, offline desktop app for drawing Cisco-style network diagrams where every icon is a real device with interfaces, IP addresses, VLANs and links.**

<p align="center">
  <img src="docs/img/screenshot-l2.png" alt="A three-tier campus diagram in LineWise, in the Data link (L2) view with VLAN-colored links" width="900">
</p>

> **Status: pre-release.** Milestones are tracked in [`docs/PLAN.md`](docs/PLAN.md) and [`TRACEABILITY.md`](TRACEABILITY.md). Builds published before maintainer code-signing is set up are unsigned; see [Install](#install).

## Download

Installers are attached to each [GitHub Release](https://github.com/gavenrobertson/linewise/releases):

| Platform                            | File                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11 x64                   | `LineWise_<version>_x64-setup.exe` (per-user, no admin) or `LineWise_<version>_x64_en-US.msi` (per-machine, for IT) |
| Windows 11 ARM64                    | `LineWise_<version>_arm64-setup.exe`                                                                                |
| macOS 12+ (Apple Silicon and Intel) | `LineWise_<version>_universal.dmg`                                                                                  |
| Linux (best effort)                 | Build from source (below)                                                                                           |

Every release lists SHA-256 checksums (`SHA256SUMS.txt`), a CycloneDX SBOM and the third-party notices.

## Features

- **Diagrams that know the network.** Drag a router onto the canvas, connect `Gi0/1` to a switch's `Gi1/0/24`, assign `10.0.12.1/30`, and LineWise knows the link, the subnet and the VLANs.
- **Original Cisco-convention icons** (router, L2/L3 switch, firewall, AP, WLC, server, clouds and more) in _Classic_ and _Line_ styles. No vendor logos are bundled; you can import icon packs you are licensed to use.
- **Physical (L1), Data link (L2) and Network (L3) views** of the same model, VLAN highlight and shortest-path highlight.
- **Validation as you draw:** duplicate IPs, subnet mismatches, trunk/access and native-VLAN mismatches, speed/duplex mismatches, unused ports, duplicate hostnames and more, with one-click fixes.
- **Import** `show cdp neighbors detail`, `show lldp neighbors detail`, `show running-config`, `show ip interface brief`, `show interfaces status`, `show vlan brief`, `show etherchannel summary`, CSV, draw.io, GNS3, Containerlab and Nmap XML. Secrets in configs are stripped and never stored.
- **Export** PNG, SVG, PDF (with title block), CSV inventories and IP plans, HTML/Markdown reports, draw.io, Containerlab, Mermaid and Graphviz DOT, and print.
- **IPAM tools:** VLAN manager, subnet manager with utilization and next free IP, IPv4/IPv6 subnet calculator with VLSM, point-to-point /30 or /31 helper.
- **Git-friendly files:** `.lwise` is stable, sorted, human-readable JSON with a published [JSON Schema](schema/v1.json) and [format spec](docs/file-format.md).
- **Private by default:** fully offline. The only network call is the update check, which you can turn off.
- **Accessible:** full keyboard operation, a screen-reader-friendly topology outline, color-blind-safe palettes, light and dark themes.

LineWise is compatible with Cisco IOS, IOS-XE and NX-OS command output. It is not affiliated with or endorsed by Cisco or any other vendor.

## Install

1. Download the installer for your platform from the latest release.
2. Check the file against `SHA256SUMS.txt` if you like (`certutil -hashfile <file> SHA256` on Windows, `shasum -a 256 <file>` on macOS).
3. Install and open LineWise. Double-clicking a `.lwise` file opens it.

If a release notes that it is unsigned, Windows SmartScreen shows "Windows protected your PC" (choose **More info → Run anyway**) and macOS Gatekeeper blocks the app (right-click the app → **Open**). Signed builds do not need these steps.

Silent install for IT: `msiexec /i LineWise_<version>_x64_en-US.msi /qn` or `LineWise_<version>_x64-setup.exe /S`.

## Build from source

Prerequisites: [Node.js 22 LTS](https://nodejs.org), [pnpm 10](https://pnpm.io), [Rust stable](https://rustup.rs), and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/) (WebView2 and the Visual Studio C++ build tools on Windows, Xcode Command Line Tools on macOS).

```bash
git clone https://github.com/gavenrobertson/linewise.git
cd linewise
pnpm install
pnpm tauri dev            # run the desktop app
pnpm tauri build          # build installers for your OS
pnpm dev                  # or: run the UI in a browser at http://127.0.0.1:1420
```

`pnpm tauri build` produces signed updater artifacts only when `TAURI_SIGNING_PRIVATE_KEY` is set. For a local unsigned build, run `pnpm tauri build --config src-tauri/tauri.debug.conf.json` from `apps/desktop`.

## Documentation

- [User guide](docs/user/index.md) — drawing, devices and interfaces, VLANs and IPAM, views, validation, importing, exporting, shortcuts
- [Developer guide](docs/dev/index.md) — architecture, the command pattern, adding features, releases
- [File format](docs/file-format.md) and [JSON Schema](schema/v1.json)
- [Brand guide](docs/brand.md)

## Contributing

Contributions are welcome, especially device templates (with a public datasheet link), icons, validation rules and importers. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md) and report security issues as described in [SECURITY.md](SECURITY.md).

## License

[Apache-2.0](LICENSE). Bundled fonts (Sora, IBM Plex Mono) are under the SIL Open Font License 1.1. Third-party notices ship with the app (Help → About → Licenses).
