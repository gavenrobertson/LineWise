# Getting started

This page takes you from the welcome screen to a saved diagram. Shortcuts are written for Windows
and Linux; on macOS, use `⌘` where this page says `Ctrl`.

## The welcome screen

LineWise opens on the welcome screen. **File → New Diagram** (`Ctrl+N`) and the **+** button next
to the diagram tabs bring it back.

| Choice                      | What it does                                                        |
| --------------------------- | ------------------------------------------------------------------- |
| **New blank diagram**       | Opens an empty diagram.                                             |
| **Open file…**              | Opens a `.lwise` file.                                              |
| **Import from CLI output…** | Opens the import dialog. See [Importing from Cisco CLI](import.md). |
| **Start from a template**   | Opens a ready-made network that you can change.                     |
| **Recent**                  | The last 10 files you opened or saved.                              |
| **Recovered work**          | Shown only after a crash. See [Recovery copies](#recovery-copies).  |

The starter templates are:

| Template                   | Contents                                                                   |
| -------------------------- | -------------------------------------------------------------------------- |
| **Small office**           | Internet, firewall, one switch, Wi-Fi, users, printer and a server.        |
| **Three-tier campus**      | Core, distribution and access layers with redundant uplinks and VLANs.     |
| **Collapsed-core campus**  | Two core/distribution switches, firewall and access switches.              |
| **Spine-leaf data center** | Two spines fully meshed to four leaves, with servers.                      |
| **Hub-and-spoke WAN**      | Headquarters hub and three branches over an MPLS cloud.                    |
| **DMVPN**                  | A DMVPN hub with spokes over the internet; tunnels drawn as virtual links. |
| **CCNA lab**               | Three routers in a triangle and two switches.                              |

## The main window

- The **toolbar** runs along the top: new, open, save, undo and redo, insert tools, **Arrange**,
  the **L1 / L2 / L3** view switch, VLAN and path highlighting, import, export and the command
  palette.
- The **sidebar** on the left has three tabs: **Library** (device templates), **Outline** (a tree
  of zones, devices, interfaces and link peers) and **Layers**.
- The **canvas** is in the middle. Open diagrams show as tabs above it, and the diagram's pages as
  tabs below it.
- The **Inspector** on the right edits whatever is selected. With nothing selected it edits the
  diagram itself.
- The **Problems** panel opens below the canvas with `Ctrl+Shift+M`.
- The **status bar** shows save state, the selection, device and link counts, error and warning
  counts and the zoom level. Click the zoom level to fit the page.

The three toolbar buttons at the right end show and hide the sidebar, the Problems panel and the
Inspector.

## Your first diagram

1. **Start a diagram.** Choose **New blank diagram** or a starter template.
2. **Add devices.** Drag a device from the **Library** onto the canvas, or press `Ctrl+Shift+D`,
   type a few letters (`router`, `48`) and press `Enter`. Each device comes with the interfaces of
   its template and a hostname such as `R1` or `SW1`.
3. **Connect them.** Hover a device, drag from one of its four handles and drop on another device.
   Pick the ports in the dialog, or keep **Next free port**. See [Links](links.md).
4. **Describe them.** Select a device or link and edit it in the **Inspector**: hostname,
   management IP, interfaces, VLAN modes, addresses, link medium and label. See
   [Devices and interfaces](devices.md).
5. **Save.** `Ctrl+S` saves a `.lwise` file.

## Saving and opening

- `Ctrl+S` saves, `Ctrl+Shift+S` saves under a new name, `Ctrl+O` opens a file.
- Saves are atomic: a failed save never leaves a half-written file. The previous version is kept
  next to it as `<name>.lwise.bak`.
- Each open diagram has its own tab with its own undo history. `Ctrl+Tab` and `Ctrl+Shift+Tab`
  switch tabs, `Ctrl+W` closes one. A dot on a tab marks unsaved changes.
- Closing a diagram or quitting with unsaved changes asks **Save**, **Don’t Save** or **Cancel**
  for each one.
- A file from an older version of LineWise is upgraded when it opens. Save to keep the new format.
- A file saved by a newer version opens read-only. Use **Save As** to keep a copy in your
  version's format.
- A damaged file opens the **This file has problems** dialog, which lists the problems. LineWise
  does not change the file. **Open recovered copy** opens the readable parts as a new diagram.

The format is plain JSON and is described in the [file format](../file-format.md) reference.

## Recovery copies

While a diagram has unsaved changes, LineWise writes a recovery copy to its app-data folder every
60 seconds and whenever the window loses focus. It never writes over your file. Change the interval
under **Recovery copy every** in Preferences (`Ctrl+,`); `0` turns recovery copies off.

After a crash, the welcome screen lists the copies under **Recovered work**. Click a name to
restore it, or **×** to discard it. A restored diagram counts as unsaved until you save it.

## Help as you go

- **The tour.** The first time you open a diagram, a four-step tour points out the library, the
  canvas, drawing links and the Inspector. Skip it with **Escape**; **Help → Take the Tour** shows
  it again.
- **Tooltips.** Rest the pointer on a button, or Tab to it, to see what it does and its shortcut.
- **? and ⓘ.** A **?** beside a heading explains that section, with an example and a link to this
  guide. An **ⓘ** beside a field explains the networking term.
- **Hover cards.** Rest the pointer on a device, a link, an interface or a subnet to see its details.
- **Why?** Each problem in the Problems panel can tell you why it matters and how to fix it.
- **Tips.** Now and then a tip suggests a quicker way, at most once per session. Turn tips off, or
  back on, with **Show tips** in Preferences.

## Next steps

- [Drawing basics](drawing.md) covers selecting, arranging, zones, notes and pages.
- [VLANs and IPAM](vlans-ipam.md) covers VLANs, subnets and addressing.
- [Validation](validation.md) explains the checks in the Problems panel.
