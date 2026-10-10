# Changelog

All notable changes to LineWise are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/). Requirement IDs refer to [docs/SPEC.md](docs/SPEC.md).

## [Unreleased]

## [0.4.0] - 2026-10-10

Import (milestone M4).

### Added

- Fuzz tests for every importer and for the `.lwise` loader, 10,000 inputs each, in every CI run (NFR-SEC-05).

### Fixed

- GNS3 import of a node without a name produced a device with no hostname.
- Containerlab import crashed on a link endpoint that was not text.
- YAML parser warnings no longer appear in the console.

## [0.3.0] - 2026-10-10

Validation (milestone M3).

### Added

- Problem badges on the canvas can be turned off from the View menu, the command palette or Preferences (FR-VAL-03).
- Every validation rule (VAL-001..020) is tested both ways: it fires on a bad configuration and stays silent on a good one.

## [0.2.0] - 2026-10-10

Network features (milestone M2).

### Added

- VLAN manager with ranges (`100-110,200`) in one step, colors, and the ports carrying each VLAN (FR-NET-05).
- Subnets and IPAM: utilization, next free IP, overlap detection, assignment from a subnet, VLSM planner; subnet calculator for IPv4 and IPv6; point-to-point /30 or /31 from a pool (FR-NET-06..08).
- Loopbacks, SVIs, tunnels and sub-interfaces as first-class interfaces that are never cabled (FR-NET-04).
- Device info card on hover; per-document label templates (FR-NET-09, FR-NET-10).
- Annotations (text, shapes, arrows, notes, embedded images), nested zones that carry their contents, multi-page diagrams with off-page connectors, and a layers panel (FR-CAN-10..13).
- L1/L2/L3 views over one model, VLAN highlight and shortest-path highlight (FR-NET-30..33).
- Template editor: from scratch or by cloning, range syntax, save to your library, JSON export and import (FR-TPL-04).

### Fixed

- After linking with the keyboard, focus returns to the device the link was drawn from; Alt+Arrow moves from the focused device.
- The connect dialog's device search picks an exact hostname first.

### Known gaps

- No vendor-model templates yet: their port layouts must be checked against vendor datasheets, which this build environment could not reach (FR-TPL-03).

## [0.1.0] - 2026-10-10

Core model and canvas (milestone M1).

### Added

- Network model with Zod schemas and a generated JSON Schema (`schema/v1.json`); every change is a command with Immer patches, with unlimited undo/redo and drag coalescing (FR-CAN-07).
- Canvas: pan (wheel, trackpad, Space+drag, middle button), zoom 10–400%, fit and zoom to selection, grid snap and alignment guides, minimap, every selection mode, nudge, arrange, group and lock, copy/paste across diagrams, drop on a link to insert a device (FR-CAN-01..09).
- Links: draw from a handle or drop on a device body; a port picker with "next free port" and type-to-filter; straight, orthogonal (routed around devices) and curved styles; bend points; interface labels that spread apart; media styles; parallel links and port-channel bundles (FR-LNK-01..06).
- Inspector with device fields, the full interface table and inline validation (FR-INS-01..04).
- Original Classic and Line icon sets for every role; generic templates; library with search, favorites and recently used (FR-ICO-01..03, FR-TPL-01/02/05).
- Diagram tabs, each with its own undo history (FR-APP-02).
- Stable, Git-friendly `.lwise` files; atomic save with `.bak`; autosave and crash recovery; recovery dialog for damaged files; newer files open read-only (FR-FMT-01..07).
- File-format specification with an annotated example (`docs/file-format.md`), architecture and developer guides, user guide start page and brand guide.
- `bench/`: generated 100–5,000-device networks and a performance benchmark (NFR-PERF-07).

### Fixed

- Hierarchical and orthogonal auto-layout failed in production builds.
- Zoom to fit no longer zooms past 100% (a blank page zoomed to 400% when the first device was placed).
- Bend points on a selected link can be dragged again.
- SVG export could carry markup from a hand-edited asset's MIME type; assets are now allowlisted (NFR-SEC-03).

## [0.0.1] - 2026-10-10

Foundation (milestone M0).

### Added

- pnpm monorepo: `apps/desktop` (Tauri 2 + React 19 + Vite + TypeScript strict), `packages/core`, `packages/parsers`, `packages/device-library`, `packages/brand`.
- ESLint (with architecture import rules), Prettier, rustfmt, clippy, commitlint and Husky hooks; Vitest, Playwright and a native tauri-driver smoke test.
- `PlatformAdapter` with `TauriPlatform` and `BrowserPlatform` implementations.
- Native menus (macOS app menu, in-window menu on Windows/Linux), strict CSP, least-privilege capabilities, panic hook and rotating logs.
- CI (`ci.yml`) on Linux, Windows and macOS: lint, format, typecheck, coverage-gated tests, Playwright in Chromium and WebKit, rustfmt/clippy/cargo test, debug installers, tauri-driver smoke test, license allowlist (npm + Cargo), cargo-deny and `pnpm audit`.
- Release (`release.yml`, `publish-channel.yml`), nightly (`nightly.yml`), template validation (`templates.yml`) and label sync workflows; Renovate.
- Community files: README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, PRIVACY, GOVERNANCE, CODEOWNERS, issue and PR templates; ADRs 0001–0005; `TRACEABILITY.md`.
- Bundled third-party notices, shown in Help → About → Licenses (OSS-03).

### Fixed

- The desktop app rendered an empty window: Tauri's `freezePrototype` made d3-color throw at startup. It is now off.
- Ctrl/Cmd+S, Ctrl/Cmd+O and other document shortcuts now work while a text field has focus (the edit is committed first).
- Outline items take keyboard focus when clicked, so L and Enter act on them in WKWebView.
