# LineWise — handoff for the next agent

Read this first, then `CLAUDE.md`, then `docs/SPEC.md` (the source of truth) and `docs/AGENT_PROMPT.md`.

## Where things stand (2026-10-11)

- **M0–M4 accepted** (tags v0.0.1–v0.4.0 are created locally; this environment cannot push tags, so `docs/HUMAN-TODO.md` lists each tag with its commit and the CI run that verified it).
- **M5 (export, polish, accessibility, performance) in acceptance.** Exports, the app shell, accessibility, reliability, privacy and security rows are done and traced. The open criterion is NFR-PERF-04: dragging one device with 500 on screen must stay under 16 ms per frame in the CI benchmark; see `docs/reports/M5.md`.
- **M6 (release engineering and v1.0) not started**: icons/installer images (BRD-01..05), signing, notarization, updater channels, docs site, release checklist.
- `node scripts/traceability.mjs --summary` gives the live status per requirement; `--require-must` is the v1.0 gate.

## How the work is checked

| Check                   | Command                                                          | Where it runs                        |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------ |
| Lint, format, types     | `pnpm lint`, `pnpm format`, `pnpm typecheck`                     | every push (ci.yml), husky           |
| Unit and component      | `pnpm test` (core, parsers, device-library, desktop, bench)      | ci.yml, Windows/macOS/Linux          |
| Scripts and repo rules  | `pnpm test:scripts`, `node scripts/traceability.mjs`             | ci.yml                               |
| i18n resource file      | `pnpm i18n --check`                                              | ci.yml                               |
| E2E (Chromium + WebKit) | `pnpm e2e` (21 specs: journeys 1–8 and per-area specs)           | ci.yml                               |
| Native smoke            | `apps/desktop/smoke/` (tauri-driver; WebView2 attach on Windows) | ci.yml, Linux and Windows            |
| Rust                    | `cargo clippy --all-targets -D warnings`, `cargo test`           | ci.yml                               |
| Fuzz (10,000 runs)      | `FUZZ_RUNS=10000 pnpm fuzz`                                      | nightly.yml (also a short run in CI) |
| Benchmarks              | `pnpm bench` (3 runs, medians, NFR targets, 20% budget)          | nightly.yml                          |
| Audits, CodeQL          | `pnpm audit`, `cargo audit`, CodeQL                              | ci.yml (pnpm), nightly.yml           |

`bench/profile.spec.ts` is a developer tool: CPU profile and rendering trace of an edit or a drag (`BENCH_PROFILE=drag BENCH_TRACE=1`).

## Notes that save time

- The browser build (`pnpm dev`, E2E) uses `BrowserPlatform` with test hooks on `window.__linewise` (queued open/save/binary-file answers, exports, menu commands) and read-only state on `window.__lwTest`.
- Performance work on the canvas: see the decisions log (2026-10-10/11). Props passed to React Flow must keep their identity; drag previews live in `useDragPreview`, outside the editor store; there is one hidden anchor per device and connection handles mount on hover only; edge ends come from React Flow, not node subscriptions; the minimap is drawn from the page model; labels are hidden below 40% zoom and devices are plain shapes below 25%.
- Timings in this cloud container vary by ±30% between hosts; compare variants on the same host, several runs each, or use the nightly on GitHub's runner.
- Tag pushes return HTTP 403 here: create tags locally and record them in `docs/HUMAN-TODO.md`.
- Vendor sites are blocked by the network policy, so FR-TPL-03 (vendor templates checked against datasheets) waits on the owner (HUMAN-TODO).

## Commands

```bash
pnpm install
pnpm dev                 # web UI on http://127.0.0.1:1420 (BrowserPlatform)
pnpm tauri dev           # desktop app (needs Rust + platform WebView)
pnpm test | pnpm lint | pnpm typecheck
pnpm e2e                 # builds, serves on :4173, runs Playwright
pnpm bench               # benchmarks; BENCH_RUNS=1 BENCH_SKIP_5000=1 for a quick local pass
pnpm schema              # regenerate schema/v1.json after schema changes
pnpm i18n                # regenerate en.json from the code
cd apps/desktop/src-tauri && cargo clippy --all-targets -- -D warnings && cargo test
```

Set `PW_CHROMIUM_PATH` to use a preinstalled Chromium; set `CI=1` (or `PW_ONLY_CHROMIUM=0`) to include WebKit.
