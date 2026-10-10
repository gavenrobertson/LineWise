# Traceability matrix

Every requirement ID in `docs/SPEC.md` → implementing module(s) → test file(s) → status. Status values: `todo`, `in-progress`, `done`, `partial`, `deferred`.

| Requirement | Priority | Module(s) | Test(s) | Status |
| --- | --- | --- | --- | --- |
| FR-APP-01 | MUST | `apps/desktop/src-tauri/src/menu.rs`, `apps/desktop/src/lib/actions.ts` | `apps/desktop/test/config.test.ts`, `apps/desktop/test/pure.test.ts` | done |
| FR-APP-02 | MUST | `apps/desktop/src/store/editor.ts`, `apps/desktop/src/panels/TabBar.tsx`, `apps/desktop/src/lib/actions.ts` — tabs in one window on both OSes (decisions log) | `apps/desktop/test/tabs.test.ts`, `apps/desktop/test/components.test.tsx`, `apps/desktop/e2e/10-tabs.spec.ts` | done |
| FR-APP-03 | MUST | | | todo |
| FR-APP-04 | MUST | | | todo |
| FR-APP-05 | MUST | | | todo |
| FR-APP-06 | MUST | | | todo |
| FR-APP-07 | MUST | | | todo |
| FR-APP-08 | MUST | | | todo |
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
| FR-CAN-14 | MUST | | | todo |
| FR-CAN-15 | MUST | | | todo |
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
| FR-KEY-01 | MUST | | | todo |
| FR-KEY-02 | MUST | `apps/desktop/src/lib/keyboard.ts`, `apps/desktop/src/store/ui.ts`, `apps/desktop/src/lib/actions.ts` — place, nudge, link, rename and every command via the palette; full audit of canvas actions in M5 | `apps/desktop/e2e/07-keyboard-only.spec.ts`, `apps/desktop/e2e/13-campus.spec.ts` | partial |
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
| FR-ICO-04 | MUST | | | todo |
| FR-ICO-05 | MUST | | | todo |
| FR-ICO-06 | MUST | | | todo |
| FR-ICO-07 | MUST | | | todo |
| FR-ICO-08 | MUST | | | todo |
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
| FR-IMP-01 | MUST | | | todo |
| FR-IMP-02 | MUST | | | todo |
| FR-IMP-03 | MUST | | | todo |
| FR-IMP-04 | MUST | | | todo |
| FR-IMP-05 | MUST | | | todo |
| FR-IMP-06 | SHOULD | | | todo |
| FR-IMP-07 | SHOULD | | | todo |
| FR-IMP-08 | SHOULD | | | todo |
| FR-IMP-09 | MAY | | | todo |
| FR-IMP-20 | MUST | | | todo |
| FR-IMP-21 | MUST | | | todo |
| FR-IMP-22 | MUST | | | todo |
| FR-IMP-23 | MUST | | | todo |
| FR-IMP-24 | MUST | | | todo |
| FR-IMP-25 | MUST | | | todo |
| FR-IMP-26 | MUST | | | todo |
| FR-EXP-01 | MUST | | | todo |
| FR-EXP-02 | MUST | | | todo |
| FR-EXP-03 | MUST | | | todo |
| FR-EXP-04 | MUST | | | todo |
| FR-EXP-05 | MUST | | | todo |
| FR-EXP-06 | MUST | | | todo |
| FR-EXP-07 | SHOULD | | | todo |
| FR-EXP-08 | SHOULD | | | todo |
| FR-EXP-09 | MAY | | | todo |
| FR-EXP-10 | MUST | | | todo |
| VAL-001 | MUST | | | todo |
| VAL-002 | MUST | | | todo |
| VAL-003 | MUST | | | todo |
| VAL-004 | MUST | | | todo |
| VAL-005 | MUST | | | todo |
| VAL-006 | MUST | | | todo |
| VAL-007 | MUST | | | todo |
| VAL-008 | MUST | | | todo |
| VAL-009 | MUST | | | todo |
| VAL-010 | MUST | | | todo |
| VAL-011 | MUST | | | todo |
| VAL-012 | MUST | | | todo |
| VAL-013 | MUST | | | todo |
| VAL-014 | MUST | | | todo |
| VAL-015 | MUST | | | todo |
| VAL-016 | MUST | | | todo |
| VAL-017 | MUST | | | todo |
| VAL-018 | MUST | | | todo |
| VAL-019 | MUST | | | todo |
| VAL-020 | MUST | | | todo |
| FR-VAL-01 | MUST | | | todo |
| FR-VAL-02 | MUST | | | todo |
| FR-VAL-03 | MUST | | | todo |
| FR-VAL-04 | MUST | | | todo |
| FR-VAL-05 | MUST | | | todo |
| NFR-PERF-01 | MUST | | | todo |
| NFR-PERF-02 | MUST | | | todo |
| NFR-PERF-03 | MUST | | | todo |
| NFR-PERF-04 | MUST | | | todo |
| NFR-PERF-05 | MUST | | | todo |
| NFR-PERF-06 | MUST | | | todo |
| NFR-PERF-07 | MUST | `bench/src/generate.ts`, `bench/perf.spec.ts`, `.github/workflows/nightly.yml` — fixtures and gates exist; the 20% regression gate needs a baseline recorded on the CI runner (M5) | `bench/test/generate.test.ts`, `bench/perf.spec.ts` | partial |
| NFR-SEC-01 | MUST | `apps/desktop/src-tauri/capabilities/default.json`, `apps/desktop/src-tauri/build.rs`, `apps/desktop/src-tauri/src/files.rs`, `apps/desktop/src-tauri/src/recovery.rs` | `apps/desktop/test/config.test.ts`, `apps/desktop/src-tauri/src/files.rs` | done |
| NFR-SEC-02 | MUST | `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/index.html`, `packages/brand/fonts/fonts.css` | `apps/desktop/test/config.test.ts` | done |
| NFR-SEC-03 | MUST | `apps/desktop/src/lib/sanitize.ts`, `apps/desktop/src/canvas/icons.ts` — SVG sanitized on import; assets shown only as images; audit in M5 | `apps/desktop/test/pure.test.ts` | partial |
| NFR-SEC-04 | MUST | | | todo |
| NFR-SEC-05 | MUST | | | todo |
| NFR-SEC-06 | MUST | | | todo |
| NFR-SEC-07 | MUST | | | todo |
| NFR-SEC-08 | MUST | | | todo |
| NFR-PRIV-01 | MUST | | | todo |
| NFR-PRIV-02 | MUST | | | todo |
| NFR-A11Y-01 | MUST | | | todo |
| NFR-A11Y-02 | MUST | | | todo |
| NFR-A11Y-03 | MUST | | | todo |
| NFR-A11Y-04 | MUST | | | todo |
| NFR-A11Y-05 | MUST | | | todo |
| NFR-I18N-01 | MUST | | | todo |
| NFR-I18N-02 | MUST | | | todo |
| NFR-REL-01 | MUST | | | todo |
| NFR-REL-02 | MUST | | | todo |
| NFR-REL-03 | MUST | | | todo |
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
| DOC-05 | MUST | | | todo |
| DOC-06 | MUST | `TRACEABILITY.md`, `scripts/traceability.mjs` | `scripts/traceability.test.mjs`, `scripts/repo-docs.test.mjs` | done |
| BRD-01 | MUST | | | todo |
| BRD-04 | MUST | | | todo |
| BRD-05 | MUST | | | todo |
| BRD-06 | SHOULD | `docs/brand.md` | `scripts/repo-docs.test.mjs` | done |
