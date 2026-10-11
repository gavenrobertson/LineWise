# Exporting

LineWise exports pictures of a diagram, tables built from its model, reports and topology files for
other tools. Everything is written to a file you choose; nothing is uploaded. Shortcuts are written
for Windows and Linux; on macOS, use `⌘` where this page says `Ctrl`.

## The Export dialog

**File → Export…** (`Ctrl+E`), or the export button on the toolbar, opens **Export**. Pick a
**Format**, set its options and choose **Export…** to pick where to save.

| Format                    | File        | Contents                                                                       |
| ------------------------- | ----------- | ------------------------------------------------------------------------------ |
| **PNG image**             | `.png`      | The current page or the selection, as a picture.                               |
| **SVG image**             | `.svg`      | The same as a vector drawing.                                                  |
| **PDF document**          | `.pdf`      | One or all pages, with an optional title block.                                |
| **CSV table**             | `.csv`      | One table from the model: inventory, interfaces, cabling, IP plan or port map. |
| **HTML report**           | `.html`     | A self-contained report.                                                       |
| **Markdown report**       | `.md`       | The same report in Markdown.                                                   |
| **draw.io diagram**       | `.drawio`   | The current page for diagrams.net.                                             |
| **Containerlab topology** | `.clab.yml` | Nodes and links for a Containerlab lab.                                        |
| **Mermaid**               | `.mmd`      | A text topology for docs-as-code.                                              |
| **Graphviz DOT**          | `.dot`      | A text topology for Graphviz.                                                  |

Pictures, PDFs, reports and printouts show the [view](views.md) (L1, L2 or L3) that is on screen
when you export. The suggested file name is the diagram's name; for a diagram with several pages,
PNG, SVG, draw.io, Mermaid and DOT files add the page name.

## PNG and SVG

| Option                     | Choices                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Colors**                 | **Light** or **Dark**.                                                                                           |
| **What to export**         | **Whole page**, or **Selection** for the selected devices. With nothing selected, the whole page is exported.    |
| **Scale** (PNG only)       | 1× to 4×. The default comes from **Default PNG scale** in Preferences, and the last scale you use is remembered. |
| **Transparent background** | Leaves out the page background.                                                                                  |
| **Include grid**           | Draws the dot grid behind the diagram.                                                                           |

## PDF

| Option                                         | Choices                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Colors**                                     | **Light** or **Dark**.                                                                                                    |
| **Paper**                                      | Letter, A4, A3 or Tabloid.                                                                                                |
| **Orientation**                                | **Automatic**, **Portrait** or **Landscape**.                                                                             |
| **Sizing**                                     | **Fit to page** scales each diagram page onto one sheet. **Tile across pages** prints a large page across several sheets. |
| **All diagram pages**                          | On: every page in one PDF. Off: only the current page.                                                                    |
| **Title block (name, author, date, revision)** | Adds a title block to each sheet, with the **Revision** you type.                                                         |

The name and author come from the Inspector's **Diagram** group (select nothing to see it). PDFs
are vector files, so text stays sharp at any zoom.

## CSV tables

Choose the **Table**:

- **Devices (inventory)**: one row per device: hostname, role, vendor, model, platform, OS version,
  serial, asset tag, management IP, site, zone, rack, rack unit, interface count, tags and notes.
- **Interfaces**: one row per interface: device, name, type, state, description, mode, VLANs, IPv4
  and IPv6 addresses, VRF, speed, duplex, media, MTU and MAC address.
- **Links (cabling)**: one row per link: both devices and interfaces, medium, bandwidth, label,
  circuit ID, provider and cable ID.
- **IP plan**: one row per assigned address, grouped by subnet, with the subnet's name, VLAN,
  gateway and utilization. Addresses outside any defined subnet are listed as "(undeclared)".
- **Port map**: every interface with its description, VLAN and the device and interface it
  connects to.

The file is named after the diagram and the table, for example `Campus-devices.csv`.

## Reports

The HTML and Markdown reports contain an image of the current page, the device inventory, the
links, the IP plan, the VLAN table and a validation summary. Untick **Include diagram image of this
page** to leave the image out. The HTML report is one file with no external resources, so it opens
anywhere.

## Topology files

- **draw.io diagram** opens in diagrams.net with positions, labels and links. It exports the current
  page.
- **Containerlab topology** lists each device as a node and each link between `ethN` interfaces.
  Every node starts as `kind: linux` with a placeholder image, and the original interface names are
  kept in comments. Review the node kinds and images before you deploy the lab.
- **Mermaid** and **Graphviz DOT** write the devices and links as text, for documentation that
  lives next to code.

## Printing

**File → Print…** (`Ctrl+P`) renders every page of the diagram in the current view, in light
colors, each with a title block, and opens the system print dialog. To print to a PDF with more
control over paper and tiling, export a PDF instead.

## Other ways to get data out

- The `.lwise` file itself is readable JSON. See the [file format](../file-format.md).
- Copy devices with `Ctrl+C` and paste them into another LineWise diagram.
