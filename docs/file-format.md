# LineWise file format (`.lwise`)

A LineWise diagram is one UTF-8 JSON file with the extension `.lwise`. It holds the network
model (devices, interfaces, links, VLANs, subnets…) and the drawing of it (pages with node
positions and annotations). The format is meant to be read, reviewed and merged in Git.

- **Schema:** [`schema/v1.json`](../schema/v1.json), a JSON Schema (draft 2020-12) generated from
  the Zod schemas in [`packages/core/src/schema.ts`](../packages/core/src/schema.ts). The Zod
  schemas are the source of truth; a test fails if the committed JSON Schema drifts from them.
- **Example:** [`examples/branch-office.lwise`](examples/branch-office.lwise), annotated below. A
  golden test checks that it loads without warnings and re-serializes byte for byte.
- **Decision record:** [ADR 0004](adr/0004-file-format.md).

## Encoding rules (FR-FMT-01, FR-FMT-02)

| Rule          | Detail                                                                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Encoding      | UTF-8, no BOM, LF line endings, 2-space indent, trailing newline.                                                                                                                                                                                            |
| Key order     | Object keys are sorted alphabetically at every level, so saving an unchanged diagram rewrites the same bytes.                                                                                                                                                |
| Array order   | Entity arrays (`devices`, `links`, `vlans`, `subnets`, `zones`, `vrfs`, `portChannels`) are sorted by `id`. Arrays whose order carries meaning keep it: `pages` (tab order), a device's `interfaces` (port order), `ipv4`/`ipv6` (primary first), waypoints. |
| Identity      | `"format": "LineWise"` and an integer `"schemaVersion"` (currently `1`) are required. `"$schema"` points at the published JSON Schema for that version.                                                                                                      |
| Ids           | Opaque strings, unique within the file. LineWise writes UUIDv7s; the example uses short sequential ids so it stays readable. References between entities are always by id.                                                                                   |
| Timestamps    | ISO 8601 UTC strings (`createdAt`, `updatedAt` on every entity).                                                                                                                                                                                             |
| Defaults      | Every optional field with a default is written out, so a file never depends on the reader's defaults. Fields without a default (`accessVlan`, `vrfId`, `zoneId`, …) are omitted when unset.                                                                  |
| Custom fields | Every entity has `customFields`: a map of string to string, number or boolean.                                                                                                                                                                               |

## Top level

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/gavenrobertson/linewise/main/schema/v1.json",
  "format": "LineWise",          // required, exactly this string
  "schemaVersion": 1,            // required; drives migrations
  "id": "ex--0001",              // document id
  "name": "Branch office",       // shown in the title bar and title block
  "description": "", "author": "",
  "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z",
  "pages": [ … ],                // at least one page; drawings live here
  "devices": [ … ], "links": [ … ], "portChannels": [ … ],
  "zones": [ … ], "vlans": [ … ], "vrfs": [ … ], "subnets": [ … ],
  "assets": { },                 // embedded images and custom icons, by id
  "settings": { … },             // per-document display and validation settings
  "metadata": { }                // free-form; preserved but not interpreted
}
```

The model and the drawing are separate: a device exists once in `devices` and appears on a page
through that page's `nodePositions`.

## Devices and interfaces

From the example, router `R1` with one routed interface (default-valued fields shortened):

```jsonc
{
  "id": "ex--0003",
  "hostname": "R1",
  "role": "router", // one of the device roles, picks the icon and validation rules
  "vendor": "",
  "model": "",
  "platform": "",
  "osVersion": "",
  "serial": "",
  "assetTag": "",
  "mgmtIp": "",
  "site": "",
  "rack": "", // "rackUnit": 12 when set
  "tags": [],
  "notes": "",
  "labelPosition": "bottom", // bottom | top | left | right
  "locked": false,
  "routing": [], // e.g. [{ "protocol": "ospf", "value": "area 0" }]
  "interfaces": [
    {
      "id": "ex--0008",
      "deviceId": "ex--0003", // back-reference to the owning device
      "name": "Ethernet0",
      "shortName": "Eth0",
      "type": "ethernet",
      "mode": "routed", // access | trunk | routed | unset
      "enabled": true,
      "duplex": "auto",
      "media": "any",
      "poe": false,
      "description": "",
      "allowedVlans": "", // Cisco range syntax for trunks, "" = all
      "ipv4": [{ "address": "10.0.10.1", "prefix": 24, "secondary": false }],
      "ipv6": [],
      // optional: speedMbps, mtu, accessVlan, nativeVlan, vrfId, portChannelId,
      // dot1q (sub-interfaces), mac, fhrp { protocol, group, vip }
    },
  ],
  // optional: templateId, zoneId, iconOverride ("router" or "asset:<id>"), colorTag
}
```

Switch `SW1` has an access port in VLAN 10: `"mode": "access", "accessVlan": 10`.

## Links and port-channels

```jsonc
{
  "id": "ex--0007",
  "endpointA": { "deviceId": "ex--0003", "interfaceId": "ex--0008" },
  "endpointB": { "deviceId": "ex--0004", "interfaceId": "ex--0009" },
  "medium": "copper", // copper | fiber-sm | fiber-mm | serial | wireless | virtual | console
  "label": "",
  "cableId": "",
  "circuitId": "",
  "provider": "",
  "style": {}, // optional routing (straight | orthogonal | curved), color, waypoints [{x, y}]
  // optional: bandwidthMbps
}
```

A link always joins two interfaces. Port-channels (`portChannels`) belong to one device and list
their `memberInterfaceIds`, a `number`, a `mode` (`lacp-active`, `lacp-passive`, `on`, `pagp`) and
optionally the `logicalInterfaceId` of the `Port-channelN` interface.

## VLANs, subnets, VRFs and zones

```jsonc
"vlans":   [{ "id": "ex--0005", "number": 10, "name": "Users", "color": "#2563EB",
              "description": "", "subnetIds": [] }],
"subnets": [{ "id": "ex--0006", "cidr": "10.0.10.0/24", "name": "Users",
              "vlanId": "ex--0005", "gatewayIp": "10.0.10.1", "description": "",
              "reserved": [] }]     // [{ "start": "10.0.10.200", "end": "10.0.10.250", "note": "DHCP" }]
```

- VLAN `number` is 1–4094; `site` scopes a VLAN to one site when VLAN numbers are reused.
- A subnet may name a `vlanId` and a `vrfId`. Addresses on interfaces are matched to subnets by
  prefix, not by reference.
- `vrfs` have a `name`, a route distinguisher `rd` and a `description`.
- `zones` group devices (sites, buildings, floors, security zones, cloud VPCs). They have a `kind`,
  a `color`, an optional `parentZoneId` for nesting, and are drawn through `zoneBoxes` on a page.

## Pages

```jsonc
{
  "id": "ex--0002",
  "name": "Page 1",
  "order": 0,
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "background": "dots", // dots | grid | plain
  "nodePositions": {
    // device id → icon center
    "ex--0003": { "x": 0, "y": 0 },
    "ex--0004": { "x": 0, "y": 200 },
  },
  "zoneBoxes": {}, // zone id → { x, y, w, h }
  "annotations": [], // text, rect, ellipse, line, note, image
  "layers": [], // { id, name, visible, locked, order }
  "offPageRefs": [], // devices from other pages shown as references
}
```

Annotations have a `kind`, a `geometry` (`x`, `y`, `w`, `h`, `rotation`), optional `style`
(`fill`, `stroke`, `fontSize`, `arrowEnd`), `text`, and for images an `assetId`.

## Assets (FR-FMT-04)

`assets` maps an id to `{ "mime": "image/png", "base64": "…" }`. Annotations and custom device
icons refer to assets by id, so the same image is stored once. SVG assets are sanitized with
DOMPurify when you import them. Assets are only ever shown as images (`<img>`, or `<image>` in an
SVG export), and only when the MIME type is `image/png`, `image/jpeg`, `image/gif`, `image/webp`
or `image/svg+xml` and the payload is plain base64; anything else in a hand-edited file is
ignored. LineWise warns when a file is larger than 20 MB.

## Settings

```jsonc
"settings": {
  "labelTemplate": "{hostname}",        // device label template
  "defaultLinkRouting": "straight",
  "iconStyle": "classic",               // classic | line
  "showInterfaceNames": true, "showInterfaceIps": false, "showVlans": false,
  "interfaceNames": "short",            // short (Gi1/0/1) | long (GigabitEthernet1/0/1) on link labels; added 2026-10, older files read as short
  "disabledRules": [],                  // validation rule ids turned off for this document
  "suppressions": []                    // [{ "ruleId", "objectIds": [...], "reason" }]
}
```

## Loading, versions and recovery (FR-FMT-03, FR-FMT-05)

| File                                   | What LineWise does                                                                                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid, same version                    | Opens normally.                                                                                                                                             |
| Older `schemaVersion`                  | Runs the ordered migrations (`v1→v2→…`) in memory. The file on disk is not touched until you save.                                                          |
| Newer `schemaVersion`                  | Opens read-only with "Made with a newer version of LineWise".                                                                                               |
| Valid JSON but fails the schema        | Opens the recovery dialog, which lists each problem by path and offers to load every entity that is valid on its own. Links to missing devices are dropped. |
| Not JSON, or no `"format": "LineWise"` | Refused with a message; nothing is opened.                                                                                                                  |

Each migration is a pure function in `packages/core/src/serialize.ts`, registered with
`registerMigration(fromVersion, fn)`, and has unit tests and fixture files.

## Saving (FR-FMT-06, FR-FMT-07)

- Saves are atomic: LineWise writes a temporary file in the same folder, flushes it to disk, then
  renames it over the target. The previous version is kept as `<name>.lwise.bak`.
- Autosave writes to the app-data recovery folder every 60 seconds (configurable) and when the
  window loses focus. It never writes over your file. After a crash, LineWise offers to restore.
- LineWise never stores device passwords, secrets or SNMP communities. Importers strip them
  before anything reaches the model (FR-IMP-25).

## Writing files from other tools

A file only needs to be valid against the schema. If you generate one:

1. Set `format`, `schemaVersion` and at least one page.
2. Give every entity a unique `id`, `createdAt` and `updatedAt`.
3. Point each interface's `deviceId` at its device, and each link endpoint at a real interface.
4. Put each device you want to see into a page's `nodePositions`.

You may omit fields that have defaults. LineWise fills them in on load and writes them out, sorted,
on the next save.
