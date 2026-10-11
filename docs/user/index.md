# LineWise user guide

LineWise draws network diagrams that know what they show. Devices have real interfaces, links join
two ports, and VLANs, subnets and IP addresses are part of the model, so LineWise can check your
design and export inventories as well as pictures. It works fully offline.

## Contents

1. [Getting started](getting-started.md): the welcome screen, the main window, your first diagram,
   saving and recovery.
2. [Drawing basics](drawing.md): moving around, selecting, arranging, auto-layout, zones, notes,
   layers and pages.
3. [Devices and interfaces](devices.md): device details, the interface table, port-channels,
   templates and icon packs.
4. [Links](links.md): connecting ports, media, line styles, bend points and path highlighting.
5. [VLANs and IPAM](vlans-ipam.md): the VLAN manager, subnets, VLSM, point-to-point addressing,
   VRFs and the subnet calculator.
6. [Views](views.md): the physical, data link and network views of the same model.
7. [Validation](validation.md): the Problems panel, every rule, quick fixes and suppressions.
8. [Importing from Cisco CLI](import.md): `show` output, running configs, CSV and other formats,
   with a preview before anything changes.
9. [Exporting](export.md): PNG, SVG, PDF, CSV, reports, draw.io, Containerlab, Mermaid, DOT and
   printing.
10. [Keyboard shortcuts](shortcuts.md): every shortcut, on the canvas and in dialogs.
11. [FAQ](faq.md): common questions about privacy, files, views and validation.

## Privacy

LineWise works offline. The only network request it makes is the update check, which you can turn
off in Preferences. LineWise sends no telemetry or crash reports. See [PRIVACY.md](../../PRIVACY.md).

## Getting help

Report bugs and ask questions on
[GitHub Issues](https://github.com/gavenrobertson/linewise/issues). Report security problems
privately as described in [SECURITY.md](../../SECURITY.md).
