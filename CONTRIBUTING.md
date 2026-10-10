# Contributing to LineWise

Thanks for helping. This guide covers setup, project structure, standards, and how to add the things contributors most often add: device templates, icons, validation rules and importers.

By contributing you agree that your contribution is licensed under [Apache-2.0](LICENSE) and you certify the [Developer Certificate of Origin](https://developercertificate.org/) by signing off each commit (`git commit -s`). There is no CLA.

## Development setup

### Prerequisites (both platforms)

- Node.js 22 LTS and pnpm 10 (`corepack enable` installs the pinned pnpm)
- Rust stable (`rustup default stable`)

### Windows 10/11

1. Install the [Visual Studio 2022 Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload.
2. WebView2 is preinstalled on Windows 11 and current Windows 10. If not, install the Evergreen runtime.
3. For MSI builds, enable the "VBSCRIPT" optional feature (Settings → Apps → Optional features) — WiX needs it.

### macOS 12+

1. `xcode-select --install`
2. For universal builds: `rustup target add aarch64-apple-darwin x86_64-apple-darwin`

### Linux (best effort)

`sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev patchelf`

### Run it

```bash
pnpm install
pnpm tauri dev      # desktop app with hot reload
pnpm dev            # the same UI in a browser (uses BrowserPlatform, no Rust needed)
```

## Project structure

| Path                      | What lives there                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`           | The network model (Zod schemas), commands with Immer patches, undo/redo, IP math, naming, validation rules, serializers and exporters. No React, DOM or Tauri. |
| `packages/parsers`        | Importers: `string → ParseResult`. Pure functions, no side effects.                                                                                            |
| `packages/device-library` | Device templates (JSON), original SVG icons, starter diagrams.                                                                                                 |
| `packages/brand`          | Logo masters, lockups and bundled fonts. Do not redraw the masters.                                                                                            |
| `apps/desktop/src`        | React UI: canvas, panels, dialogs, exporters, workers, `platform/` adapters.                                                                                   |
| `apps/desktop/src-tauri`  | Rust shell: atomic save, recovery, menus, updater, capabilities.                                                                                               |
| `apps/desktop/e2e`        | Playwright journeys. `apps/desktop/smoke` has the native tauri-driver smoke test.                                                                              |
| `bench/`                  | Large generated diagrams and performance tests.                                                                                                                |
| `docs/`                   | Spec, plan, ADRs, user and developer guides, file-format spec.                                                                                                 |

Read [`docs/dev/architecture.md`](docs/dev/architecture.md) before larger changes. Three rules are enforced by lint and review:

1. **Every model change is a command** from `@linewise/core`, run through the editor store. UI code never mutates the document. One user action is one undo step.
2. **`core` and `parsers` stay framework-free** (ESLint blocks React, DOM-only and Tauri imports).
3. **OS access goes through `PlatformAdapter`** (`apps/desktop/src/platform`). Only that folder may import `@tauri-apps/*`.

## Coding standards

- TypeScript `strict`. No `any` without an `eslint-disable` comment that says why.
- Prettier formatting, ESLint clean, `cargo fmt` and `cargo clippy -- -D warnings` clean.
- `// SPDX-License-Identifier: Apache-2.0` at the top of every source file.
- UI strings go through i18next: `t('area.key', 'English default')`. Run `pnpm i18n` to refresh `en.json`.
- Every interactive control has an accessible name. Component tests run axe-core and must report zero violations.
- Reference requirement IDs from [`docs/SPEC.md`](docs/SPEC.md) in code comments, tests and commits, and update [`TRACEABILITY.md`](TRACEABILITY.md).

## Commits and pull requests

- [Conventional Commits](https://www.conventionalcommits.org/), checked by commitlint: `feat(canvas): marquee selection [FR-CAN-04]`.
- Sign off every commit (`-s`). The DCO check blocks unsigned commits.
- Keep PRs focused. Fill in the PR template checklist: tests, docs, changelog, screenshots.
- Add a line to `CHANGELOG.md` under **Unreleased**.

## Running the tests

| Suite                                                 | Command                                                                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Everything fast (unit, property, golden, component)   | `pnpm test`                                                                                                            |
| With coverage gates (≥ 80% lines on core and parsers) | `pnpm test:coverage`                                                                                                   |
| One package                                           | `pnpm --filter @linewise/core test`                                                                                    |
| Lint / format / types                                 | `pnpm lint` · `pnpm format` · `pnpm typecheck`                                                                         |
| End-to-end journeys (Chromium; WebKit in CI)          | `pnpm e2e`                                                                                                             |
| Fuzz at nightly strength                              | `FUZZ_RUNS=10000 pnpm fuzz`                                                                                            |
| Benchmarks                                            | `pnpm bench`                                                                                                           |
| Rust                                                  | `cd apps/desktop/src-tauri && cargo test && cargo clippy --all-targets -- -D warnings`                                 |
| Native smoke (Windows/Linux, needs tauri-driver)      | `pnpm --filter @linewise/desktop tauri build --debug --no-bundle` then `node --test apps/desktop/smoke/smoke.test.mjs` |
| Dependency licenses                                   | `pnpm licenses:check`                                                                                                  |

Regenerate the JSON Schema after changing a Zod schema: `pnpm schema`.

## Adding a device template (FR-TPL-07)

1. Create `packages/device-library/templates/<vendor>/<model>.json`. Use an existing file as a model and validate against the template schema in `packages/core/src/templates.ts`.
2. Fill in `sourceUrl` with the **public datasheet** you took the port layout from, and your name or handle in `contributor`.
3. **Do not guess port counts.** If you could not check every port against the datasheet, set `"verified": false` and add the template to [`docs/unverified-templates.md`](docs/unverified-templates.md).
4. Use range syntax for interfaces, e.g. `{ "range": "Gi1/0/1-48", "poe": true }` or `{ "range": "Te1/1/1-4", "media": "fiber" }`.
5. Run `pnpm --filter @linewise/device-library index` to regenerate the typed index, then `pnpm --filter @linewise/device-library test`. CI (`templates.yml`) checks the schema, unique ids and the datasheet link.

## Adding an icon (FR-ICO-01..08)

Icons are original drawings in `packages/device-library/icons/{classic,line}/<role>.svg`: a 64×64 viewBox, 2 px strokes, `currentColor` only, no scripts, links or embedded raster images. Follow the conventions in spec section 5 (router = round body with four arrows, switch = flat box with parallel arrows, and so on). **Never trace or copy vendor icon files or logos.** Run `pnpm --filter @linewise/device-library icons` and the library tests.

## Adding a validation rule (FR-VAL-04)

Rules live in `packages/core/src/validation.ts` and are registered with `registerRule`. A rule is `{ id, severity, title, run }` where `run(ctx)` is a pure function of the document (plus precomputed link lookups) that returns issues with a message, the affected object ids and optional quick fixes (which are commands). Add a positive and a negative test in `packages/core/test/validation.test.ts`, then list the rule in `TRACEABILITY.md` and the user guide.

## Adding an importer

Parsers live in `packages/parsers/src` and return `ParseResult { entities, unparsedLines, warnings }`. They must never execute input, must strip secrets (FR-IMP-25), must run in linear time and must not throw. Add at least five sanitized fixtures under `packages/parsers/fixtures/<kind>/` (one malformed), golden snapshot tests, and add the kind to the fuzz test. Register it with the auto-detector in `detect.ts`.

## Questions

Open a discussion or an issue. For security problems, follow [SECURITY.md](SECURITY.md) instead.
