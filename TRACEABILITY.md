# Traceability matrix

Every requirement ID in `docs/SPEC.md` → implementing module(s) → test file(s) → status. Status values: `todo`, `in-progress`, `done`, `partial`, `deferred`.

| Requirement | Priority | Module(s) | Test(s) | Status |
| --- | --- | --- | --- | --- |
| FR-APP-01 | MUST | `apps/desktop/src-tauri/src/menu.rs`, `apps/desktop/src/lib/actions.ts` | `apps/desktop/test/config.test.ts`, `apps/desktop/test/pure.test.ts` | done |
| FR-APP-02 | MUST | `apps/desktop/src/store/editor.ts`, `apps/desktop/src/panels/TabBar.tsx`, `apps/desktop/src/lib/actions.ts` — tabs in one window on both OSes (decisions log) | `apps/desktop/test/tabs.test.ts`, `apps/desktop/test/components.test.tsx`, `apps/desktop/e2e/10-tabs.spec.ts` | done |
| FR-APP-03 | MUST | `apps/desktop/src/App.tsx`, `apps/desktop/src/panels/SidePanel.tsx`, `apps/desktop/src/panels/Inspector.tsx`, `apps/desktop/src/panels/ProblemsPanel.tsx`, `apps/desktop/src/panels/Toolbar.tsx` | `apps/desktop/e2e/17-app-shell.spec.ts` | done |
| FR-APP-04 | MUST | `apps/desktop/src/store/prefs.ts`, `apps/desktop/src/styles.css` | `apps/desktop/e2e/17-app-shell.spec.ts`, `apps/desktop/e2e/14-a11y.spec.ts` | done |
| FR-APP-05 | MUST | `apps/desktop/src/dialogs/WelcomeDialog.tsx`, `apps/desktop/src/platform/browser.ts`, `apps/desktop/src-tauri/src/files.rs` (recent files) | `apps/desktop/e2e/17-app-shell.spec.ts` | done |
| FR-APP-06 | MUST | `packages/device-library/src/starters.ts`, `apps/desktop/src/dialogs/WelcomeDialog.tsx` | `packages/device-library/test/starters.test.ts`, `apps/desktop/e2e/17-app-shell.spec.ts` | done |
| FR-APP-07 | MUST | `apps/desktop/src/dialogs/PreferencesDialog.tsx`, `apps/desktop/src/store/prefs.ts` | `apps/desktop/test/components.test.tsx`, `apps/desktop/e2e/17-app-shell.spec.ts` | done |
| FR-APP-08 | MUST | `apps/desktop/src/dialogs/CommandPalette.tsx`, `apps/desktop/src/lib/actions.ts` | `apps/desktop/test/components.test.tsx`, `apps/desktop/test/pure.test.ts`, `apps/desktop/e2e/17-app-shell.spec.ts` | done |
| FR-APP-09 | MUST | `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/src/lib.rs` — association and open-with done; .lwise document icon comes with BRD-03 (M6) | `apps/desktop/test/config.test.ts`, `apps/desktop/smoke/smoke.test.mjs` | partial |
| FR-CAN-01 | MUST | `apps/desktop/src/canvas/Canvas.tsx`, `apps/desktop/src/lib/actions.ts` | `apps/desktop/e2e/09-canvas.spec.ts` | done |
| FR-CAN-02 | MUST | `apps/desktop/src/canvas/Canvas.tsx`, `apps/desktop/src/store/prefs.ts`, `apps/desktop/src/dialogs/PreferencesDialog.tsx` | `apps/desktop/e2e/09-canvas.spec.ts`, `apps/desktop/e2e/11-files.spec.ts` | done |
| FR-CAN-03 | MUST | `apps/desktop/src/canvas/Canvas.tsx` | `apps/desktop/e2e/09-canvas.spec.ts` | done |
| FR-CAN-04 | MUST | `apps/desktop/src/canvas/Canvas.tsx`, `packages/core/src/selectors.ts` | `apps/desktop/e2e/09-canvas.spec.ts` | done |
| FR-CAN-05 | MUST | `apps/desktop/src/canvas/Canvas.tsx`, `apps/desktop/src/canvas/nodes.tsx`, `apps/desktop/src/lib/keyboard.ts`, `packages/core/src/commands.ts` | `apps/desktop/e2e/09-canvas.spec.ts`, `packages/core/test/commands.test.ts` | done |
| FR-CAN-06 | MUST | `apps/desktop/src/lib/actions.ts`, `packages/core/src/commands.ts` | `apps/desktop/e2e/09-canvas.spec.ts`, `packages/core/test/commands.test.ts` | done |
| FR-CAN-07 | MUST | `packages/core/src/history.ts`, `apps/desktop/src/store/editor.ts` — includes the undo/redo property test | `packages/core/test/commands.test.ts`, `apps/desktop/test/tabs.test.ts`, `apps/desktop/e2e/09-canvas.spec.ts` | done |
| FR-CAN-08 | MUST | `packages/core/src/commands.ts`, `packages/core/src/document.ts`, `apps/desktop/src/lib/actions.ts` | `packages/core/test/commands.test.ts`, `apps/desktop/e2e/09-canvas.spec.ts`, `apps/desktop/e2e/11-files.spec.ts` | done |
| FR-CAN-09 | MUST | `apps/desktop/src/canvas/Canvas.tsx`, `packages/core/src/commands.ts` | `apps/desktop/e2e/09-canvas.spec.ts`, `packages/core/test/commands.test.ts` | done |
| FR-CAN-10 | MUST | `apps/desktop/src/lib/actions.ts`, `apps/desktop/src/canvas/nodes.tsx` | `apps/desktop/e2e/12-network.spec.ts` | done |
| FR-CAN-11 | MUST | `apps/desktop/src/canvas/Canvas.tsx`, `packages/core/src/commands.ts` | `apps/desktop/e2e/12-network.spec.ts`, `packages/core/test/commands.test.ts` | done |
| FR-CAN-12 | MUST | `apps/desktop/src/panels/PagesBar.tsx`, `apps/desktop/src/panels/OutlinePanel.tsx`, `packages/core/src/commands.ts` | `apps/desktop/e2e/12-network.spec.ts`, `packages/core/test/commands.test.ts` | done |
| FR-CAN-13 | MUST | `apps/desktop/src/panels/LayersPanel.tsx` | `apps/desktop/e2e/12-network.spec.ts` | done |
| FR-NET-30 | MUST | `packages/core/src/selectors.ts`, `apps/desktop/src/canvas/model.ts`, `apps/desktop/src/panels/Toolbar.tsx` | `packages/core/test/selectors.test.ts`, `apps/desktop/e2e/02-views-and-vlan.spec.ts` | done |
| FR-CAN-14 | MUST | `apps/desktop/src/layout/layouts.ts`, `apps/desktop/src/workers/elk.ts`, `apps/desktop/src/workers/layout.worker.ts` | `apps/desktop/e2e/09-canvas.spec.ts` | done |
| FR-CAN-15 | MUST | `apps/desktop/src/dialogs/FindPanel.tsx`, `apps/desktop/src/lib/search.ts` | `apps/desktop/test/pure.test.ts`, `apps/desktop/e2e/21-find.spec.ts` | done |
| FR-CAN-16 | SHOULD | | | todo |
| FR-CAN-17 | SHOULD | | | todo |
| FR-LNK-01 | MUST | `apps/desktop/src/canvas/Canvas.tsx`, `apps/desktop/src/dialogs/ConnectDialog.tsx`, `packages/core/src/commands.ts` | `apps/desktop/e2e/09-canvas.spec.ts`, `apps/desktop/test/routing.test.ts`, `packages/core/test/commands.test.ts` | done |
| FR-LNK-02 | MUST | `apps/desktop/src/canvas/geometry.ts`, `apps/desktop/src/canvas/NetworkEdge.tsx`, `apps/desktop/src/canvas/model.ts` | `apps/desktop/test/routing.test.ts`, `apps/desktop/e2e/09-canvas.spec.ts` | done |
| FR-LNK-03 | MUST | `packages/core/src/selectors.ts`, `apps/desktop/src/canvas/model.ts` | `packages/core/test/selectors.test.ts`, `apps/desktop/test/routing.test.ts` | done |
| FR-LNK-04 | MUST | `apps/desktop/src/canvas/model.ts`, `apps/desktop/src/canvas/NetworkEdge.tsx` | `apps/desktop/test/linkstyle.test.ts` | done |
| FR-LNK-05 | MUST | `apps/desktop/src/canvas/model.ts` | `apps/desktop/test/linkstyle.test.ts` | done |
| FR-LNK-06 | MUST | `apps/desktop/src/canvas/model.ts`, `apps/desktop/src/canvas/NetworkEdge.tsx` | `apps/desktop/test/linkstyle.test.ts` | done |
| FR-INS-01 | MUST | `apps/desktop/src/panels/Inspector.tsx` | `apps/desktop/test/components.test.tsx`, `apps/desktop/e2e/09-canvas.spec.ts` | done |
| FR-INS-02 | MUST | `apps/desktop/src/panels/Inspector.tsx`, `packages/core/src/commands.ts` | `apps/desktop/test/components.test.tsx`, `packages/core/test/commands.test.ts` | done |
| FR-INS-03 | MUST | `apps/desktop/src/panels/InterfaceTable.tsx` | `apps/desktop/test/components.test.tsx`, `packages/core/test/commands.test.ts` | done |
| FR-INS-04 | MUST | `apps/desktop/src/panels/Inspector.tsx` | `apps/desktop/test/components.test.tsx` | done |
| FR-KEY-01 | MUST | `apps/desktop/src/lib/keyboard.ts`, `apps/desktop/src/dialogs/ShortcutsDialog.tsx`, `apps/desktop/src-tauri/src/menu.rs` | `apps/desktop/test/pure.test.ts`, `apps/desktop/test/components.test.tsx`, `apps/desktop/e2e/17-app-shell.spec.ts` | done |
| FR-KEY-02 | MUST | `apps/desktop/src/lib/keyboard.ts`, `apps/desktop/src/lib/actions.ts`, `apps/desktop/src/panels/Inspector.tsx` (zone and annotation size, bend points), `apps/desktop/src/panels/OutlinePanel.tsx` | `apps/desktop/e2e/07-keyboard-only.spec.ts`, `apps/desktop/e2e/13-campus.spec.ts`, `apps/desktop/e2e/18-a11y-keyboard.spec.ts` | done |
| FR-NET-01 | MUST | `packages/core/src/commands.ts`, `packages/core/src/templates.ts` | `packages/core/test/commands.test.ts` | done |
| FR-NET-02 | MUST | `packages/core/src/naming.ts`, `packages/core/src/commands.ts`, `apps/desktop/src/panels/InterfaceTable.tsx` | `packages/core/test/naming.test.ts`, `packages/core/test/commands.test.ts` | done |
| FR-NET-03 | MUST | `packages/core/src/naming.ts` | `packages/core/test/naming.test.ts` | done |
| FR-NET-04 | MUST | `packages/core/src/naming.ts`, `packages/core/src/commands.ts`, `packages/core/src/document.ts` | `packages/core/test/naming.test.ts`, `packages/core/test/commands.test.ts` | done |
| FR-NET-05 | MUST | `apps/desktop/src/dialogs/VlanDialog.tsx`, `packages/core/src/commands.ts` | `apps/desktop/test/components.test.tsx`, `packages/core/test/commands.test.ts` | done |
| FR-NET-06 | MUST | `apps/desktop/src/dialogs/IpamDialog.tsx`, `apps/desktop/src/lib/ipam.ts`, `apps/desktop/src/panels/InterfaceTable.tsx`, `packages/core/src/ip.ts` | `packages/core/test/ip.test.ts`, `apps/desktop/test/pure.test.ts`, `apps/desktop/e2e/12-network.spec.ts` | done |
| FR-NET-07 | MUST | `apps/desktop/src/dialogs/CalculatorDialog.tsx`, `packages/core/src/ip.ts` — IPv4 and IPv6, VLSM; property tests in ip.test.ts | `packages/core/test/ip.test.ts`, `apps/desktop/test/components.test.tsx` | done |
| FR-NET-08 | MUST | `apps/desktop/src/panels/Inspector.tsx`, `apps/desktop/src/lib/ipam.ts` | `packages/core/test/ip.test.ts`, `apps/desktop/test/pure.test.ts`, `apps/desktop/e2e/12-network.spec.ts` | done |
| FR-NET-09 | MUST | `apps/desktop/src/canvas/Canvas.tsx`, `packages/core/src/selectors.ts` | `packages/core/test/selectors.test.ts`, `apps/desktop/e2e/12-network.spec.ts` | done |
| FR-NET-10 | MUST | `packages/core/src/document.ts`, `apps/desktop/src/panels/Inspector.tsx` | `packages/core/test/commands.test.ts` | done |
| FR-NET-11 | SHOULD | | | todo |
| FR-NET-12 | SHOULD | | | todo |
| FR-NET-13 | SHOULD | | | todo |
| FR-NET-31 | MUST | `packages/core/src/selectors.ts`, `apps/desktop/src/store/editor.ts` | `apps/desktop/e2e/02-views-and-vlan.spec.ts` | done |
| FR-NET-32 | SHOULD | `packages/core/src/selectors.ts`, `apps/desktop/src/dialogs/VlanDialog.tsx` | `packages/core/test/selectors.test.ts`, `apps/desktop/e2e/02-views-and-vlan.spec.ts` | done |
| FR-NET-33 | SHOULD | `packages/core/src/selectors.ts` | `packages/core/test/selectors.test.ts` | done |
| FR-ICO-01 | MUST | `packages/device-library/icons`, `packages/device-library/scripts/build-icons.ts` | `packages/device-library/test/library.test.ts` | done |
| FR-ICO-02 | MUST | `packages/device-library/icons` | `packages/device-library/test/library.test.ts` | done |
| FR-ICO-03 | MUST | `packages/device-library/icons`, `apps/desktop/src/panels/Inspector.tsx` | `packages/device-library/test/library.test.ts` | done |
| FR-ICO-04 | MUST | `apps/desktop/src/canvas/nodes.tsx` (problem, note, lock and color-tag marks) | `apps/desktop/e2e/20-icons.spec.ts`, `apps/desktop/e2e/18-a11y-keyboard.spec.ts` | done |
| FR-ICO-05 | MUST | `apps/desktop/src/lib/iconPacks.ts`, `apps/desktop/src/store/packs.ts`, `apps/desktop/src/canvas/icons.ts` (pack references, fallback), `apps/desktop/src/components/IconPicker.tsx`, `apps/desktop/src/dialogs/PreferencesDialog.tsx`, `apps/desktop/src/App.tsx` (missing-pack notice) | `apps/desktop/test/pure.test.ts`, `apps/desktop/e2e/20-icons.spec.ts` | done |
| FR-ICO-06 | MUST | `apps/desktop/src/lib/embedIcons.ts`, `apps/desktop/src/lib/actions.ts` (`save`), `apps/desktop/src/store/prefs.ts` (`embedIcons`) | `apps/desktop/test/pure.test.ts`, `apps/desktop/e2e/20-icons.spec.ts` | done |
| FR-ICO-07 | MUST | `apps/desktop/src/lib/sanitize.ts`, `apps/desktop/src/lib/iconPacks.ts` | `apps/desktop/test/pure.test.ts` | done |
| FR-ICO-08 | MUST | `packages/device-library/icons`, `packages/brand` | `scripts/repo-rules.test.mjs` | done |
| FR-TPL-01 | MUST | `packages/core/src/templates.ts` | `packages/core/test/misc.test.ts`, `packages/device-library/test/library.test.ts` | done |
| FR-TPL-02 | MUST | `packages/device-library/templates/generic` | `packages/device-library/test/library.test.ts` | done |
| FR-TPL-03 | MUST | `packages/device-library/templates` — blocked: vendor datasheet hosts are denied by this environment's network policy (docs/HUMAN-TODO.md) | `packages/device-library/test/library.test.ts` | todo |
| FR-TPL-04 | MUST | `apps/desktop/src/dialogs/TemplateEditorDialog.tsx`, `apps/desktop/src/panels/LibraryPanel.tsx` | `apps/desktop/e2e/12-network.spec.ts` | done |
| FR-TPL-05 | MUST | `apps/desktop/src/panels/LibraryPanel.tsx` | `apps/desktop/test/components.test.tsx`, `apps/desktop/e2e/09-canvas.spec.ts` | done |
| FR-TPL-06 | SHOULD | | | todo |
| FR-TPL-07 | SHOULD | | | todo |
| FR-FMT-01 | MUST | `packages/core/src/serialize.ts` | `packages/core/test/serialize.test.ts` | done |
| FR-FMT-02 | MUST | `packages/core/src/serialize.ts`, `packages/core/src/jsonSchema.ts`, `schema/v1.json` | `packages/core/test/serialize.test.ts`, `packages/core/test/jsonSchema.test.ts` | done |
| FR-FMT-03 | MUST | `packages/core/src/serialize.ts`, `apps/desktop/src/lib/actions.ts` — migration scaffold; v1 is the only version so far | `packages/core/test/serialize.test.ts`, `apps/desktop/e2e/11-files.spec.ts` | done |
| FR-FMT-04 | MUST | `packages/core/src/serialize.ts`, `packages/core/src/commands.ts`, `apps/desktop/src/lib/actions.ts` | `apps/desktop/test/components.test.tsx` | done |
| FR-FMT-05 | MUST | `packages/core/src/serialize.ts`, `apps/desktop/src/dialogs/LoadIssuesDialog.tsx` | `packages/core/test/serialize.test.ts`, `apps/desktop/e2e/11-files.spec.ts` | done |
| FR-FMT-06 | MUST | `apps/desktop/src-tauri/src/files.rs` — cargo test in the same file | `apps/desktop/src-tauri/src/files.rs` | done |
| FR-FMT-07 | MUST | `apps/desktop/src/App.tsx`, `apps/desktop/src-tauri/src/recovery.rs` | `apps/desktop/e2e/08-crash-recovery.spec.ts`, `apps/desktop/e2e/11-files.spec.ts`, `apps/desktop/src-tauri/src/recovery.rs` | done |
| FR-IMP-01 | MUST | `packages/parsers/src/neighbors.ts` | `packages/parsers/test/parsers.test.ts`, `apps/desktop/e2e/03-import-cdp.spec.ts` | done |
| FR-IMP-02 | MUST | `packages/parsers/src/neighbors.ts` | `packages/parsers/test/parsers.test.ts` | done |
| FR-IMP-03 | MUST | `packages/parsers/src/config.ts` | `packages/parsers/test/parsers.test.ts`, `apps/desktop/e2e/04-import-config.spec.ts` | done |
| FR-IMP-04 | MUST | `packages/parsers/src/show.ts` | `packages/parsers/test/parsers.test.ts` | done |
| FR-IMP-05 | MUST | `packages/parsers/src/formats.ts`, `apps/desktop/src/dialogs/ImportDialog.tsx` | `packages/parsers/test/parsers.test.ts`, `packages/parsers/test/roundtrip.test.ts` | done |
| FR-IMP-06 | SHOULD | `packages/parsers/src/formats.ts` | `packages/parsers/test/parsers.test.ts` | done |
| FR-IMP-07 | SHOULD | `packages/parsers/src/formats.ts` | `packages/parsers/test/parsers.test.ts` | done |
| FR-IMP-08 | SHOULD | `packages/parsers/src/formats.ts` | `packages/parsers/test/parsers.test.ts` | done |
| FR-IMP-09 | MAY | `packages/parsers/src/formats.ts` | `packages/parsers/test/parsers.test.ts` | done |
| FR-IMP-20 | MUST | `packages/parsers/src/detect.ts`, `apps/desktop/src/dialogs/ImportDialog.tsx` | `packages/parsers/test/parsers.test.ts`, `apps/desktop/e2e/03-import-cdp.spec.ts` | done |
| FR-IMP-21 | MUST | `packages/parsers/src/merge.ts`, `apps/desktop/src/dialogs/ImportDialog.tsx` | `packages/parsers/test/merge.test.ts`, `apps/desktop/e2e/03-import-cdp.spec.ts` | done |
| FR-IMP-22 | MUST | `packages/parsers/src/util.ts`, `packages/parsers/src/config.ts` | `packages/parsers/test/parsers.test.ts`, `packages/parsers/test/fuzz.test.ts` | done |
| FR-IMP-23 | MUST | `packages/parsers/src/merge.ts` | `packages/parsers/test/merge.test.ts` | done |
| FR-IMP-24 | MUST | `apps/desktop/src/dialogs/ImportDialog.tsx`, `apps/desktop/src/workers/client.ts` | `apps/desktop/e2e/03-import-cdp.spec.ts` | done |
| FR-IMP-25 | MUST | `packages/parsers/src/util.ts`, `packages/parsers/src/config.ts` | `packages/parsers/test/parsers.test.ts`, `apps/desktop/e2e/04-import-config.spec.ts` | done |
| FR-IMP-26 | MUST | `packages/parsers/fixtures` — every parser has at least five fixtures including a malformed one, with golden snapshots | `packages/parsers/test/parsers.test.ts` | done |
| FR-EXP-01 | MUST | `apps/desktop/src/export/raster.ts`, `apps/desktop/src/export/svg.ts`, `apps/desktop/src/dialogs/ExportDialog.tsx` | `apps/desktop/test/pure.test.ts`, `apps/desktop/e2e/16-export-options.spec.ts` | done |
| FR-EXP-02 | MUST | `apps/desktop/src/export/svg.ts`, `apps/desktop/src/dialogs/ExportDialog.tsx` | `apps/desktop/test/pure.test.ts`, `apps/desktop/e2e/06-exports.spec.ts` | done |
| FR-EXP-03 | MUST | `apps/desktop/src/export/pdf.ts`, `apps/desktop/src/export/paper.ts`, `apps/desktop/src/dialogs/ExportDialog.tsx` | `apps/desktop/test/pure.test.ts`, `apps/desktop/e2e/16-export-options.spec.ts` | done |
| FR-EXP-04 | MUST | `packages/core/src/exporters.ts`, `apps/desktop/src/dialogs/ExportDialog.tsx` | `packages/core/test/exporters.test.ts`, `packages/parsers/test/roundtrip.test.ts`, `apps/desktop/e2e/06-exports.spec.ts` | done |
| FR-EXP-05 | MUST | `packages/core/src/exporters.ts`, `apps/desktop/src/dialogs/ExportDialog.tsx` | `packages/core/test/exporters.test.ts`, `apps/desktop/e2e/16-export-options.spec.ts` | done |
| FR-EXP-06 | MUST | `packages/core/src/exporters.ts`, `apps/desktop/src/dialogs/ExportDialog.tsx` | `packages/core/test/exporters.test.ts`, `packages/parsers/test/roundtrip.test.ts`, `apps/desktop/e2e/06-exports.spec.ts` | done |
| FR-EXP-07 | SHOULD | `packages/core/src/exporters.ts`, `apps/desktop/src/dialogs/ExportDialog.tsx` | `packages/parsers/test/roundtrip.test.ts`, `apps/desktop/e2e/16-export-options.spec.ts` | done |
| FR-EXP-08 | SHOULD | `packages/core/src/exporters.ts`, `apps/desktop/src/dialogs/ExportDialog.tsx` | `apps/desktop/e2e/16-export-options.spec.ts` | done |
| FR-EXP-09 | MAY | Post-1.0 (spec) | | deferred |
| FR-EXP-10 | MUST | `apps/desktop/src/export/print.ts`, `apps/desktop/src/platform/tauri.ts`, `apps/desktop/src-tauri/src/lib.rs` (macOS `print_page`) | `apps/desktop/e2e/16-export-options.spec.ts` | done |
| VAL-001 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-002 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-003 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-004 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-005 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-006 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-007 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-008 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-009 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-010 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-011 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-012 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-013 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-014 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-015 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-016 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-017 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-018 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-019 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| VAL-020 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| FR-VAL-01 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts`, `apps/desktop/e2e/05-validation-fix.spec.ts` | done |
| FR-VAL-02 | MUST | `apps/desktop/src/panels/ProblemsPanel.tsx`, `apps/desktop/src/panels/StatusBar.tsx` | `packages/core/test/validation.test.ts`, `apps/desktop/test/components.test.tsx`, `apps/desktop/e2e/05-validation-fix.spec.ts` | done |
| FR-VAL-03 | MUST | `apps/desktop/src/canvas/nodes.tsx`, `apps/desktop/src/canvas/model.ts`, `apps/desktop/src/store/prefs.ts` | `apps/desktop/e2e/05-validation-fix.spec.ts` | done |
| FR-VAL-04 | MUST | `packages/core/src/validation.ts` | `packages/core/test/validation.test.ts` | done |
| FR-VAL-05 | MUST | `packages/core/src/validation.ts`, `apps/desktop/src/workers/validation.worker.ts` — 1,000 devices / 5,000+ interfaces under 200 ms | `packages/core/test/validation.test.ts` | done |
| NFR-PERF-01 | MUST | `bench/perf.spec.ts`, `bench/src/gate.ts` — nightly on GitHub's runner, median of 3: 537 ms (≤ 2,000) | `bench/perf.spec.ts`, `bench/test/gate.test.ts` | done |
| NFR-PERF-02 | MUST | `apps/desktop/src/canvas/Canvas.tsx`, `bench/perf.spec.ts` — nightly: 500 devices 425 ms (≤ 2,000), 2,000 devices 1,374 ms (≤ 5,000) | `bench/perf.spec.ts`, `bench/test/gate.test.ts` | done |
| NFR-PERF-03 | MUST | `apps/desktop/src/canvas/Canvas.tsx` (`onlyRenderVisibleElements`, stable props, level of detail), `bench/perf.spec.ts` — nightly: 59.8 fps with 500 devices, 59.0 with 2,000 | `bench/perf.spec.ts`, `bench/test/gate.test.ts` | done |
| NFR-PERF-04 | MUST | `apps/desktop/src/canvas/Canvas.tsx` (`DragPreviewFlow`, `useDragPreview`), `apps/desktop/src/canvas/nodes.tsx`, `apps/desktop/src/canvas/NetworkEdge.tsx`, `apps/desktop/src/canvas/Minimap.tsx` — nightly: drag p95 16.7 ms per frame (all 3 runs), edit 19 ms (≤ 50) | `bench/perf.spec.ts`, `bench/test/gate.test.ts` | done |
| NFR-PERF-05 | MUST | `apps/desktop/src/workers/layout.worker.ts`, `bench/perf.spec.ts` — nightly: 800 ms (≤ 3,000), in a worker | `bench/perf.spec.ts`, `bench/test/gate.test.ts` | done |
| NFR-PERF-06 | MUST | `bench/perf.spec.ts` — JS heap with 500 devices 65 MB (≤ 250); native process memory and installer size (< 25 MB) are checked on release builds in M6 | `bench/perf.spec.ts`, `bench/test/gate.test.ts` | partial |
| NFR-PERF-07 | MUST | `bench/scripts/generate.ts` (100/500/2,000/5,000), `bench/scripts/run.ts`, `bench/src/gate.ts`, `bench/baseline.json`, `.github/workflows/nightly.yml` | `bench/test/generate.test.ts`, `bench/test/gate.test.ts` | done |
| NFR-SEC-01 | MUST | `apps/desktop/src-tauri/capabilities/default.json`, `apps/desktop/src-tauri/build.rs`, `apps/desktop/src-tauri/src/files.rs`, `apps/desktop/src-tauri/src/recovery.rs` | `apps/desktop/test/config.test.ts`, `apps/desktop/src-tauri/src/files.rs` | done |
| NFR-SEC-02 | MUST | `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/index.html`, `packages/brand/fonts/fonts.css` | `apps/desktop/test/config.test.ts` | done |
| NFR-SEC-03 | MUST | `apps/desktop/src/lib/sanitize.ts` (DOMPurify, SVG profile), `apps/desktop/src/lib/iconPacks.ts`, `apps/desktop/src/canvas/icons.ts`, `packages/parsers/src/formats.ts` (draw.io HTML reduced to text) | `apps/desktop/test/pure.test.ts`, `packages/parsers/test/parsers.test.ts` | done |
| NFR-SEC-04 | MUST | `apps/desktop/src/lib/iconPacks.ts` (`unzipFiles`: size, count and path limits) | `apps/desktop/test/pure.test.ts` | done |
| NFR-SEC-05 | MUST | `packages/parsers/src/util.ts`, `packages/parsers/src/formats.ts` — 10,000 inputs per parser and for the file loader in CI | `packages/parsers/test/fuzz.test.ts`, `packages/parsers/test/parsers.test.ts`, `packages/core/test/fuzz.test.ts` | done |
| NFR-SEC-06 | MUST | | | todo |
| NFR-SEC-07 | MUST | `packages/core/src/schema.ts` (no credential fields), `packages/parsers/src/config.ts` (secrets stripped, FR-IMP-25) | `packages/core/test/jsonSchema.test.ts`, `packages/parsers/test/parsers.test.ts` | done |
| NFR-SEC-08 | MUST | `SECURITY.md`, `.github/workflows/ci.yml`, `.github/workflows/nightly.yml` (audits, CodeQL), `.github/workflows/release.yml` (CycloneDX SBOM) | `scripts/repo-docs.test.mjs` | done |
| NFR-PRIV-01 | MUST | `apps/desktop/src-tauri/tauri.conf.json` (CSP `connect-src`), `apps/desktop/src-tauri/src/updates.rs`, `PRIVACY.md` | `apps/desktop/e2e/19-privacy.spec.ts`, `apps/desktop/test/config.test.ts`, `scripts/repo-docs.test.mjs` | done |
| NFR-PRIV-02 | MUST | `apps/desktop/src/store/prefs.ts`, `apps/desktop/src/dialogs/PreferencesDialog.tsx`, `PRIVACY.md` — no telemetry service in v1 | `apps/desktop/test/components.test.tsx`, `scripts/repo-docs.test.mjs` | done |
| NFR-A11Y-01 | MUST | `apps/desktop/src/lib/keyboard.ts`, `apps/desktop/src/lib/actions.ts` (`focusNearest`), `apps/desktop/src/App.tsx` (skip link) | `apps/desktop/e2e/07-keyboard-only.spec.ts`, `apps/desktop/e2e/18-a11y-keyboard.spec.ts` | done |
| NFR-A11Y-02 | MUST | `apps/desktop/src/panels/OutlinePanel.tsx`, `apps/desktop/src/panels/outlineTree.ts` | `apps/desktop/test/pure.test.ts`, `apps/desktop/e2e/18-a11y-keyboard.spec.ts` | done |
| NFR-A11Y-03 | MUST | `apps/desktop/src/canvas/model.ts` (`SEVERITY_GLYPH`), `apps/desktop/src/canvas/nodes.tsx`, `apps/desktop/src/canvas/NetworkEdge.tsx`, `apps/desktop/src/export/svg.ts`, `packages/core/src/palette.ts`, `packages/core/src/selectors.ts` (`endLabel`: VLAN labels in L2) | `packages/core/test/misc.test.ts`, `apps/desktop/test/pure.test.ts`, `apps/desktop/e2e/18-a11y-keyboard.spec.ts` | done |
| NFR-A11Y-04 | MUST | `apps/desktop/src/styles.css` (reduced motion, increased contrast, forced colors), `apps/desktop/src/App.tsx` + `apps/desktop/src-tauri/src/lib.rs` (`os_text_scale`, `set_ui_scale`: interface size follows the OS text size), `apps/desktop/src/dialogs/PreferencesDialog.tsx` | `apps/desktop/e2e/14-a11y.spec.ts`, `apps/desktop/src-tauri/src/lib.rs` (unit test) | done |
| NFR-A11Y-05 | MUST | axe-core in E2E (both themes) and component tests | `apps/desktop/e2e/14-a11y.spec.ts`, `apps/desktop/test/components.test.tsx` | done |
| NFR-I18N-01 | MUST | `scripts/i18n.ts`, `apps/desktop/src/i18n/` | `scripts/i18n.test.mjs`, `apps/desktop/e2e/15-i18n.spec.ts` | done |
| NFR-I18N-02 | MUST | `apps/desktop/src/main.tsx` (pseudo-locale), `apps/desktop/src/styles.css` | `apps/desktop/e2e/15-i18n.spec.ts` | done |
| NFR-REL-01 | MUST | `apps/desktop/src-tauri/src/files.rs` (atomic save + .bak), `apps/desktop/src-tauri/src/recovery.rs`, `apps/desktop/src/lib/actions.ts` (`autosaveNow`) | `apps/desktop/src-tauri/src/files.rs`, `apps/desktop/e2e/08-crash-recovery.spec.ts`, `apps/desktop/e2e/11-files.spec.ts` | done |
| NFR-REL-02 | MUST | `apps/desktop/src/components/ErrorBoundary.tsx`, `apps/desktop/src-tauri/src/lib.rs` (`install_panic_hook`) | `apps/desktop/test/components.test.tsx`, `apps/desktop/src-tauri/src/lib.rs` | done |
| NFR-REL-03 | MUST | `apps/desktop/src-tauri/src/lib.rs` (tauri-plugin-log: log dir, 5 × 5 MB), `apps/desktop/src/lib/actions.ts` (Help → Open logs folder) | `apps/desktop/test/config.test.ts` | done |
| NFR-MNT-01 | MUST | `tsconfig.base.json`, `eslint.config.js`, `.github/workflows/ci.yml` | `scripts/repo-rules.test.mjs` | done |
| NFR-MNT-02 | MUST | `packages/core/package.json`, `eslint.config.js` | `scripts/repo-rules.test.mjs` | done |
| NFR-MNT-03 | MUST | `docs/adr/0001-tauri-over-electron.md`, `docs/decisions-log.md` | `scripts/repo-docs.test.mjs` | done |
| REL-01 | MUST | | | todo |
| REL-02 | MUST | | | todo |
| REL-03 | MUST | `scripts/version.mjs`, `apps/desktop/src-tauri/tauri.conf.json` — Version single-sourcing is done and tested; app and document icons are checked in M6 (BRD-02/03). | `scripts/version.test.mjs`, `apps/desktop/test/config.test.ts` | partial |
| BRD-02 | MUST | | | todo |
| BRD-03 | MUST | | | todo |
| REL-04 | MUST | | | todo |
| REL-10 | MUST | | | todo |
| REL-11 | MUST | | | todo |
| REL-12 | MUST | | | todo |
| REL-20 | MUST | `commitlint.config.js`, `.husky/commit-msg`, `release-please-config.json`, `.github/workflows/release-please.yml`, `CHANGELOG.md` | `scripts/repo-docs.test.mjs`, `scripts/release-notes.test.mjs` | done |
| REL-21 | MUST |  — Branch protection is a repository setting only the owner can enable (docs/HUMAN-TODO.md). |  | todo |
| OSS-01 | MUST | `LICENSE` | `scripts/repo-rules.test.mjs` | done |
| OSS-02 | MUST | `scripts/check-licenses.mjs`, `scripts/licenses.mjs`, `apps/desktop/src-tauri/deny.toml`, `.github/workflows/ci.yml` | `scripts/licenses.test.mjs` | done |
| OSS-03 | MUST | `scripts/third-party-notices.mjs`, `apps/desktop/src/dialogs/AboutDialog.tsx` | `apps/desktop/test/components.test.tsx` | done |
| OSS-04 | MUST | `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/icon_request.yml`, `.github/ISSUE_TEMPLATE/device_template.yml`, `packages/device-library/icons`, `packages/device-library/templates` | `scripts/repo-docs.test.mjs`, `packages/device-library/test/library.test.ts` | done |
| OSS-05 | MUST | `CONTRIBUTING.md`, `.github/pull_request_template.md` — Sign-off is documented; the DCO GitHub app must be installed by the owner (docs/HUMAN-TODO.md). |  | partial |
| OSS-10 | MUST | `README.md` | `scripts/repo-docs.test.mjs` | done |
| OSS-11 | MUST | `CONTRIBUTING.md` | `scripts/repo-docs.test.mjs` | done |
| OSS-12 | MUST | `CODE_OF_CONDUCT.md`, `SECURITY.md`, `PRIVACY.md`, `GOVERNANCE.md`, `.github/CODEOWNERS` | `scripts/repo-docs.test.mjs` | done |
| OSS-13 | MUST | `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/pull_request_template.md` | `scripts/repo-docs.test.mjs` | done |
| OSS-14 | MUST | `.github/labels.yml`, `.github/workflows/labels.yml` | `scripts/repo-docs.test.mjs` | done |
| DOC-01 | MUST | `docs/user/index.md` — starting page; per-topic pages and VitePress site in M6 | `scripts/repo-docs.test.mjs` | partial |
| DOC-02 | MUST | `docs/dev/index.md`, `docs/dev/architecture.md`, `docs/dev/release.md` — signing setup walkthrough in M6 | `scripts/repo-docs.test.mjs` | partial |
| DOC-03 | MUST | `docs/file-format.md`, `docs/examples/branch-office.lwise`, `schema/v1.json` | `packages/core/test/serialize.test.ts`, `packages/core/test/jsonSchema.test.ts`, `scripts/repo-docs.test.mjs` | done |
| DOC-04 | MUST | `docs/adr/0001-tauri-over-electron.md`, `docs/adr/0002-react-flow-over-maxgraph.md`, `docs/adr/0003-command-patch-architecture.md`, `docs/adr/0004-file-format.md`, `docs/adr/0005-license.md` | `scripts/repo-docs.test.mjs` | done |
| DOC-05 | MUST | `apps/desktop/src/components/ui.tsx` (tooltips), `apps/desktop/src/panels/Toolbar.tsx`, `apps/desktop/src/canvas/Canvas.tsx` (empty state), `apps/desktop/src/lib/actions.ts` (Help) | `apps/desktop/e2e/17-app-shell.spec.ts` | done |
| DOC-06 | MUST | `TRACEABILITY.md`, `scripts/traceability.mjs` | `scripts/traceability.test.mjs`, `scripts/repo-docs.test.mjs` | done |
| BRD-01 | MUST | | | todo |
| BRD-04 | MUST | | | todo |
| BRD-05 | MUST | | | todo |
| BRD-06 | SHOULD | `docs/brand.md` | `scripts/repo-docs.test.mjs` | done |
