# ADR 0005: Apache-2.0 license

- Status: Accepted
- Date: 2026-10-09

## Context

LineWise is open source and wants broad adoption by engineers, MSPs and companies, plus outside contributions of device templates and icons.

## Decision

- License the project under Apache-2.0, with SPDX headers on source files.
- Contributions are accepted under the DCO (`Signed-off-by:`), no CLA.
- Dependencies must be on an allowlist (MIT, ISC, BSD-2/3, Apache-2.0, MPL-2.0, EPL-2.0, Zlib, Unicode, CC0, OFL-1.1); GPL, AGPL, SSPL and unknown licenses are blocked in CI.
- Icons and device templates are project-original. The bundled Sora and IBM Plex Mono fonts are OFL-1.1.

## Consequences

- Permissive use with an explicit patent grant; the same license as draw.io.
- Forks may be closed source. If that becomes a concern, relicensing requires contributor agreement, which the DCO alone does not provide.
