# LineWise user guide

LineWise draws network diagrams that know what they show. Devices have real interfaces, links join
two ports, and VLANs, subnets and IP addresses are part of the model, so LineWise can check your
design and export inventories as well as pictures. It works fully offline.

> This page is the guide's starting point. The full guide, with a page per topic, is published
> with version 1.0.

## Getting started

1. **Start a diagram.** The welcome screen offers a blank diagram, starter templates (a CCNA lab, a
   three-tier campus and a collapsed-core campus) and your recent files. **File → New** (`Ctrl+N`, `⌘N` on macOS)
   opens another diagram in a new tab.
2. **Add devices.** Drag a device from the **Library** panel onto the canvas, or press
   `Ctrl+Shift+D`, type a few letters (`router`, `24 port`) and press `Enter`. Each device comes
   with the interfaces of its template.
3. **Connect them.** Hover a device, drag from one of its four handles and drop on another device.
   Pick the ports in the dialog (type in the filter box, for example `gi1/0/7`), or keep **Next free
   port**.
4. **Describe them.** Select a device or link and edit it in the **Inspector**: hostname,
   management IP, interfaces, VLAN modes, addresses, link medium and label.
5. **Save.** `Ctrl+S` saves a `.lwise` file. Saves are atomic and keep one `.bak` of the previous
   version. LineWise also autosaves to a recovery folder and offers to restore after a crash.

## Drawing basics

- **Pan** with the scroll wheel or trackpad, or drag the canvas with the middle or right mouse button.
  **Zoom** with `Ctrl` (`⌘`) and the wheel, or pinch. `Ctrl+0` fits the page.
- **Select** by clicking, `Shift`-click to add, or drag a box on empty canvas. Arrow keys nudge the
  selection; hold `Shift` for larger steps.
- **Align and distribute** from the **Arrange** menu. Smart guides appear while you drag.
- **Undo** anything with `Ctrl+Z`. One drag, paste or import is one undo step. Each tab has its
  own history.
- **Links** can be straight, orthogonal or curved. Double-click a link to add a bend point; drag it
  to move, double-click it to remove it. Parallel links between two devices fan out on their own.
- **Auto-layout** (`Ctrl+Shift+L`) arranges a page: hierarchical (top-down or left-right),
  orthogonal, force-directed, circular or grid. It runs in the background and undoes in one step.

## Views

The same model shows three ways. Switch with `Ctrl+1`, `Ctrl+2` and `Ctrl+3`.

| View           | Shows                           |
| -------------- | ------------------------------- |
| Physical (L1)  | Cables, ports and media         |
| Data link (L2) | VLANs, trunks and port-channels |
| Network (L3)   | Subnets, addresses and routing  |

## Checking your design

The **Problems** panel (`Ctrl+Shift+M`) lists what LineWise finds as you work, such as duplicate IP
addresses, mismatched VLANs on a trunk, or a fiber module cabled to a copper port. Select a problem
to jump to it. You can turn rules off for one diagram or suppress a single finding with a reason.

## Importing from Cisco CLI

**File → Import** (`Ctrl+I`) reads pasted text or files from many devices at once:
`show cdp neighbors detail`, `show lldp neighbors detail`, `show running-config`,
`show ip interface brief`, `show interfaces status`, `show vlan brief` and
`show etherchannel summary`, plus CSV and other diagram formats. You review a preview of every
device and link before anything changes. LineWise never runs commands on your devices, and it drops
passwords, secrets and SNMP communities from configs before they reach the diagram.

## Exporting

**File → Export** (`Ctrl+E`) writes PNG, SVG, PDF (with a title block), CSV inventories and IP
plans, an HTML or Markdown report, and draw.io files. **File → Print** uses the same PDF output.

## Keyboard shortcuts

On macOS, `Ctrl` is `⌘` and `Alt` is `⌥`. **Help → Keyboard shortcuts** (`Ctrl+/`) shows the full
list in the app.

| Action                                  | Shortcut                                         |
| --------------------------------------- | ------------------------------------------------ |
| New, open, save, save as                | `Ctrl+N`, `Ctrl+O`, `Ctrl+S`, `Ctrl+Shift+S`     |
| Import, export, print                   | `Ctrl+I`, `Ctrl+E`, `Ctrl+P`                     |
| Close diagram, next or previous diagram | `Ctrl+W`, `Ctrl+Tab`, `Ctrl+Shift+Tab`           |
| Undo, redo                              | `Ctrl+Z`, `Ctrl+Shift+Z`                         |
| Cut, copy, paste, duplicate, delete     | `Ctrl+X`, `Ctrl+C`, `Ctrl+V`, `Ctrl+D`, `Delete` |
| Select all, select all of the same type | `Ctrl+A`, `Ctrl+Shift+A`                         |
| Copy style, paste style                 | `Ctrl+Alt+C`, `Ctrl+Alt+V`                       |
| Find                                    | `Ctrl+F`                                         |
| Command palette                         | `Ctrl+K`                                         |
| Search the device library               | `Ctrl+Shift+D`                                   |
| Physical, data link, network view       | `Ctrl+1`, `Ctrl+2`, `Ctrl+3`                     |
| Zoom in, out, fit, to selection         | `Ctrl+=`, `Ctrl+-`, `Ctrl+0`, `Ctrl+Shift+0`     |
| Problems panel                          | `Ctrl+Shift+M`                                   |
| Presentation mode                       | `F5`                                             |
| Auto-layout                             | `Ctrl+Shift+L`                                   |
| Bring to front, send to back            | `Ctrl+Shift+]`, `Ctrl+Shift+[`                   |
| Group, ungroup                          | `Ctrl+G`, `Ctrl+Shift+G`                         |
| Lock, unlock                            | `Ctrl+L`, `Ctrl+Shift+K`                         |
| Preferences                             | `Ctrl+,`                                         |

## Privacy

LineWise works offline. The only network request it makes is the update check, which you can turn
off in Preferences. LineWise sends no telemetry or crash reports. See [PRIVACY.md](../../PRIVACY.md).

## Getting help

Report bugs and ask questions on
[GitHub Issues](https://github.com/gavenrobertson/linewise/issues). Report security problems
privately as described in [SECURITY.md](../../SECURITY.md).
