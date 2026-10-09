# ADR 0004: Native file format (`.lwise`)

- Status: Accepted
- Date: 2026-10-09

## Context

Diagrams must be portable, survive version upgrades, and be friendly to Git (FR-FMT-01..07).

## Decision

- A single UTF-8 JSON file with the extension `.lwise`.
- Top level: `"format": "LineWise"`, integer `"schemaVersion"`, `"$schema"` pointing at `schema/v{n}.json`.
- 2-space indentation, stable key order (keys sorted recursively) and arrays of entities sorted by `id`, so diffs stay small. Ordered arrays (pages, interfaces by position) keep their meaning-bearing order.
- Layout lives on pages (`nodePositions`), not on devices, so the network model and the drawing are separable.
- Embedded images and icon-pack assets go in an `assets` map (`id → {mime, base64}`).
- Zod schemas are the single source of truth; the JSON Schema is generated from them.
- Older files open through ordered, unit-tested migrations; newer files open read-only with a clear message.
- Saves are atomic (temp file, fsync, rename) and keep one `.bak`.

## Consequences

- Files can be reviewed and merged in Git.
- Large embedded images make files big; the app warns above 20 MB.
