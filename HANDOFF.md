# LineWise — handoff for the next agent

Read this first, then `CLAUDE.md`, then `docs/SPEC.md` (the source of truth) and `docs/AGENT_PROMPT.md`.

## Where things stand (2026-10-11)

- **M0–M5 accepted** (tags v0.0.1–v0.9.0-beta are created locally; this environment cannot push tags, so `docs/HUMAN-TODO.md` lists each tag with its commit and the CI run that verified it).
- **M6 (release engineering and v1.0): everything buildable from the repo is done** — icons and installer images from the brand masters, the `.lwise` document icon on Windows and macOS, release gates (installer size, idle memory), update-flow tests, the VitePress docs site, the DCO check and the `main` ruleset. See `docs/reports/M6.md`.
- **Open, owner only:** updater keys, Apple and Windows signing, pushing the tags, enabling GitHub Pages, importing the branch ruleset (REL-21), vendor datasheets (FR-TPL-03), and the manual release checklist on four machines. `v1.0.0` is tagged after the checklist passes (`docs/HUMAN-TODO.md`).
- `node scripts/traceability.mjs --summary` gives the live status per requirement; `--require-must` is the v1.0 gate (FR-TPL-03 and REL-21 are the open MUSTs).

- **UI/UX polish (2026-10-12):** motion and depth tokens, readable link labels with placement,
  hover cards, tooltips everywhere, help in context, tips, a first-run tour and empty states
  (FR-UX-01..13, SHOULD, in `TRACEABILITY.md`). See `docs/reports/ui-ux-polish.md`. Link-label
  placement lives in `canvas/model.ts` (`placeLinkLabels`) and keeps per-link caches; keep edits
  under the 20% bench budget when touching it. Tips and the tour are off under `navigator.webdriver`
  unless `localStorage['linewise.e2e.help'] = '1'`.

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
| Docs site               | `pnpm docs:build` (VitePress, fails on dead links)               | docs.yml (publishes from main)       |
| Installers              | document icon registration, sizes under 25 MB                    | ci.yml (Windows, macOS), release.yml |

`bench/profile.spec.ts` is a developer tool: CPU profile and rendering trace of an edit or a drag (`BENCH_PROFILE=drag BENCH_TRACE=1`).

## Notes that save time

- The browser build (`pnpm dev`, E2E) uses `BrowserPlatform` with test hooks on `window.__linewise` (queued open/save/binary-file answers, exports, menu commands) and read-only state on `window.__lwTest`.
- Performance work on the canvas: see the decisions log (2026-10-10/11). Props passed to React Flow must keep their identity; drag previews live in `useDragPreview`, outside the editor store; there is one hidden anchor per device and connection handles mount on hover only; edge ends come from React Flow, not node subscriptions; the minimap is drawn from the page model; labels are hidden below 40% zoom and devices are plain shapes below 25%.
- Timings in this cloud container vary by ±30% between hosts; compare variants on the same host, several runs each, or use the nightly on GitHub's runner.
- Tag pushes return HTTP 403 here: create tags locally and record them in `docs/HUMAN-TODO.md`.
- Vendor sites are blocked by the network policy, so FR-TPL-03 (vendor templates checked against datasheets) waits on the owner (HUMAN-TODO).
- App icons and installer images are generated and checked in: after changing a brand master run `pnpm --filter @linewise/brand build` and then `pnpm --filter @linewise/brand icons` (needs Chromium; `PW_CHROMIUM_PATH`). `scripts/brand.test.mjs` fails until you do.
- The docs are written to read on GitHub (relative links); on the site, links to repo files outside `docs/` are rewritten to GitHub (`docs/.vitepress/repoLinks.ts`).

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
pnpm docs:dev            # docs site on http://localhost:5173/linewise/
cd apps/desktop/src-tauri && cargo clippy --all-targets -- -D warnings && cargo test
```

Set `PW_CHROMIUM_PATH` to use a preinstalled Chromium; set `CI=1` (or `PW_ONLY_CHROMIUM=0`) to include WebKit.
