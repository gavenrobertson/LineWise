# Developer guide

Start with [CONTRIBUTING.md](../../CONTRIBUTING.md) for setup, coding standards and commit rules.
This guide covers how the code fits together and how to build a feature end to end.

- [Architecture](architecture.md): layers, data flow, commands, tabs, performance, security
- [Release process](release.md): versioning, tags, signing, update channels
- [File format](../file-format.md): the `.lwise` JSON format and its schema
- [Brand](../brand.md): logo files, colors and fonts
- [Architecture decision records](../adr/) and the [decisions log](../decisions-log.md)
- [Traceability matrix](../../TRACEABILITY.md): every requirement, where it is built and tested

## Everyday commands

| Task                                                     | Command                                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Run the app with hot reload                              | `pnpm tauri dev`                                                                                           |
| Run the UI in a browser (no Rust)                        | `pnpm dev`                                                                                                 |
| Unit, property, golden and component tests               | `pnpm test`                                                                                                |
| Same, with coverage gates                                | `pnpm test:coverage`                                                                                       |
| End-to-end journeys (Playwright, Chromium and WebKit)    | `pnpm e2e`                                                                                                 |
| Lint, format check, types                                | `pnpm lint`, `pnpm format`, `pnpm typecheck`                                                               |
| Repository rules and script tests                        | `pnpm test:scripts`                                                                                        |
| Traceability check                                       | `pnpm traceability`                                                                                        |
| Regenerate the JSON Schema after a schema change         | `pnpm schema`                                                                                              |
| Regenerate the English strings after UI text changes     | `pnpm i18n`                                                                                                |
| Parser and loader fuzzing (set `FUZZ_RUNS`)              | `pnpm fuzz`                                                                                                |
| Performance benchmarks                                   | `pnpm bench`                                                                                               |
| Native smoke test (needs a debug build and tauri-driver) | `node --test apps/desktop/smoke/smoke.test.mjs`                                                            |
| Rust checks                                              | `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` in `apps/desktop/src-tauri` |

## Adding a feature end to end

This example adds a hypothetical "link color" field. Every step has a test.

1. **Spec and traceability.** Find the requirement ID in [`docs/SPEC.md`](../SPEC.md). Add or
   update its row in `TRACEABILITY.md` with the modules and tests you are about to write.
2. **Model.** Add the field to the Zod schema in `packages/core/src/schema.ts`, with a default if
   older files lack it. Run `pnpm schema` to regenerate `schema/v1.json`. If old files need
   rewriting, bump `SCHEMA_VERSION` and register a migration with a fixture file.
3. **Command.** Add a factory in `packages/core/src/commands.ts` that changes the draft, for
   example `updateLinkStyle(ids, { color })`. Test it in `packages/core/test/`: that it applies,
   that undo restores the previous document, and that bad input throws.
4. **Derived state.** If the canvas shows the field, compute it in `apps/desktop/src/canvas/model.ts`
   (pure, unit-tested in `apps/desktop/test/`) and render it in the node or edge component.
5. **UI.** Add the control to the inspector or a dialog. Dispatch the command through the store
   (`useEditor((s) => s.execute)`); never edit the document object. Give the control an accessible
   name and an i18n key with an English default. Add a component test with Testing Library
   that runs axe.
6. **Exporters.** If the field is visible, check the SVG, PNG and PDF exporters
   (`apps/desktop/src/export/`) and the text exporters in `packages/core/src/exporters.ts`.
7. **Validation.** If the field can be wrong, add a rule with a positive and a negative test
   (see CONTRIBUTING.md, "Adding a validation rule").
8. **End to end.** If it is part of a user journey, extend a Playwright spec in
   `apps/desktop/e2e/`. Tests use roles and accessible names, not CSS classes, where possible.
9. **Docs.** Update the user guide page that covers the feature, and `CHANGELOG.md` under
   **Unreleased**.
10. **Commit.** Use a Conventional Commit that names the requirement, for example
    `feat(links): per-link color [FR-LNK-04]`, and sign it off (`git commit -s`).

## Where things are

| You want to change…                                | Look in                                                                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Keyboard shortcuts, menu commands, palette entries | `apps/desktop/src/lib/actions.ts`, `lib/keyboard.ts`, `src-tauri/src/menu.rs`                                   |
| What the canvas draws                              | `apps/desktop/src/canvas/` (`model.ts` derives, `nodes.tsx` and `NetworkEdge.tsx` render, `geometry.ts` routes) |
| Auto-layout                                        | `apps/desktop/src/layout/layouts.ts`, workers in `apps/desktop/src/workers/`                                    |
| Validation rules                                   | `packages/core/src/validation.ts`                                                                               |
| Importers                                          | `packages/parsers/src/` (`detect.ts` picks the format, `merge.ts` builds the import plan)                       |
| File open, save, recovery                          | `apps/desktop/src/platform/`, `src-tauri/src/files.rs`                                                          |
| Theme colors                                       | `apps/desktop/src/styles.css` (see [brand.md](../brand.md))                                                     |

## Testing notes

- `apps/desktop/src/platform/browser.ts` lets Playwright drive the real UI in Chromium and WebKit.
  Tests reach test-only hooks through `window.__linewise` (queued open and save results, menu
  events) and `window.__lwTest` (read the current document).
- The tauri-driver smoke test runs the real app on Windows and Linux in CI. macOS has no
  WKWebView driver, so the release checklist covers it by hand.
- Benchmarks compare against `bench/baseline.json` only when it was recorded on the same kind of
  machine. Set `BENCH_UPDATE_BASELINE=1` to record a new baseline.
