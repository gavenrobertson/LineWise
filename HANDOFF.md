# LineWise — handoff for the next agent

Read this first, then `CLAUDE.md`, then `docs/SPEC.md` (the source of truth) and `docs/AGENT_PROMPT.md`.

## Where things stand (2026-10-10)

Milestones M0–M2 are essentially complete, M3–M5 are mostly done, M6 (release engineering) is not started.

**Verified green in the build sandbox**

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck` | clean |
| Unit/property/golden/component tests (`pnpm test`) | 282 passing (core 122, parsers 97, device-library 14, desktop 49) |
| Component a11y (axe-core, jsdom) | zero violations on inspector, toolbar, status bar, problems panel, 13 dialogs |
| E2E journeys 1–8 (`pnpm e2e`, Chromium) | 8/8 passing |
| Rust (`cargo clippy --all-targets -D warnings`, `cargo test`) | clean / passing |
| Frontend production build (`vite build`) | builds |

**Not verified here** (the sandbox has no WebKit, no macOS/Windows, no GitHub push):
WebKit E2E project, native Tauri bundles (`pnpm tauri build`), installers, signing, notarization, auto-update, `tauri-driver` smoke test, real WKWebView/WebView2 behavior (menus, print, close prompt).

## What exists

- `packages/core` — model (Zod), commands + undo/redo (Immer patches), IP math, naming, validation rules VAL-001…020 with quick fixes, serializer (stable JSON, migrations, recovery), exporters (CSV ×5, Markdown/HTML report, draw.io, Containerlab, Mermaid, DOT), JSON Schema generator → `schema/v1.json` (drift test; regenerate with `pnpm schema`).
- `packages/parsers` — CDP, LLDP (incl. lldpctl), running-config (secrets stripped), show ip int brief / interfaces status / vlan brief / etherchannel summary, CSV with column mapping, draw.io, GNS3, Containerlab, Nmap XML; auto-detect; import plan + merge (single undo step). 61 fixtures, golden snapshots, fuzz.
- `packages/device-library` — original icon set (27 roles, Classic + Line), 31 generic templates, 7 starter diagrams.
- `packages/brand` — logo masters, lockups, bundled OFL fonts.
- `apps/desktop` — Tauri 2 shell (atomic save + .bak, path allowlist, recovery folder, recent files, native menus, file association, single instance, close prompt, native print on macOS, updater wiring) and the React UI: canvas, library/outline/layers sidebar, inspector + interface table, problems panel, pages, status bar, welcome/starters/recovery, import preview-and-merge, export (PNG/SVG/PDF/CSV/reports/draw.io/clab/Mermaid/DOT), print, VLAN manager, IPAM (subnets, VLSM, point-to-point, VRFs), subnet calculator, preferences, icon packs (zip/SVG/PNG + manifest, sanitized, embedded on use), command palette, find, auto-layout (ELK/d3 in a worker, cancellable), template editor, connect dialog, group/lock/front-back, copy/paste style, off-page connectors, link bend points, presentation mode.

## What is left (in suggested order)

1. **CI/CD (spec §11, M6)** — `.github/workflows/ci.yml` (lint, typecheck, test+coverage gates, Playwright Chromium + WebKit, cargo test/clippy/audit, license check), `release.yml` (tag → `tauri-action` matrix for Windows x64/ARM64 + macOS universal, signing/notarization with secrets as placeholders, updater JSON for stable/beta), `nightly.yml` (fuzz at 10,000 runs: `FUZZ_RUNS=10000`, benchmarks), Renovate config, Dependabot for Cargo if wanted.
2. **Missing scripts referenced in `package.json`** — `scripts/check-licenses.mjs` (allowlist: MIT, Apache-2.0, BSD-2/3, ISC, OFL-1.1, 0BSD, MPL-2.0 for files only) and `scripts/third-party-notices.mjs` (writes `THIRD_PARTY_NOTICES.md`; About dialog links to it).
3. **Performance (NFR-PERF, M5)** — `bench/` generators for 100/500/2,000/5,000-device files + a Playwright benchmark with a 20% regression gate. Validate the 2,000-device pan/zoom target with `onlyRenderVisibleElements`.
4. **i18n extraction** — `scripts/extract-i18n.mjs` to collect `t('key', 'default')` calls into `apps/desktop/src/i18n/locales/en.json` (currently `{}`; defaults are inline so the UI works).
5. **Docs & community files** — README (with screenshots), CONTRIBUTING (incl. template contribution path FR-TPL-07), CODE_OF_CONDUCT, SECURITY, issue/PR templates, `docs/user-guide.md`, `docs/dev-guide.md`, `docs/file-format.md`, `docs/brand.md`, `docs/release-checklist.md`, CHANGELOG; update `TRACEABILITY.md` statuses (all still `todo`) and write `docs/reports/M0…M6.md`.
6. **Feature gaps** — vendor-model templates with datasheet `sourceUrl` (FR-TPL-03; only generic templates ship today), orthogonal routing that avoids nodes and smarter label overlap avoidance (FR-LNK-02/03), visual-regression screenshots, `tauri-driver` Windows smoke test. SHOULDs not started: rack elevation view (FR-NET-13), NetBox device-type importer (FR-TPL-06).
7. **Human-only steps** — see `docs/HUMAN-TODO.md` (Apple Developer ID + notarization, Windows signing, updater keypair → replace `REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY` in `tauri.conf.json`, GitHub repo + secrets).

## Commands

```bash
pnpm install
pnpm dev                 # web UI on http://127.0.0.1:1420 (BrowserPlatform)
pnpm tauri dev           # desktop app (needs Rust + platform WebView)
pnpm test | pnpm lint | pnpm typecheck
pnpm e2e                 # builds, serves on :4173, runs Playwright
pnpm schema              # regenerate schema/v1.json after schema changes
cd apps/desktop/src-tauri && cargo clippy --all-targets -- -D warnings && cargo test
```

Set `PW_CHROMIUM_PATH` to use a preinstalled Chromium; set `CI=1` (or `PW_ONLY_CHROMIUM=0`) to include WebKit.
