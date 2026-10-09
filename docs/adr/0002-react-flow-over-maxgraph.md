# ADR 0002: React Flow over maxGraph for the canvas

- Status: Accepted
- Date: 2026-10-09

## Context

The canvas must render devices as rich, data-bound nodes (icon, hostname, badges), draw labelled links with interface names at each end, support selection, marquee, minimap, zoom/pan and viewport culling, and stay at 60 fps with 500 devices (NFR-PERF-03).

## Decision

Use React Flow (`@xyflow/react`, MIT). Devices, zones and annotations are custom React nodes; links are a custom `NetworkLink` edge. Auto-layout uses ELK.js and d3-force in a Web Worker and writes positions back through commands.

## Consequences

- Nodes are ordinary React components, so the inspector, badges and theming share one component model.
- `onlyRenderVisibleElements`, memoized node components and stable selectors are required to meet the performance targets; the `bench/` suite guards them.
- Rejected alternatives: maxGraph (Apache-2.0, mature, but imperative and harder to bind to React state); JointJS (key features in the commercial edition); a custom PixiJS/Konva canvas (fastest for 10k+ nodes, but rebuilds selection, editing and accessibility). Revisit a custom renderer only if NFR-PERF targets are missed.
