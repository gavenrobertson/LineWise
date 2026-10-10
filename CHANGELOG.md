# Changelog

All notable changes to LineWise are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/). Requirement IDs refer to [docs/SPEC.md](docs/SPEC.md).

## [Unreleased]

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
