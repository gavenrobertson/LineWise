# ADR 0003: Command and patch architecture

- Status: Accepted
- Date: 2026-10-09

## Context

LineWise needs unlimited undo/redo for every model change (FR-CAN-07), single-step imports (FR-IMP-21), deterministic tests of all editing behavior in Node (NFR-MNT-02), and a UI that can also run in a plain browser for fast E2E tests.

## Decision

1. The network document is an immutable value owned by `packages/core`.
2. Every change is a **command**: a pure function `(doc, args) → doc` executed with Immer's `produceWithPatches`, yielding forward and inverse patches.
3. A `History` object stores patch pairs. Consecutive commands sharing a coalescing key (for example one drag gesture) merge into one undo step.
4. The UI holds the document in a Zustand store that only accepts commands. Components never mutate the model.
5. OS access goes through a `PlatformAdapter` interface with two implementations: `TauriPlatform` (production) and `BrowserPlatform` (in-memory and IndexedDB, used by Playwright and a possible web demo).

## Consequences

- Undo/redo is cheap and exact, and can be property-tested (random command sequences undone fully must equal the original).
- `core` has no React, DOM or Tauri imports and runs in Vitest under Node.
- The same patches can later feed collaboration (CRDT bridge) without redesign.
