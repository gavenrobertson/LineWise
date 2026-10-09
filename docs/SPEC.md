# Open-Source Network Diagramming App — Full Spec & Agent Prompt

Oct 9, 2026 · @Gaven

## 1. Overview and goals

Build a free, open-source, offline-first desktop app for Windows and macOS that lets network engineers draw Cisco-style network architecture diagrams where every icon is a real data object (device, interfaces, IPs, VLANs) rather than a dumb shape. The app is called **LineWise**, its diagram files use the `.lwise` extension, and its logo and colors are defined in section 15.

**Product vision.** "draw.io meets a lightweight source of truth": drag a router onto the canvas, connect Gi0/1 to a switch's Gi1/0/24, assign 10.0.12.1/30, and the app knows that link, warns you about a subnet mismatch, and can export an IP plan, a port map, and a clean PNG/SVG/PDF for documentation.

**Target users**

- Network engineers and architects documenting existing networks
- CCNA/CCNP students drawing lab topologies
- MSPs and small IT teams that cannot justify Visio licenses
- Homelab users

**Goals for v1.0**

1. Fast, pleasant drag-and-drop diagramming with Cisco-convention icons (router, L2/L3 switch, firewall, wireless AP/controller, server, cloud, etc.).
2. A structured network model: devices, interfaces, links, IP addressing, VLANs, zones, with Layer 1 / 2 / 3 views of the same topology.
3. Network-aware validation (IP conflicts, subnet mismatches, VLAN/trunk mismatches, unused ports, duplicate hostnames).
4. Import from Cisco CLI output (`show cdp neighbors detail`, `show lldp neighbors detail`, `show running-config`, `show ip interface brief`) to auto-build topologies.
5. Export to PNG, SVG, PDF, JSON, CSV inventory, and draw.io (.drawio) format.
6. Signed, installable builds for Windows 10/11 (x64, ARM64) and macOS 12+ (Apple Silicon and Intel), with auto-update.
7. A clean, documented, test-covered codebase that outside contributors can extend (especially device templates and icon packs).

**Success criteria for v1.0**

- A new user can draw a 20-device campus topology with IPs and VLANs in under 15 minutes without reading docs.
- A 500-device diagram opens in under 2 seconds and pans/zooms at 60 fps on a 2021 mid-range laptop.
- Installers under 25 MB; idle memory under 250 MB.
- Zero network calls unless the user opts in (update checks are the only default-on call, and can be disabled).
- 80%+ unit test coverage on the core domain package; all CI checks green on both OSes.

## 2. Recommended language and tech stack

**Decision: TypeScript for the app and domain logic, Rust for the native shell, packaged with Tauri 2.** TypeScript gives you the richest diagramming ecosystem and the largest contributor pool; Tauri gives you 5–15 MB installers, low memory use, and a permission-scoped native layer, versus roughly 100 MB+ for Electron.

| Layer | Choice | License | Why |
| --- | --- | --- | --- |
| Desktop shell | Tauri 2 (Rust) | MIT/Apache-2.0 | Small signed installers, built-in updater, capability-based permissions, native menus and dialogs |
| Language (UI + domain) | TypeScript, `strict: true` | — | One language for UI and core logic; huge contributor pool |
| Language (native) | Rust (stable) | — | File I/O, autosave, crash recovery, menus, updater, OS integration |
| UI framework | React 19 + Vite | MIT | Mature, fast HMR, best-supported by diagram libraries |
| Diagram canvas | React Flow (`@xyflow/react`) | MIT | Custom React nodes/edges, handles, minimap, viewport culling, selection, zoom/pan out of the box |
| Auto-layout | ELK.js (layered/orthogonal) + d3-force (organic) | EPL-2.0 / ISC | Hierarchical core→distribution→access layouts and force layouts; run in a Web Worker |
| State | Zustand + Immer (with patches) | MIT | Simple global store; Immer patches give cheap undo/redo |
| Schemas and validation | Zod → generated JSON Schema | MIT | One source of truth for the file format and runtime validation |
| IP math | `ipaddr.js` plus a small in-house subnet module | MIT | IPv4/IPv6 parsing, CIDR, containment checks |
| UI components | Radix UI primitives + Tailwind CSS | MIT | Accessible primitives, consistent theming, dark mode |
| UI chrome icons | Lucide | ISC | Toolbar/menu icons (not network device icons) |
| Export | Native SVG serialization; PNG via canvas raster; PDF via `svg2pdf.js` + `jsPDF` | MIT | Vector-true PDF and SVG output |
| i18n | i18next + react-i18next | MIT | All strings externalized from day one |
| Tests | Vitest, React Testing Library, Playwright, fast-check, `cargo test` | MIT/Apache | Unit, component, end-to-end, property-based |
| Lint/format | ESLint (typescript-eslint), Prettier, rustfmt, clippy | MIT | Enforced in CI |
| Monorepo | pnpm workspaces (+ Turborepo optional) | MIT | Separate `core`, `app`, `parsers`, `device-library` packages |
| CI/CD | GitHub Actions + `tauri-apps/tauri-action` | MIT | Matrix builds, signing, notarization, GitHub Releases |

**Pin versions.** The agent must use the latest stable release of each dependency at project start, commit the lockfile, and enable Renovate or Dependabot.

**Known trade-off.** Tauri uses the OS webview: WebView2 (Chromium) on Windows and WKWebView (WebKit) on macOS. Rendering can differ slightly, so CI must run end-to-end tests on both, and the UI must avoid bleeding-edge CSS that WebKit lacks.

**Alternatives considered and rejected**

- **Electron** — most consistent rendering, but \~100 MB+ installers and much higher memory. Acceptable fallback if Tauri blocks something critical.
- **Qt (C++/Python)** — strong native canvas, but slower to build, LGPL distribution obligations, and far fewer contributors.
- **Avalonia (.NET)** — a credible cross-platform option, but a much thinner diagramming ecosystem.
- **Flutter desktop** — diagramming libraries are immature.
- **Two native apps (SwiftUI + WinUI)** — doubles the work.

**Canvas alternatives**

- **maxGraph** (Apache-2.0, the modern fork of draw.io's mxGraph) — the best fallback if React Flow hits limits; very mature but imperative and less React-friendly.
- **JointJS** — the open core is MPL-2.0, but key features sit in the commercial JointJS+.
- **Custom PixiJS/Konva canvas** — best raw performance for 10,000+ nodes, but you rebuild selection, handles, editing and accessibility yourself. Revisit only if performance targets are missed.

## 3. Functional requirements — canvas, editing and UX

Every requirement has an ID so the agent can reference it in commits, tests and the traceability matrix. **MUST** = required for v1.0; **SHOULD** = v1.0 if time allows; **MAY** = post-1.0.

**Application shell**

- **FR-APP-01 (MUST)** Native menu bar on both OSes (File, Edit, View, Insert, Arrange, Network, Window, Help) using the macOS app menu conventions and Windows in-window menu conventions.
- **FR-APP-02 (MUST)** Multi-document support: each diagram opens in its own window (macOS) or tab (both); unsaved-changes indicator in title bar.
- **FR-APP-03 (MUST)** Layout: left panel = device library with search; center = canvas; right panel = properties inspector; bottom (collapsible) = validation/problems panel; top = toolbar.
- **FR-APP-04 (MUST)** Light, dark and "follow system" themes; canvas background and grid adapt.
- **FR-APP-05 (MUST)** Welcome screen: new blank diagram, new from template, open recent (last 10), open file.
- **FR-APP-06 (MUST)** Starter templates: small office, three-tier campus (core/distribution/access), collapsed-core campus, spine-leaf data center, hub-and-spoke WAN, DMVPN, CCNA lab (3 routers, 2 switches).
- **FR-APP-07 (MUST)** Preferences window: theme, grid size, snap, default link style, autosave interval, update checks on/off, telemetry (off by default), language, default export DPI.
- **FR-APP-08 (MUST)** Command palette (Ctrl/Cmd+K) that can run every menu action and search devices on the canvas by hostname or IP.
- **FR-APP-09 (MUST)** File associations: double-clicking a `.lwise` file opens the app; macOS document icon and Windows file icon.

**Canvas**

- **FR-CAN-01 (MUST)** Infinite canvas with pan (space+drag, middle mouse, trackpad two-finger), zoom (Ctrl/Cmd+scroll, pinch, 10%–400%), zoom-to-fit, zoom-to-selection.
- **FR-CAN-02 (MUST)** Configurable grid with snap-to-grid toggle and smart alignment guides (edges and centers) while dragging.
- **FR-CAN-03 (MUST)** Minimap (toggleable) showing viewport position.
- **FR-CAN-04 (MUST)** Selection: click, Shift/Ctrl/Cmd+click to add, marquee drag-select, select all, select by type (all routers), select connected.
- **FR-CAN-05 (MUST)** Move, resize (non-device shapes), rotate (labels and shapes), nudge with arrow keys (Shift = 10× step).
- **FR-CAN-06 (MUST)** Arrange: align left/center/right/top/middle/bottom, distribute horizontally/vertically, bring to front/send to back, group/ungroup, lock/unlock.
- **FR-CAN-07 (MUST)** Unlimited undo/redo for every model change (including property edits), with coalescing of drag operations into a single step. History survives tab switches; cleared on close.
- **FR-CAN-08 (MUST)** Cut/copy/paste/duplicate within and across diagrams; pasted devices get unique hostnames (R1 → R1-copy or next free index) and their interfaces' IPs are cleared or flagged.
- **FR-CAN-09 (MUST)** Drag device from library onto canvas; drop on an existing link to auto-insert the device inline (splitting the link).
- **FR-CAN-10 (MUST)** Annotation objects: text boxes, rectangles, ellipses, lines/arrows, sticky notes, and image insertion (PNG/JPG/SVG, embedded in the file).
- **FR-CAN-11 (MUST)** Containers/zones: resizable labeled areas (e.g. "DMZ", "Building A", "AWS VPC", "Site: Huntsville") that move their children with them and can nest.
- **FR-CAN-12 (MUST)** Multi-page diagrams (tabs at bottom), each page with its own canvas; devices can appear on one page only, with off-page connector references to devices on other pages.
- **FR-CAN-13 (MUST)** Layers panel: user layers (show/hide/lock/reorder) plus built-in network layers (see FR-NET-30).
- **FR-CAN-14 (MUST)** Auto-layout commands: hierarchical (top-down and left-right), orthogonal, force-directed, circular; applied to whole page or selection; undoable; runs in a Web Worker with a cancel button.
- **FR-CAN-15 (MUST)** Find (Ctrl/Cmd+F) by hostname, IP, interface, VLAN, label; results list that pans to each hit.
- **FR-CAN-16 (SHOULD)** Format painter: copy style from one object to others.
- **FR-CAN-17 (SHOULD)** Presentation mode: full screen, hide UI, step through pages.

**Links (connections)**

- **FR-LNK-01 (MUST)** Draw links by dragging from a device's connection handle to another device; on drop, prompt to pick the interface on each end (with a "next free port" default and type-to-filter).
- **FR-LNK-02 (MUST)** Link routing styles: straight, orthogonal (right-angle, auto-avoid nodes), curved; per link and as a document default. Manual waypoints that can be added, dragged and removed.
- **FR-LNK-03 (MUST)** Interface labels drawn near each end of the link (e.g. `Gi0/1`), with toggles for showing interface names, IPs, and VLANs. Labels avoid overlap where possible.
- **FR-LNK-04 (MUST)** Link styling by medium and role: copper (solid), fiber (solid, distinct color), serial (lightning-bolt/zigzag style), wireless (dashed), VPN/tunnel (dotted), console (thin dashed), plus trunk vs access visual cue and bundle indicator for port-channels.
- **FR-LNK-05 (MUST)** Link label in the middle for bandwidth/description (e.g. "10G", "MPLS – AT&T").
- **FR-LNK-06 (MUST)** Parallel links between the same two devices render as separate, evenly spaced curves; EtherChannel/LAG members can be grouped and drawn with a bundle ellipse.

**Inspector (properties panel)**

- **FR-INS-01 (MUST)** Shows editable properties for the selection: device fields, interface table, link fields, zone fields, style fields.
- **FR-INS-02 (MUST)** Multi-select edits apply to all selected objects of the same type (e.g. set site on 12 switches at once).
- **FR-INS-03 (MUST)** Interface table per device: name, enabled, description, mode (access/trunk/routed), access VLAN, allowed VLANs, native VLAN, IPv4/prefix, IPv6/prefix, speed, duplex, connected-to (read-only link).
- **FR-INS-04 (MUST)** Inline validation messages beside invalid fields (e.g. malformed IP).

**Keyboard and input**

- **FR-KEY-01 (MUST)** Platform-correct shortcuts (Cmd on macOS, Ctrl on Windows) for all common actions; shortcut cheat sheet under Help.
- **FR-KEY-02 (MUST)** Every canvas action reachable by keyboard (see accessibility, section 8).

## 4. Functional requirements — network data model

The diagram is a view of a typed network model; the model is the source of truth and the canvas only stores layout and style. All entities have a stable UUID v7 `id`, `createdAt`, `updatedAt`, and a free-form `customFields: Record<string, string | number | boolean>`.

| Entity | Required fields | Notes |
| --- | --- | --- |
| Document | id, schemaVersion, name, description, author, pages\[\], devices\[\], links\[\], zones\[\], vlans\[\], vrfs\[\], subnets\[\], settings, metadata | One file = one document |
| Page | id, name, order, viewport, nodePositions{deviceId → x,y}, annotations\[\], background | Layout lives here, not on devices |
| Device | id, hostname, role, templateId, vendor, model, platform/OS, osVersion, serial, assetTag, mgmtIp, site, rack, rackUnit, zoneId, tags\[\], notes, interfaces\[\], iconOverride, labelPosition | `role` enum below |
| Interface | id, deviceId, name, shortName, type, speedMbps, duplex, mtu, enabled, description, mode (access/trunk/routed/unset), accessVlan, nativeVlan, allowedVlans (ranges), ipv4\[\] (address+prefix, primary/secondary), ipv6\[\], vrfId, portChannelId, mac, poe | Names normalized (GigabitEthernet0/1 ↔ Gi0/1) |
| Link | id, endpointA {deviceId, interfaceId}, endpointB {…}, medium (copper/fiber-SM/fiber-MM/serial/wireless/virtual/console), bandwidthMbps, cableId, label, circuitId, provider, style overrides | An interface can have at most one physical link |
| PortChannel | id, deviceId, number, mode (LACP active/passive, on, PAgP), memberInterfaceIds\[\], logical interface settings | Drawn as bundle |
| Zone | id, name, kind (site/building/floor/security-zone/cloud-vpc/custom), parentZoneId, color, description | Rendered as containers |
| VLAN | id, number (1–4094), name, description, color, subnetIds\[\] | Global per document, optional per-site scoping |
| VRF | id, name, rd, description | Interfaces reference VRFs |
| Subnet | id, cidr, name, vlanId, vrfId, gatewayIp, description, reserved ranges | Feeds IP plan and validation |
| Annotation | id, kind (text/rect/ellipse/line/note/image), geometry, style, text | Pure drawing, no network meaning |

**Device roles (MUST, extensible):** router, L2 switch, L3/multilayer switch, firewall, wireless LAN controller, access point, load balancer, server, virtual machine, hypervisor host, workstation/PC, laptop, IP phone, printer, IoT device, storage/NAS, cloud (generic), internet, ISP/WAN cloud, MPLS cloud, modem, VPN concentrator, IDS/IPS, proxy, DNS/DHCP server, patch panel, generic device.

**Model requirements**

- **FR-NET-01 (MUST)** Creating a device from a template creates its interfaces automatically (e.g. a 48-port access switch gets Gi1/0/1–48 + 4 uplinks).
- **FR-NET-02 (MUST)** Users can add, rename, delete and bulk-create interfaces (e.g. "Gi1/0/1-24" range syntax).
- **FR-NET-03 (MUST)** Interface name normalization and abbreviation for Cisco naming (Ethernet, FastEthernet, GigabitEthernet, TenGigabitEthernet, TwentyFiveGigE, FortyGigabitEthernet, HundredGigE, Serial, Loopback, Vlan, Tunnel, Port-channel, Management) with a vendor-pluggable naming module.
- **FR-NET-04 (MUST)** Loopback, SVI (interface Vlan10), tunnel and sub-interfaces (Gi0/0.10 with dot1q tag) are first-class interfaces with no physical link.
- **FR-NET-05 (MUST)** VLAN manager dialog: create/edit/delete VLANs, import range, assign colors, see which interfaces use each VLAN.
- **FR-NET-06 (MUST)** Subnet/IPAM manager: list subnets, utilization (% addresses assigned), next free IP, assign IP to an interface from a subnet, detect overlaps.
- **FR-NET-07 (MUST)** Subnet calculator tool (IPv4 and IPv6): network, broadcast, first/last usable, host count, wildcard mask, dotted mask ↔ prefix, and VLSM split of a block into N subnets.
- **FR-NET-08 (MUST)** Point-to-point helper: selecting a router-to-router link offers "Assign /30 (or /31) from pool…" which fills both ends.
- **FR-NET-09 (MUST)** Device info card on hover: hostname, role, model, mgmt IP, interface count/used count.
- **FR-NET-10 (MUST)** Per-device label template, e.g. `{hostname}\n{mgmtIp}` or `{hostname} ({model})`, configurable per document.
- **FR-NET-11 (SHOULD)** Routing annotations: mark a device's routing protocols (OSPF areas, EIGRP AS, BGP ASN) and render area/AS containers or badges.
- **FR-NET-12 (SHOULD)** HSRP/VRRP/GLBP groups: virtual IP shared across interfaces, validated for consistency.
- **FR-NET-13 (SHOULD)** Rack elevation view per rack: devices placed by rack unit, front view, generated from device `rack` + `rackUnit` + template height.

**Network views (layers of the same model)**

- **FR-NET-30 (MUST)** View switcher with at least: **Physical (L1)** — all links, media styles, interface names; **Data link (L2)** — VLAN coloring of links, trunk allowed-VLAN labels, port-channels, optional per-VLAN filter that dims everything not carrying VLAN X; **Network (L3)** — routed interfaces and subnets, IPs on link ends, L2-only devices collapsed into the subnet they serve, routing-protocol badges.
- **FR-NET-31 (MUST)** Views share one model and one layout per page; switching views changes only rendering and visibility, never data.
- **FR-NET-32 (SHOULD)** VLAN highlight mode: pick a VLAN, highlight every interface, link and device that carries it (the L2 broadcast domain).
- **FR-NET-33 (SHOULD)** Path highlight: pick two devices, highlight the shortest physical path (BFS over links); hop count shown. Explicitly not a packet/routing simulation.

## 5. Device library and Cisco-style icons

**Ship original icons that follow Cisco diagramming conventions; do not bundle Cisco's official icon files or logos.** Cisco publishes its own topology icon set, but redistribution inside third-party software is governed by Cisco's terms, and "Cisco" and product names are trademarks. The safe path for an open-source project is an original icon set drawn in the familiar visual language, plus a feature that lets users import any icon pack they are licensed to use.

**Icon requirements**

- **FR-ICO-01 (MUST)** Original SVG icon set, 64×64 viewBox, consistent 2 px stroke, using `currentColor` so icons recolor with theme and status. Covers every device role in section 4.
- **FR-ICO-02 (MUST)** Follow the conventions engineers recognize: router = round/cylindrical body with four crossing arrows; L2 switch = flat rectangular box with four parallel arrows; L3 switch = switch box with router arrows on top; firewall = brick wall; access point = dome with radio waves; WLC = box with antenna/waves; server = tower/rack unit; cloud/internet = cloud outline; VPN = padlock badge on device.
- **FR-ICO-03 (MUST)** Two built-in styles selectable per document: "Classic" (filled blue bodies, white glyphs — the look network engineers expect) and "Line" (monochrome outline for print).
- **FR-ICO-04 (MUST)** Status badges overlaid on icons: warning, error, note, locked, and a user-chosen color tag.
- **FR-ICO-05 (MUST)** Icon pack import: user selects a folder or `.zip` of SVG/PNG files plus an optional `manifest.json` mapping files to roles; packs are stored in the app-data folder, listed in preferences, and referenced by pack ID + icon ID in documents. Documents that use a missing pack fall back to the built-in icon and show a notice.
- **FR-ICO-06 (MUST)** Embedded-icons option on save/export so a diagram renders correctly on a machine without the pack.
- **FR-ICO-07 (MUST)** Imported SVGs are sanitized (strip `<script>`, event handlers, external references, `<foreignObject>`) before use — see security, section 8.
- **FR-ICO-08 (MUST)** No Cisco (or other vendor) logos in the app, icons, website or marketing. Use vendor names only descriptively ("compatible with Cisco IOS output"), never in the product name.

**Device templates**

- **FR-TPL-01 (MUST)** A device template is a JSON file validated by schema: `id`, `vendor`, `model`, `role`, `iconRef`, `rackUnits`, `interfaces` (list or range syntax with type and speed), `defaults` (platform, OS), `sourceUrl` (the public datasheet the port layout came from), `contributor`.
- **FR-TPL-02 (MUST)** Ship generic templates for every role (e.g. "Router – 4×GE", "Access switch – 24×GE + 4×SFP", "Access switch – 48×GE + 4×SFP+", "Firewall – 8×GE", "Server – 2×10G").
- **FR-TPL-03 (MUST)** Ship a starter set of vendor-model templates only where the port layout is verified from a public datasheet linked in `sourceUrl`. Common Cisco families to cover first: ISR 1000/4000 and Catalyst 8000 edge routers, Catalyst 9200/9300/9500 switches, Nexus 9000 data-center switches, Meraki MX/MS/MR, ASA/Firepower firewalls, Catalyst 9800 WLC, Catalyst 9100 APs. Add a few non-Cisco families (Juniper, Arista, Fortinet, Palo Alto, Ubiquiti) to keep it vendor-neutral. **The agent must not invent port counts; any unverified template is marked `verified: false` and listed in a tracking issue.**
- **FR-TPL-04 (MUST)** Template editor UI: create a custom template from scratch or by cloning, define interfaces with range syntax, pick an icon, save to the user library, export/import as JSON.
- **FR-TPL-05 (MUST)** Library panel: search by name/model/role/vendor, favorites, recently used, collapsible categories, drag to canvas.
- **FR-TPL-06 (SHOULD)** Importer for the NetBox community device-type library (YAML) to bootstrap thousands of models. Verify that library's license before bundling any data; if unsure, ship the importer only and let users point it at their own copy.
- **FR-TPL-07 (SHOULD)** Contribution path: templates live in `packages/device-library/templates/<vendor>/<model>.json`, CI validates schema and uniqueness, and `CONTRIBUTING.md` explains how to submit one with its datasheet link.

## 6. File format, import and export

**Native format: a single, human-readable, Git-diffable JSON file** with the extension `.lwise`.

**File format requirements**

- **FR-FMT-01 (MUST)** UTF-8 JSON, 2-space indent, stable key order and stable array order (sorted by id where order has no meaning) so Git diffs stay small.
- **FR-FMT-02 (MUST)** Top-level `"format": "LineWise"` and integer `"schemaVersion"`. The JSON Schema is generated from the Zod schemas, published in the repo at `schema/v{n}.json`, and referenced by `$schema`.
- **FR-FMT-03 (MUST)** Forward migrations: opening an older file runs ordered migration functions (`v1→v2→…`), each with unit tests and fixture files; the original is never overwritten until the user saves. Opening a file from a newer version shows a clear "made with a newer version" message and opens read-only.
- **FR-FMT-04 (MUST)** Embedded images and icons stored in an `assets` map (id → base64 + MIME type) and referenced by id; warn if the file exceeds 20 MB.
- **FR-FMT-05 (MUST)** Loading validates against the schema; invalid files open in a recovery dialog listing the errors and offering to load what is valid.
- **FR-FMT-06 (MUST)** Atomic saves: write to a temp file in the same folder, fsync, then rename; keep one `.bak` of the previous version.
- **FR-FMT-07 (MUST)** Autosave to the app-data recovery folder every N seconds (default 60) and on window blur; on next launch after a crash, offer to restore.

**Import**

| ID | Source | Priority | What it produces |
| --- | --- | --- | --- |
| FR-IMP-01 | `show cdp neighbors detail` (IOS, IOS-XE, NX-OS) | MUST | Devices (hostname, platform, mgmt IP), links with both interface names |
| FR-IMP-02 | `show lldp neighbors detail` (Cisco + generic LLDP) | MUST | Same as CDP |
| FR-IMP-03 | `show running-config` (IOS/IOS-XE/NX-OS) | MUST | Hostname, interfaces, descriptions, IPs, VLANs, switchport mode/allowed VLANs, port-channels, VRFs, HSRP, static/OSPF/EIGRP/BGP basics |
| FR-IMP-04 | `show ip interface brief`, `show interfaces status`, `show vlan brief`, `show etherchannel summary` | MUST | Interface state, VLAN membership, bundles |
| FR-IMP-05 | CSV (devices, interfaces, links) with a column-mapping dialog | MUST | Bulk creation |
| FR-IMP-06 | draw.io / diagrams.net `.drawio` (uncompressed and compressed XML) | SHOULD | Shapes and connectors as annotations; known network shapes mapped to devices |
| FR-IMP-07 | GNS3 `.gns3` project (JSON) | SHOULD | Nodes and links |
| FR-IMP-08 | Containerlab topology YAML | SHOULD | Nodes and links |
| FR-IMP-09 | Nmap XML | MAY | Hosts as devices (no links) |

**Import behaviour (all importers)**

- **FR-IMP-20 (MUST)** Paste text or pick files (multiple at once, from many devices); auto-detect the command type.
- **FR-IMP-21 (MUST)** Preview-and-merge dialog: lists devices/links to be created or updated, matches existing devices by hostname, then serial, then mgmt IP; user can untick items. Nothing is changed until "Apply", and the apply is a single undo step.
- **FR-IMP-22 (MUST)** Parsers are tolerant: unknown lines are skipped and reported in an "unparsed lines" list rather than failing the import.
- **FR-IMP-23 (MUST)** Neighbor entries seen from both sides are de-duplicated into one link.
- **FR-IMP-24 (MUST)** Imported devices get an automatic hierarchical layout on a new page or selected area.
- **FR-IMP-25 (MUST)** Config text is parsed, never executed. Secrets (`enable secret`, `password`, SNMP communities, keys) are stripped and never stored.
- **FR-IMP-26 (MUST)** Every parser has fixture files from real-format sample output (sanitized, written by the project) and golden-output tests.

**Export**

| ID | Target | Priority | Options |
| --- | --- | --- | --- |
| FR-EXP-01 | PNG | MUST | Page or selection, scale 1×–4×, transparent background, include/exclude grid |
| FR-EXP-02 | SVG | MUST | Text as text (selectable), embedded icons, no external refs |
| FR-EXP-03 | PDF | MUST | Vector; page size (Letter, A4, A3, Tabloid), orientation, fit-to-page or tile, all pages into one PDF, title block (name, author, date, revision) |
| FR-EXP-04 | CSV | MUST | Devices, interfaces, links, IP plan (subnet, VLAN, gateway, assigned IPs), port map |
| FR-EXP-05 | HTML/Markdown report | MUST | Diagram image + device inventory + IP plan + VLAN table + validation summary |
| FR-EXP-06 | draw.io XML | MUST | Opens in diagrams.net with positions, labels and links intact |
| FR-EXP-07 | Containerlab YAML | SHOULD | For lab users |
| FR-EXP-08 | Mermaid / Graphviz DOT | SHOULD | Text topologies for docs-as-code |
| FR-EXP-09 | Visio `.vsdx` | MAY | Complex format; post-1.0 |
| FR-EXP-10 | Print | MUST | Native print dialog using the PDF pipeline |

## 7. Validation and network intelligence

**A rule engine in the core package checks the model continuously and lists problems in the bottom panel; clicking a problem selects and zooms to the offending objects.** Rules are pure functions `(model) → Issue[]`, run incrementally in a Web Worker after each change (debounced 300 ms), and each rule can be disabled per document.

| Rule ID | Severity | Detects |
| --- | --- | --- |
| VAL-001 | Error | Duplicate IP address on two interfaces in the same VRF |
| VAL-002 | Error | Link endpoints with IPs in different subnets (L3 link mismatch) |
| VAL-003 | Error | Invalid IP/prefix, network or broadcast address assigned to an interface |
| VAL-004 | Error | Overlapping subnets in the same VRF |
| VAL-005 | Error | Interface used by more than one physical link |
| VAL-006 | Warning | Duplicate hostname |
| VAL-007 | Warning | Trunk on one end, access on the other |
| VAL-008 | Warning | Native VLAN mismatch across a trunk |
| VAL-009 | Warning | Allowed-VLAN lists differ across a trunk (show the difference) |
| VAL-010 | Warning | Access VLAN mismatch across an access link |
| VAL-011 | Warning | Speed or duplex mismatch across a link |
| VAL-012 | Warning | Port-channel members with inconsistent settings or on different neighbors |
| VAL-013 | Warning | Interface references a VLAN or VRF that doesn't exist |
| VAL-014 | Warning | Gateway IP not inside its subnet, or no interface owns the gateway IP |
| VAL-015 | Warning | HSRP/VRRP group with mismatched virtual IP or group number |
| VAL-016 | Info | Device with no links (orphan) |
| VAL-017 | Info | Interface enabled with an IP but not linked (could be intentional) |
| VAL-018 | Info | Subnet over 90% utilized |
| VAL-019 | Info | Device missing management IP |
| VAL-020 | Info | Media mismatch (fiber interface linked to copper interface) |

**Rule engine requirements**

- **FR-VAL-01 (MUST)** Each issue has rule ID, severity, message, affected object IDs and an optional quick fix (e.g. "Set both ends to trunk", "Assign next free IP").
- **FR-VAL-02 (MUST)** Problems panel: filter by severity and rule, count badge in status bar, suppress individual issues with a reason (stored in the document).
- **FR-VAL-03 (MUST)** Canvas shows badges on affected devices and links, toggleable.
- **FR-VAL-04 (MUST)** Rules are registered through a plugin-style registry so contributors can add rules with a single file + tests.
- **FR-VAL-05 (MUST)** Validation of 1,000 devices / 5,000 interfaces completes in under 200 ms in the worker.

**Explicitly not v1:** packet simulation, routing-table computation, spanning-tree simulation, config generation and pushing config to live devices.

## 8. Non-functional requirements

**Platform support**

| OS | Versions | Architectures | Installer |
| --- | --- | --- | --- |
| Windows | 10 (22H2) and 11 | x64, ARM64 | NSIS `.exe` (per-user, no admin) + `.msi` (for IT deployment) |
| macOS | 12 Monterey and later | Universal (Apple Silicon + Intel) | Signed, notarized `.dmg` |
| Linux (bonus) | Ubuntu 22.04+, Fedora 39+ | x64 | AppImage + `.deb` (unsigned, best effort, no blocking CI) |

**Performance (measured on a 2021 mid-range laptop, recorded in CI benchmarks)**

- **NFR-PERF-01** Cold start to usable welcome screen: under 2 s.
- **NFR-PERF-02** Open a 500-device / 800-link file: under 2 s; 2,000 devices / 3,000 links: under 5 s.
- **NFR-PERF-03** Pan/zoom at 60 fps with 500 devices; at least 30 fps with 2,000 devices (React Flow `onlyRenderVisibleElements`, memoized nodes, no re-render of unchanged nodes).
- **NFR-PERF-04** Drag of a single device: under 16 ms per frame; property edit to canvas update: under 50 ms.
- **NFR-PERF-05** Auto-layout of 500 nodes: under 3 s, in a worker, cancellable, UI never frozen.
- **NFR-PERF-06** Idle memory under 250 MB; installer under 25 MB.
- **NFR-PERF-07** A `bench/` folder with generated large fixtures (100, 500, 2,000, 5,000 devices) and a Playwright benchmark that fails CI on a >20% regression.

**Security**

- **NFR-SEC-01** Tauri capabilities: grant only the plugins and commands actually used; file-system access limited to user-chosen paths (dialog-scoped) and the app-data folder.
- **NFR-SEC-02** Strict Content Security Policy: no remote scripts, no `eval`, no inline scripts; all assets bundled. No remote content loaded into the webview.
- **NFR-SEC-03** All imported SVG and HTML sanitized with DOMPurify (SVG profile) before rendering or embedding.
- **NFR-SEC-04** Zip imports (icon packs) protected against zip-slip and zip bombs (path checks, size and file-count limits).
- **NFR-SEC-05** Parsers treat input as untrusted: size limits, no regex catastrophic backtracking (use linear-time patterns, fuzz tests).
- **NFR-SEC-06** Updates are signed with the Tauri updater key and verified before install; the private key lives only in CI secrets.
- **NFR-SEC-07** No credentials stored in v1 (no SSH/SNMP). Secrets from imported configs are stripped (FR-IMP-25).
- **NFR-SEC-08** `SECURITY.md` with a private vulnerability reporting process (GitHub private advisories); dependency audit (`pnpm audit`, `cargo audit`) and CodeQL in CI; SBOM (CycloneDX) attached to each release.

**Privacy**

- **NFR-PRIV-01** Fully offline; the only default network call is the update check, which can be turned off and sends no identifiers beyond what an HTTPS request implies.
- **NFR-PRIV-02** Telemetry and crash reporting are off by default, opt-in only, documented in `PRIVACY.md`, and never include diagram content, hostnames or IPs.

**Accessibility (WCAG 2.2 AA for all non-canvas UI)**

- **NFR-A11Y-01** Full keyboard operation: Tab through panels; on the canvas, arrow keys move focus between devices (nearest in direction), Enter opens inspector, a key combo starts a link from the focused device.
- **NFR-A11Y-02** A screen-reader-friendly "Topology outline" panel (tree: zones → devices → interfaces → link peers) mirroring the canvas.
- **NFR-A11Y-03** Color is never the only signal: VLAN and status colors also have patterns, labels or icons; a color-blind-safe default palette.
- **NFR-A11Y-04** Respects OS reduced-motion, high-contrast (Windows) and increased-contrast (macOS) settings; UI scales with OS text size; minimum 4.5:1 text contrast.
- **NFR-A11Y-05** Automated checks with axe-core in component and end-to-end tests.

**Internationalization**

- **NFR-I18N-01** All UI strings in i18next resource files; English ships in v1; adding a language requires no code change.
- **NFR-I18N-02** Locale-aware dates and numbers; layout tolerates 40% longer strings.

**Reliability and quality**

- **NFR-REL-01** No data loss: atomic saves, autosave, crash recovery (FR-FMT-06/07).
- **NFR-REL-02** Unhandled errors caught by a React error boundary and a Rust panic hook; the user sees a recoverable error screen with "copy diagnostics" (no automatic upload).
- **NFR-REL-03** Structured local logs in the app-data folder with rotation (5 files × 5 MB); "Open logs folder" in Help.

**Maintainability**

- **NFR-MNT-01** TypeScript strict, no `any` without a justified eslint-disable comment; Rust `clippy -D warnings`.
- **NFR-MNT-02** The `core` package has zero dependencies on React, the DOM or Tauri and runs in Node for tests.
- **NFR-MNT-03** Architecture Decision Records (ADRs) in `docs/adr/` for every significant choice.

## 9. Architecture and repository structure

**Every change to a diagram is a command applied by the pure-TypeScript core; the UI only renders derived state, and the Rust side only touches the OS.** This keeps the domain testable in Node, makes undo/redo trivial, and lets the whole UI run in a plain browser for fast end-to-end tests.

**Layers**

1. **`packages/core`** — Zod schemas and TypeScript types for the model; a command layer (`addDevice`, `connect`, `setInterfaceIp`, `moveNodes`, `applyImport`…) where each command produces Immer patches + inverse patches; history manager (undo/redo, drag coalescing); selectors (derived L1/L2/L3 views); IP/subnet utilities; validation rule engine; serializers (native JSON, CSV, draw.io XML, Mermaid, DOT, Containerlab); migrations. No React, DOM or Tauri imports.
2. **`packages/parsers`** — Cisco CLI and other import parsers, pure functions `string → ParseResult { entities, unparsedLines, warnings }`.
3. **`packages/device-library`** — template JSON, original SVG icons, schema, and a build script that generates a typed index.
4. **`apps/desktop/src`** — React app: Zustand store wrapping the core, React Flow canvas with custom `DeviceNode`, `ZoneNode`, `AnnotationNode`, `NetworkLink` edge; panels; dialogs; Web Workers for validation and layout; export renderers (SVG/PNG/PDF).
5. **`PlatformAdapter` interface** — file open/save, recent files, autosave, menus, clipboard, updater, app info. Two implementations: `TauriPlatform` (production) and `BrowserPlatform` (in-memory/IndexedDB, used by Playwright tests and a possible future web demo).
6. **`apps/desktop/src-tauri`** — Rust: commands for atomic save, autosave/recovery, file associations and "open with", native menus wired to frontend events, single-instance handling, logging, panic hook, updater; capability files.

**Data flow:** user action → UI dispatches command → core returns new model + patches → history stack → Zustand store → memoized selectors derive React Flow nodes/edges for the active page and view → canvas renders. Validation and layout run in workers on the latest model snapshot and post results back.

&#91;embedded content: app architecture · 7 parts\]

The UI never touches the model or the OS directly: commands go down through the store into the core, and only the PlatformAdapter reaches Rust.

**Repository layout**

```text
linewise/
├─ apps/
│  └─ desktop/
│     ├─ src/                 # React app
│     │  ├─ canvas/           # React Flow nodes, edges, handles, interactions
│     │  ├─ panels/           # library, inspector, problems, layers, outline
│     │  ├─ dialogs/          # import wizard, VLAN mgr, IPAM, subnet calc, prefs
│     │  ├─ export/           # svg, png, pdf renderers
│     │  ├─ platform/         # PlatformAdapter + Tauri/Browser impls
│     │  ├─ store/            # Zustand store wrapping core
│     │  ├─ workers/          # validation.worker.ts, layout.worker.ts
│     │  └─ i18n/
│     ├─ src-tauri/           # Rust shell, capabilities, icons, tauri.conf.json
│     └─ e2e/                 # Playwright tests
├─ packages/
│  ├─ core/                   # model, commands, history, validation, serializers
│  ├─ parsers/                # cisco-ios, cisco-nxos, lldp, csv, drawio, gns3, clab
│  ├─ device-library/         # templates/<vendor>/<model>.json, icons/, schema
│  └─ brand/                  # LineWise logo masters, app/doc icons, bundled fonts
├─ schema/                    # generated JSON Schema per version
├─ fixtures/                  # sample diagrams + sanitized CLI outputs
├─ bench/                     # large generated diagrams + perf tests
├─ docs/                      # user guide, dev guide, adr/, file-format spec
├─ .github/                   # workflows, issue/PR templates, CODEOWNERS
├─ LICENSE  README.md  CONTRIBUTING.md  CODE_OF_CONDUCT.md
├─ SECURITY.md  PRIVACY.md  CHANGELOG.md  TRACEABILITY.md
└─ pnpm-workspace.yaml
```

**Architecture rules the agent must enforce**

- UI components never mutate the model directly; only commands do.
- `core` and `parsers` have 100% type coverage and no side effects.
- Anything OS-specific goes through `PlatformAdapter`; no direct `@tauri-apps/*` imports outside `platform/`.
- Heavy work (layout, validation, big imports, export of >200 devices) runs off the main thread.

## 10. Testing and QA

**No feature is done until it has tests at the right level and CI is green on Windows and macOS.**

| Level | Tool | Scope | Gate |
| --- | --- | --- | --- |
| Unit | Vitest | core commands, history, selectors, IP math, validation rules, serializers, migrations | ≥ 80% line coverage on `core` and `parsers`, enforced |
| Property-based | fast-check | IP/subnet math (round-trips, containment, VLSM splits), undo/redo (apply N random commands then undo all = original), serializer round-trips | Runs in CI |
| Parser golden tests | Vitest + fixtures | Each CLI parser against sanitized sample outputs; snapshot of `ParseResult` | Every parser has ≥ 5 fixtures incl. malformed input |
| Fuzz | fast-check string arbitraries | Parsers and file loader never throw uncaught or hang (timeout 1 s per input) | Runs nightly |
| Component | Vitest + React Testing Library + axe-core | Inspector, dialogs, panels, keyboard behavior, a11y violations | Zero axe violations |
| End-to-end (browser) | Playwright against `BrowserPlatform` build | Core user journeys (below) in Chromium and WebKit, which mirror WebView2 and WKWebView | All pass on every PR |
| End-to-end (native) | `tauri-driver` (WebDriver) | Smoke test of the real packaged app: launch, new doc, save, reopen | Windows runner (macOS has no WKWebView driver; covered by manual checklist) |
| Visual regression | Playwright screenshots | Icons, link styles, export output for fixture diagrams | Diff threshold 0.1% |
| Performance | Playwright + `bench/` fixtures | NFR-PERF targets | Fail on > 20% regression |
| Rust | `cargo test`, `clippy`, `cargo audit` | Atomic save, recovery, path handling | Required |

**Core end-to-end journeys (each is a Playwright spec)**

1. Create a new diagram from blank, add 2 routers and a switch, link them with interface selection, assign IPs, save, close, reopen — identical.
2. Create from the three-tier campus template, switch L1 → L2 → L3 views, highlight VLAN 10.
3. Paste CDP neighbor output for 3 devices, review merge preview, apply, undo, redo.
4. Paste a running-config, confirm interfaces, VLANs and IPs, confirm secrets are absent from the saved file.
5. Create a subnet mismatch, see VAL-002 in the problems panel, apply the quick fix.
6. Export PNG, SVG, PDF, CSV and draw.io; verify files are valid (PDF parses, SVG has no external refs, draw.io XML parses).
7. Keyboard-only: create a device, link it, edit its hostname, without a mouse.
8. Simulated crash recovery: kill during autosave, relaunch, restore.

**Manual release checklist (`docs/release-checklist.md`)** — install/uninstall on clean Windows 10, Windows 11 ARM, macOS Intel, macOS Apple Silicon; Gatekeeper and SmartScreen behavior; file association; auto-update from previous version; dark mode; 200% display scaling; VoiceOver and Narrator spot checks.

## 11. Packaging, code signing, auto-update and CI/CD

**Releases are built, signed, notarized and published entirely by GitHub Actions from a version tag; nothing is built on a developer laptop.** Signing needs accounts only you can create, so the agent must build the pipeline with secrets as placeholders and document exactly which secrets to add.

**Code signing (you must set these up — the agent cannot)**

- **macOS:** Apple Developer Program membership ($99/year) → "Developer ID Application" certificate → notarization with an App Store Connect API key. Without it, Gatekeeper blocks the app for most users. Secrets: `APPLE_CERTIFICATE` (base64 .p12), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_PATH` contents, `APPLE_TEAM_ID`.
- **Windows:** options, cheapest first — SignPath Foundation's free signing for qualifying open-source projects; Microsoft's Azure-based Trusted Signing service (low monthly fee, check current eligibility rules); or a traditional OV/EV code-signing certificate on a hardware token or cloud HSM. Unsigned builds work but trigger SmartScreen warnings.
- **Updater:** generate a Tauri updater key pair (`tauri signer generate`); secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`; the public key goes in `tauri.conf.json`.

**Packaging requirements**

- **REL-01** Windows: NSIS installer (per-user, no admin, optional desktop shortcut, file association) and MSI (per-machine, silent install flags documented for IT). WebView2 handled via the embedded bootstrapper.
- **REL-02** macOS: universal binary (`--target universal-apple-darwin`), hardened runtime, minimal entitlements, signed and notarized, stapled `.dmg` with background image and Applications shortcut.
- **REL-03** App icons generated from the LineWise masters in section 15 (BRD-02), a document icon for `.lwise` files (BRD-03), bundle identifier `dev.gavenrobertson.linewise`, and the version from a single source of truth (`package.json` synced to `tauri.conf.json` and `Cargo.toml`).
- **REL-04** Each release ships SHA-256 checksums and a CycloneDX SBOM.

**Auto-update**

- **REL-10** Tauri updater plugin checks a static `latest.json` on GitHub Releases on launch (and from Help → Check for updates), at most once per 24 h; shows release notes; user chooses "Install and restart" or "Later". Never forced.
- **REL-11** Stable and beta channels (beta opt-in in preferences).
- **REL-12** Updates verified by signature before install; failed verification aborts and logs.

**CI/CD workflows**

| Workflow | Trigger | Jobs |
| --- | --- | --- |
| `ci.yml` | Every PR and push to `main` | Install (pnpm cache, Rust cache) → lint, format check, typecheck, clippy → unit + property tests with coverage → Playwright (Chromium + WebKit) → `tauri build` debug on `windows-latest` and `macos-latest` → tauri-driver smoke on Windows → upload artifacts |
| `release.yml` | Tag `v*.*.*` | Matrix: Windows x64, Windows ARM64, macOS universal → build, sign, notarize → draft GitHub Release with installers, `latest.json`, checksums, SBOM → maintainer publishes |
| `nightly.yml` | Cron, daily | Fuzz tests, performance benchmarks, dependency audit, CodeQL |
| `templates.yml` | PRs touching `device-library/` | Schema validation, duplicate check, icon SVG lint and sanitization check |

**Versioning and changelog**

- **REL-20** Semantic Versioning; Conventional Commits enforced by commitlint; `release-please` (or Changesets) generates `CHANGELOG.md` and the release PR.
- **REL-21** Branch protection on `main`: required checks, one review for external PRs, linear history.

## 12. Open-source license, governance and documentation

**Recommended license: Apache-2.0** — permissive like MIT, plus an explicit patent grant, and the same license draw.io uses. Choose GPL-3.0 instead only if you want to force forks and redistributions to stay open source.

**Licensing and compliance**

- **OSS-01** `LICENSE` (Apache-2.0) and SPDX headers (`// SPDX-License-Identifier: Apache-2.0`) on every source file.
- **OSS-02** Dependency license allowlist enforced in CI (`license-checker` for npm, `cargo-deny` for Rust): allow MIT, ISC, BSD-2/3, Apache-2.0, MPL-2.0, EPL-2.0 (ELK.js), Zlib, Unicode, CC0, OFL-1.1 (the bundled Sora and IBM Plex Mono fonts); block GPL/AGPL/SSPL/unknown.
- **OSS-03** Auto-generated `THIRD_PARTY_NOTICES` bundled with the app and shown under Help → About → Licenses.
- **OSS-04** Icons and templates are project-original and covered by the project license; any contributed asset must state its license and source.
- **OSS-05** Contributor sign-off with DCO (`Signed-off-by:`), checked by a GitHub app; no CLA.

**Community files**

- **OSS-10** `README.md`: one-sentence pitch, screenshot/GIF, download links, feature list, build-from-source steps, contributing link, license.
- **OSS-11** `CONTRIBUTING.md`: dev setup on Windows and macOS (prerequisites: Node LTS, pnpm, Rust stable, platform build tools), project structure, coding standards, commit convention, how to add a device template, icon, validation rule or importer, how to run each test suite.
- **OSS-12** `CODE_OF_CONDUCT.md` (Contributor Covenant), `SECURITY.md`, `PRIVACY.md`, `GOVERNANCE.md` (maintainers, decision process), `CODEOWNERS`.
- **OSS-13** Issue templates: bug report (with OS, version, diagnostics), feature request, device template request (with datasheet link), icon request. PR template with checklist (tests, docs, changelog, screenshots).
- **OSS-14** Labels: `good first issue`, `help wanted`, `device-template`, `importer`, `validation`, `a11y`, `platform:windows`, `platform:macos`.

**Documentation**

- **DOC-01** User guide (Markdown in `docs/user/`, published to GitHub Pages with VitePress): getting started, drawing basics, devices and interfaces, links, VLANs and IPAM, views, validation, importing from Cisco CLI, exporting, shortcuts, FAQ.
- **DOC-02** Developer guide (`docs/dev/`): architecture overview with diagram, command pattern, adding features end to end, release process, signing setup.
- **DOC-03** File-format specification (`docs/file-format.md`) with the JSON Schema and a fully annotated example file.
- **DOC-04** ADRs (`docs/adr/0001-…`) for: Tauri over Electron, React Flow over maxGraph, command/patch architecture, file format, license.
- **DOC-05** In-app: tooltips on every toolbar button, empty-state hints, Help → Keyboard shortcuts, Help → Documentation (opens browser).
- **DOC-06** `TRACEABILITY.md`: every requirement ID in this spec → implementing module(s) → test file(s) → status.

## 13. Phased milestones and acceptance criteria

**Seven milestones, each ending in a tagged pre-release that installs and runs on both Windows and macOS.** The agent must not start a milestone until the previous one's acceptance criteria all pass in CI.

**M0 — Foundation** (tag `v0.0.1`)

- pnpm monorepo, `apps/desktop` (Tauri 2 + React + Vite + TS strict), `packages/core`, `packages/parsers`, `packages/device-library`.
- ESLint, Prettier, rustfmt, clippy, commitlint, Husky pre-commit; Vitest and Playwright wired; `PlatformAdapter` with both implementations.
- `ci.yml` green on Windows and macOS; unsigned debug installers uploaded as artifacts.
- LICENSE, README skeleton, CONTRIBUTING, CODE\_OF\_CONDUCT, SECURITY, ADRs 0001–0005, `TRACEABILITY.md` seeded with every requirement ID.
- **Accept when:** a fresh clone builds with documented commands on both OSes; the app opens an empty window with menus; CI passes.

**M1 — Core model and canvas** (tag `v0.1.0`)

- Zod schemas for all entities, command layer, history with drag coalescing, selectors.
- Canvas: pan/zoom, grid/snap, guides, selection, move, arrange, copy/paste, minimap (FR-CAN-01…09).
- Original icon set (Classic + Line) for all roles; generic templates; library panel with search.
- Links with interface picker, routing styles, interface labels (FR-LNK-01…05).
- Inspector with device fields and interface table.
- Native save/open, atomic save, autosave, crash recovery, recent files, file association (FR-FMT-01…07).
- **Accept when:** E2E journey 1 passes; undo/redo property test passes; save → reopen is byte-identical.

**M2 — Network features** (tag `v0.2.0`)

- VLAN manager, subnet/IPAM manager, subnet calculator, point-to-point helper (FR-NET-05…08).
- Loopbacks, SVIs, sub-interfaces, port-channels and bundle rendering; parallel links.
- Zones/containers, multi-page with off-page references, layers panel, annotations, images.
- L1/L2/L3 view switcher, VLAN highlight, path highlight (FR-NET-30…33).
- Template editor; verified vendor templates with datasheet links.
- **Accept when:** E2E journey 2 passes; IP math property tests pass; a 50-device campus can be drawn fully by keyboard and mouse.

**M3 — Validation** (tag `v0.3.0`)

- Rule engine in a worker, rules VAL-001…020, problems panel, canvas badges, quick fixes, suppressions.
- **Accept when:** E2E journey 5 passes; each rule has positive and negative unit tests; 1,000-device validation < 200 ms.

**M4 — Import** (tag `v0.4.0`)

- Parsers FR-IMP-01…05 with fixtures, auto-detect, merge preview, de-duplication, secret stripping, auto-layout of imported devices; ELK/d3 layouts in a worker (FR-CAN-14).
- SHOULD importers (draw.io, GNS3, Containerlab) if time allows.
- **Accept when:** E2E journeys 3 and 4 pass; fuzz tests run 10,000 inputs per parser without crash or hang.

**M5 — Export, polish, accessibility, performance** (tag `v0.9.0-beta`)

- Exports FR-EXP-01…06 and print; starter templates (FR-APP-06); command palette, find, preferences, welcome screen.
- Accessibility pass (NFR-A11Y-01…05) incl. topology outline panel; all strings externalized.
- Performance pass against NFR-PERF with the `bench/` suite.
- **Accept when:** E2E journeys 6–8 pass; zero axe violations; all NFR-PERF targets met in CI benchmarks.

**M6 — Release engineering and v1.0** (tag `v1.0.0`)

- `release.yml` with signing, notarization, universal macOS build, Windows x64/ARM64, MSI + NSIS, `latest.json`, checksums, SBOM.
- Updater with stable/beta channels; About dialog with licenses.
- User guide and developer guide published; file-format spec; release checklist completed on all four target machines.
- **Accept when:** a v0.9 install auto-updates to v1.0 on both OSes; Gatekeeper accepts the macOS build; every MUST in `TRACEABILITY.md` is marked done with a linked test.

## 14. Out of scope for v1 and future roadmap

**Out of scope for v1.0 — the agent must not build these, and must refuse scope creep toward them:**

- Packet, routing, STP or traffic simulation (that is Packet Tracer/GNS3 territory)
- Live device discovery (SSH, SNMP, NETCONF/RESTCONF, gNMI) and storing device credentials
- Pushing configuration to devices or generating full device configs
- Real-time multi-user collaboration and cloud accounts/sync
- Importing Cisco Packet Tracer `.pkt` files (proprietary, encrypted format)
- Visio `.vsdx` import/export
- Mobile apps

**Post-1.0 roadmap candidates (in rough priority order)**

1. Live discovery via SSH/SNMP with credentials in the OS keychain (macOS Keychain, Windows Credential Manager), opt-in, read-only commands only.
2. NetBox and Nautobot sync (read topology from, and push diagrams to, a source of truth).
3. Config snippet generation (interface IPs, VLANs, trunks) from the model, with diff view.
4. Visio `.vsdx` export.
5. Diagram diff/compare between two files or two Git revisions.
6. Plugin API for third-party importers, exporters, validation rules and icon packs.
7. Cloud architecture shapes (AWS/Azure/GCP networking) using each provider's own icon licenses.
8. Web version using the existing `BrowserPlatform`.
9. Real-time collaboration via CRDTs (Yjs) on top of the command layer.

## 15. Brand and logo

**LineWise uses the "Routed L" mark: a link that leaves a switch port, carries a packet, bends at an interface and lands on an endpoint, drawn on the app's dot-grid canvas.** The design exploration lives on the [LineWise Logo canvas](https://claude.ai/artifact/N9ct5P9KEJEmMhQ6kfgUbY) (private to you until shared). The SVG masters at the end of this section are the source of truth; the agent copies them into `packages/brand/` and must not redraw them.

**What each part of the mark stands for**

- **Port node** (white rounded square with an RJ45-style notch, top left): where the link starts — a switch port.
- **Link** (white orthogonal stroke): the right-angle routing style the canvas uses; it forms the "L" of LineWise.
- **Packet** (small teal square on the vertical run): traffic on the link.
- **Interface ring** (hollow node at the bend): an interface where the path changes direction.
- **Endpoint** (teal node with a white centre): the destination, and the "wise" accent.
- **Dot grid** (faint dots, large sizes only): the LineWise canvas itself.

**Colors**

| Token | Hex | Used for |
| --- | --- | --- |
| Ink | `#0E1726` | Icon background, "Line" in the wordmark, dark-theme app surfaces |
| Ink raised | `#1A2436` (border `#2C3A52`) | Icon body when it sits on an ink background |
| Link teal | `#0D9488` | Packet, endpoint, "Wise" in the wordmark, the app's UI accent color |
| White | `#FFFFFF` | Link stroke, port node, interface ring, endpoint centre |
| Panel | `#F4F6F8` | Light surfaces behind the logo |
| Muted text | `#4B5563` light / `#A3AEBF` dark | Subline and captions |

**Typography**

- Wordmark: **Sora SemiBold (600)**, letter-spacing −3%, "Line" in Ink and "Wise" in Link teal (on dark backgrounds "Line" is white).
- Subline and technical accents: **IBM Plex Mono** 400/500, e.g. the subline "network architecture diagrams".
- Both fonts are SIL OFL 1.1. Bundle the font files in the app; never load them from Google Fonts at runtime (NFR-SEC-02, NFR-PRIV-01). App body text uses the system UI font stack.

**Lockup:** icon, then a 22-unit gap, then the wordmark at 0.6× the icon height; the optional subline sits 10 units below the wordmark at 0.15× the icon height. Clear space around any lockup equals the width of the port node.

**Size rules**

| Rendered size | Master to use | What changes |
| --- | --- | --- |
| 96 px and up | `app-icon.svg` | Full mark with dot grid |
| 48–64 px | `app-icon.svg` with the grid layer removed | No grid |
| 32 px and below | `app-icon-small.svg` | No notch, packet or interface ring; thicker link |
| Print, one color, watermarks | `logo-mark-mono.svg` | Ink only, transparent background |

**Don'ts:** don't rotate, stretch, outline or add gradients or shadows; don't change node shapes or the bend direction; don't recolor except for the approved alternates (blue `#2563EB`, purple `#7C3AED`, orange `#EA580C`), which are for internal experiments only.

**Brand requirements**

- **BRD-01 (MUST)** `packages/brand/` holds the four SVG masters below verbatim, plus `lockup-light.svg` and `lockup-dark.svg` built to the lockup rule, with the wordmark converted to paths from the bundled Sora file (e.g. with opentype.js) so lockups render without the font installed.
- **BRD-02 (MUST)** App icons generated with `tauri icon` from a 1024 px PNG render of `app-icon.svg`. For macOS, centre the icon body at about 80% of the 1024 px canvas (Apple's template uses an 824 px body). The 16 and 32 px entries of the Windows `.ico` come from `app-icon-small.svg`.
- **BRD-03 (MUST)** `.lwise` document icon on both OSes from `doc-icon.svg`, registered through the file association (FR-APP-09).
- **BRD-04 (MUST)** The brand appears on: welcome screen, About dialog, macOS DMG background, Windows NSIS/MSI installer images, README header, docs-site logo and favicon.
- **BRD-05 (MUST)** The app theme's accent color is Link teal and the dark theme's base surface is Ink; all text pairs meet NFR-A11Y-04 contrast.
- **BRD-06 (SHOULD)** `docs/brand.md` documents this section for contributors.

**`app-icon.svg`** (full mark, 96 px and up)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="0.9" fill="#FFFFFF" fill-opacity="0.16"/>
    </pattern>
  </defs>
  <rect width="64" height="64" rx="14" fill="#0E1726"/>
  <rect id="grid-layer" width="64" height="64" rx="14" fill="url(#grid)"/>
  <path d="M20 22V44H38" fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="13" y="10" width="14" height="13" rx="3.5" fill="#FFFFFF"/>
  <rect x="16.5" y="13.5" width="7" height="4.5" rx="1" fill="#0E1726"/>
  <rect x="17.5" y="29" width="5" height="5" rx="1.2" fill="#0D9488"/>
  <circle cx="20" cy="44" r="3.2" fill="#0E1726" stroke="#FFFFFF" stroke-width="2.2"/>
  <circle cx="45" cy="44" r="7.5" fill="#0D9488"/>
  <circle cx="45" cy="44" r="2.6" fill="#FFFFFF"/>
</svg>
```

**`app-icon-small.svg`** (32 px and below)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0E1726"/>
  <path d="M20 22V44H38" fill="none" stroke="#FFFFFF" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="12" y="9" width="16" height="15" rx="4" fill="#FFFFFF"/>
  <circle cx="45" cy="44" r="8.5" fill="#0D9488"/>
</svg>
```

**`logo-mark-mono.svg`** (one color, transparent background)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <path d="M20 22V44H38" fill="none" stroke="#0E1726" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="13" y="10" width="14" height="13" rx="3.5" fill="#0E1726"/>
  <rect x="16.5" y="13.5" width="7" height="4.5" rx="1" fill="#FFFFFF"/>
  <circle cx="20" cy="44" r="3.2" fill="#FFFFFF" stroke="#0E1726" stroke-width="2.2"/>
  <circle cx="45" cy="44" r="7.5" fill="#0E1726"/>
  <circle cx="45" cy="44" r="2.6" fill="#FFFFFF"/>
</svg>
```

**`doc-icon.svg`** (`.lwise` document icon)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 152">
  <path d="M24 6H80L106 32V136A10 10 0 0 1 96 146H24A10 10 0 0 1 14 136V16A10 10 0 0 1 24 6Z" fill="#FFFFFF" stroke="#CDD4DE" stroke-width="2"/>
  <path d="M80 6V24A8 8 0 0 0 88 32H106" fill="#EEF1F5" stroke="#CDD4DE" stroke-width="2" stroke-linejoin="round"/>
  <svg x="28" y="38" width="64" height="64" viewBox="0 0 64 64">
    <path d="M20 22V44H38" fill="none" stroke="#0E1726" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="13" y="10" width="14" height="13" rx="3.5" fill="#0E1726"/>
    <rect x="16.5" y="13.5" width="7" height="4.5" rx="1" fill="#FFFFFF"/>
    <rect x="17.5" y="29" width="5" height="5" rx="1.2" fill="#0D9488"/>
    <circle cx="20" cy="44" r="3.2" fill="#FFFFFF" stroke="#0E1726" stroke-width="2.2"/>
    <circle cx="45" cy="44" r="7.5" fill="#0D9488"/>
    <circle cx="45" cy="44" r="2.6" fill="#FFFFFF"/>
  </svg>
  <rect x="28" y="112" width="64" height="22" rx="6" fill="#0E1726"/>
  <text x="60" y="127" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="12" font-weight="500" fill="#FFFFFF">.lwise</text>
</svg>
```

In the shipped `doc-icon.svg`, convert the `.lwise` label to paths from the bundled IBM Plex Mono file, like the wordmark in BRD-01, so it renders identically on machines without the font.
