# Working on LineWise

- Spec is law: `docs/SPEC.md`. Requirement IDs (FR-…, NFR-…) go in code comments and `TRACEABILITY.md`. Decisions go in `docs/decisions-log.md` or a new ADR.
- Every model change is a Command from `@linewise/core` run through the editor store (`useEditor().execute`). Never mutate the document directly; one user action = one undo step (use `batch`).
- `packages/core` and `packages/parsers` are framework-free (ESLint enforces). Only `apps/desktop/src/platform/*` may import `@tauri-apps/*`.
- Pure geometry/model code lives in `canvas/geometry.ts`, `canvas/model.ts`, `canvas/icons.ts`, `canvas/edgeGeometry.ts` and is shared by the canvas and the SVG/PDF exporters — keep exports matching the screen.
- New Rust commands: add to `build.rs` AppManifest, `capabilities/default.json`, and `generate_handler!`.
- New menu commands: add to `MenuCommand` (platform/types.ts), `commandList()` (lib/actions.ts) and `src-tauri/src/menu.rs`; a test checks the menu only sends known commands. On macOS the menu owns shortcuts (Edit items are native); elsewhere `lib/keyboard.ts` handles them.
- UI strings: `t('key', 'English default')`. Accessible names on every control; component tests run axe.
- Before committing: `pnpm lint && pnpm typecheck && pnpm test` (husky runs lint + typecheck), Conventional Commits, SPDX header `// SPDX-License-Identifier: Apache-2.0` on new source files.
- TypeScript is pinned to ~6.0 (typescript-eslint compatibility).
