# Decisions log

Small decisions made where the spec was open. Larger ones are ADRs in `docs/adr/`.

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-09 | Brand assets live in `packages/brand/` (spec section 15, BRD-01). | Keeps logo masters and fonts versioned with the code and reusable by the docs site. |
| 2026-10-09 | Entity IDs are UUID v7 generated in `core` with a small dependency-free implementation; tests inject a deterministic ID source. | Time-ordered IDs sort well in the file; deterministic IDs make golden tests stable. |
| 2026-10-09 | JSON keys are sorted recursively on save; entity arrays sorted by `id`; `pages` keep their `order` field and are sorted by it. | FR-FMT-01 stable diffs. |
