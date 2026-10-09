# LineWise implementation plan

Milestones follow `docs/SPEC.md` section 13. Each task is about half a day or less, lists the requirement IDs it covers, and names the tasks it depends on. Status lives in `TRACEABILITY.md`; this file is the order of work.

## M0 — Foundation (`v0.0.1`)

| # | Task | Requirements | Depends on |
| --- | --- | --- | --- |
| 0.1 | pnpm workspace, root scripts, TS base config, `.editorconfig`, `.gitignore` | NFR-MNT-01 | — |
| 0.2 | ESLint (flat config, typescript-eslint), Prettier, commitlint, Husky | NFR-MNT-01, REL-20 | 0.1 |
| 0.3 | `packages/core` skeleton, Vitest with coverage thresholds | NFR-MNT-02 | 0.1 |
| 0.4 | `packages/parsers` and `packages/device-library` skeletons | — | 0.1 |
| 0.5 | `packages/brand`: SVG masters, fonts, generation script | BRD-01 | 0.1 |
| 0.6 | `apps/desktop`: Vite + React 19 + Tailwind + Radix shell, i18n bootstrap | FR-APP-03, NFR-I18N-01 | 0.1 |
| 0.7 | `PlatformAdapter` interface, `BrowserPlatform`, `TauriPlatform` | NFR-SEC-01 | 0.6 |
| 0.8 | `src-tauri`: Tauri 2 shell, capabilities, CSP, native menus, panic hook, logging | FR-APP-01, NFR-SEC-02, NFR-REL-02/03 | 0.6 |
| 0.9 | Playwright config (Chromium + WebKit) against the browser build | — | 0.6, 0.7 |
| 0.10 | GitHub Actions: `ci.yml`, `release.yml`, `nightly.yml`, `templates.yml`; Renovate | REL-01..04, REL-20/21 | 0.2–0.9 |
| 0.11 | Community files: LICENSE, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, PRIVACY, GOVERNANCE, CODEOWNERS, issue/PR templates | OSS-01, OSS-10..14 | — |
| 0.12 | License allowlist check, third-party notices generator | OSS-02, OSS-03 | 0.1 |

## M1 — Core model and canvas (`v0.1.0`)

| # | Task | Requirements | Depends on |
| --- | --- | --- | --- |
| 1.1 | Zod schemas for every entity; JSON Schema generator | FR-FMT-02, FR-NET-01 | 0.3 |
| 1.2 | Command layer with Immer patches; History with coalescing | FR-CAN-07 | 1.1 |
| 1.3 | Interface naming module (normalize / abbreviate, range syntax) | FR-NET-02, FR-NET-03 | 1.1 |
| 1.4 | Device templates schema, generic templates for every role | FR-TPL-01, FR-TPL-02 | 1.1 |
| 1.5 | Original icon set (Classic + Line) for every role | FR-ICO-01..03 | 0.5 |
| 1.6 | Serializer: stable JSON, load with validation, migrations scaffold | FR-FMT-01..05 | 1.1 |
| 1.7 | Store wrapping core; canvas with custom nodes/edges, grid, snap, minimap | FR-CAN-01..03 | 1.2 |
| 1.8 | Selection, move, nudge, arrange, copy/paste/duplicate | FR-CAN-04..08 | 1.7 |
| 1.9 | Library panel with search, drag to canvas, drop-on-link insert | FR-TPL-05, FR-CAN-09 | 1.4, 1.7 |
| 1.10 | Links: interface picker, routing styles, interface labels, media styles | FR-LNK-01..05 | 1.7 |
| 1.11 | Inspector: device fields, interface table, inline validation | FR-INS-01..04 | 1.7 |
| 1.12 | Save/open, atomic save, autosave, recovery, recent files, file association | FR-FMT-06/07, FR-APP-09 | 1.6, 0.8 |
| 1.13 | `bench/` fixture generator | NFR-PERF-07 | 1.6 |

## M2 — Network features (`v0.2.0`)

| # | Task | Requirements | Depends on |
| --- | --- | --- | --- |
| 2.1 | IP/subnet math module, subnet calculator, VLSM | FR-NET-06, FR-NET-07 | 1.1 |
| 2.2 | VLAN manager, IPAM manager, point-to-point helper | FR-NET-05, FR-NET-06, FR-NET-08 | 2.1 |
| 2.3 | Logical interfaces, port-channels, parallel links and bundles | FR-NET-04, FR-LNK-06 | 1.10 |
| 2.4 | Zones/containers, multi-page, layers, annotations, images | FR-CAN-10..13 | 1.7 |
| 2.5 | L1/L2/L3 views, VLAN highlight, path highlight | FR-NET-30..33 | 2.2 |
| 2.6 | Template editor; verified vendor templates | FR-TPL-03, FR-TPL-04 | 1.4 |

## M3 — Validation (`v0.3.0`)

| # | Task | Requirements | Depends on |
| --- | --- | --- | --- |
| 3.1 | Rule engine, registry, issue model, quick fixes | FR-VAL-01, FR-VAL-04 | 2.1 |
| 3.2 | Rules VAL-001..020 with positive/negative tests | VAL-001..020 | 3.1 |
| 3.3 | Validation worker, problems panel, canvas badges, suppressions | FR-VAL-02, FR-VAL-03, FR-VAL-05 | 3.2 |

## M4 — Import (`v0.4.0`)

| # | Task | Requirements | Depends on |
| --- | --- | --- | --- |
| 4.1 | CDP and LLDP neighbor parsers + fixtures | FR-IMP-01, FR-IMP-02, FR-IMP-26 | 1.3 |
| 4.2 | Running-config and show-command parsers, secret stripping | FR-IMP-03, FR-IMP-04, FR-IMP-25 | 1.3 |
| 4.3 | CSV import with column mapping | FR-IMP-05 | 1.1 |
| 4.4 | Auto-detect, merge preview, de-duplication, single undo step | FR-IMP-20..23 | 4.1, 4.2 |
| 4.5 | ELK/d3 auto-layout worker; layout of imported devices | FR-CAN-14, FR-IMP-24 | 1.7 |
| 4.6 | draw.io, GNS3, Containerlab importers | FR-IMP-06..08 | 4.4 |

## M5 — Export, polish, accessibility, performance (`v0.9.0-beta`)

| # | Task | Requirements | Depends on |
| --- | --- | --- | --- |
| 5.1 | SVG and PNG export; PDF export with title block; print | FR-EXP-01..03, FR-EXP-10 | 1.7 |
| 5.2 | CSV, HTML/Markdown report, draw.io, Containerlab, Mermaid/DOT exports | FR-EXP-04..08 | 1.6 |
| 5.3 | Starter templates, welcome screen, preferences, command palette, find | FR-APP-05..08, FR-CAN-15 | 1.7 |
| 5.4 | Accessibility pass, topology outline panel, keyboard canvas | NFR-A11Y-01..05, FR-KEY-01/02 | 1.7 |
| 5.5 | Performance pass against NFR-PERF | NFR-PERF-01..07 | 1.13 |

## M6 — Release engineering and v1.0 (`v1.0.0`)

| # | Task | Requirements | Depends on |
| --- | --- | --- | --- |
| 6.1 | Signing, notarization, universal macOS, Windows x64/ARM64, MSI + NSIS | REL-01..04 | 0.10 |
| 6.2 | Updater with stable/beta channels; About dialog with licenses | REL-10..12, OSS-03 | 0.8 |
| 6.3 | App and document icons from brand masters; brand in installers and UI | BRD-02..05 | 0.5 |
| 6.4 | User guide, developer guide, file-format spec, brand guide | DOC-01..06, BRD-06 | — |
| 6.5 | Release checklist on the four target machines | — | 6.1 |
