# Drawing basics

This page covers moving around the canvas, selecting and arranging objects, and the shapes, zones
and pages that structure a diagram. Shortcuts are written for Windows and Linux; on macOS, use `⌘`
where this page says `Ctrl` and `⌥` for `Alt`.

## Moving around

- **Pan** with the scroll wheel or a two-finger scroll, by dragging with the middle or right mouse
  button, or by holding `Space` and dragging. With nothing selected, the arrow keys pan too (hold
  `Shift` to pan further).
- **Zoom** with `Ctrl` and the wheel, or pinch. Zoom runs from 10% to 400%.
- `Ctrl+=` and `Ctrl+-` zoom in and out, `Ctrl+0` fits the page, and `Ctrl+Shift+0` zooms to the
  selection. The buttons at the bottom left of the canvas zoom in, zoom out and fit.
- The **minimap** shows the whole page. Turn it off with **View → Toggle Minimap** or in
  Preferences.
- Below 40% zoom labels are hidden, and below 25% devices are drawn as plain shapes, so large
  diagrams stay fast.

## Selecting

- Click an object to select it. `Shift`-click or `Ctrl`-click adds to the selection.
- Drag a box on empty canvas to select everything it touches.
- `Ctrl+A` selects everything on the page. `Ctrl+Shift+A` selects every device with the same role
  as the selected ones. **Edit → Select Connected** adds the devices linked to the selection.
- `Esc` clears the selection and any highlight.
- Hover a device to see a summary: hostname, role, model, management IP and how many of its
  interfaces are in use.

## Moving and arranging

- Drag to move. Smart guides appear when a device lines up with another one.
- **Snap to grid** is on by default. Change the grid size, or turn snapping and the grid off, in
  Preferences (`Ctrl+,`).
- Arrow keys nudge the selection by 1 pixel; hold `Shift` to move 10.
- The **Arrange** menu and the toolbar's **Arrange** button align (left, centers, right, top,
  middles, bottom) at least two objects, and distribute at least three horizontally or vertically.
- **Arrange → Bring to Front** (`Ctrl+Shift+]`) and **Send to Back** (`Ctrl+Shift+[`) change the
  stacking order of zones and annotations.
- **Arrange → Group** (`Ctrl+G`) wraps two or more selected devices in a borderless zone named
  "Group" that moves them together. **Ungroup** (`Ctrl+Shift+G`) removes the selected group and
  keeps its contents.
- **Arrange → Lock** (`Ctrl+L`) stops devices, zones and annotations from being moved;
  **Unlock** is `Ctrl+Shift+K`. The Inspector also has a **Locked** checkbox.
- **Edit → Copy Style** (`Ctrl+Alt+C`) and **Paste Style** (`Ctrl+Alt+V`) copy the look of one
  object to others of the same kind: a link's medium, line style and color; a zone's color; an
  annotation's fill, stroke and font size; a device's color tag and label position.

## Copy, paste and undo

- `Ctrl+C`, `Ctrl+X` and `Ctrl+V` copy, cut and paste devices with the links between them, also
  between diagrams. `Ctrl+D` duplicates. Pasted devices get unique hostnames, and their management
  IP, serial number and interface addresses are cleared.
- Pasting Cisco CLI output opens the import dialog with the text filled in.
- `Ctrl+Z` undoes and `Ctrl+Shift+Z` (or `Ctrl+Y`) redoes. One drag, paste, import or layout is
  one undo step. The undo button's tooltip names the step it will undo.

## Auto-layout

**Arrange → Auto-Layout…** (`Ctrl+Shift+L`) arranges devices for you.

| Algorithm                    | Result                                              |
| ---------------------------- | --------------------------------------------------- |
| **Hierarchical, top-down**   | WAN and edge at the top, access and endpoints below |
| **Hierarchical, left-right** | Tiers from left to right                            |
| **Orthogonal**               | Tiered layout with right-angle links                |
| **Force-directed**           | Organic; good for meshes                            |
| **Circular**                 | Devices on a ring                                   |
| **Grid**                     | Rows and columns, grouped by role                   |

**Apply to** chooses the **Whole page** or the selected devices (at least two). **Spacing** runs
from 0.6× to 2×. The layout runs in the background with a **Cancel** button and undoes in one step.

## Zones

Zones group devices into sites, buildings, floors, security zones or cloud VPCs.

- **Insert → Zone** adds a zone in the middle of the view. Drag its corners to resize it.
- Drop a device inside a zone to make it a member. Moving a zone moves the devices, annotations
  and nested zones inside it.
- In the Inspector, set the zone's **Name**, **Kind**, **Inside** (its parent zone), **Width**,
  **Height**, **Color**, **Locked** and **Description**.

## Text, notes, shapes and images

The **Insert** menu adds **Text**, **Sticky Note**, **Rectangle**, **Ellipse**, **Arrow** and
**Image…** (PNG, JPEG or SVG; SVG files are cleaned of scripts). Images are stored inside the
diagram file.

- Double-click text, a note or a shape to edit its text. `Ctrl+Enter` or clicking away finishes;
  `Esc` cancels.
- Drag the corners to resize. The Inspector sets **Font size**, **Fill**, **Stroke**, **Width**,
  **Height**, **Rotation (°)**, **Layer** and **Locked**, plus **Arrowhead** for arrows and **Alt
  text** for images.

## Layers

The **Layers** tab in the sidebar holds annotation layers. **Add layer**, then put notes, shapes and
images on it with the **Layer** field in the Inspector. Each layer can be hidden, locked, renamed,
moved up or down, or deleted. Devices and links are not on layers; the network views are described
in [Views](views.md).

## Pages

A diagram can have several pages, shown as tabs below the canvas.

- **+** at the end of the page tabs, or **Insert → New Page**, adds a page.
- Double-click a page tab or press `F2` to rename it. Drag tabs to reorder them.
- Deleting a page asks first. Devices placed only on that page are deleted too; you can undo this.
- Each device lives on one page. To show a link to a device on another page, add an off-page
  connector: open the **Outline** tab, find the device under **On other pages** and choose **Add
  connector**. Links to that device then end at the connector. Double-click a connector to jump to
  the device.

## Find and the command palette

- `Ctrl+F` opens **Find**. It searches every page: device hostnames, management IPs, models,
  serials, asset tags, sites and tags; interface names, descriptions and addresses; link labels,
  cable IDs, circuit IDs and providers; zone names; and annotation text. Type `vlan 10` (or just
  `10`) to find a VLAN. `Enter` goes to the next hit, `Shift+Enter` to the previous one, and `Esc`
  closes Find. Going to a device selects it; going to a VLAN highlights it in the data link view.
- `Ctrl+K` opens the command palette. Type part of a command, a hostname or an IP address and press
  `Enter`.

## Presentation mode

`F5` hides the toolbar and panels and shows the diagram full screen. `Page Down`, `Page Up` and
`Space` step through the pages; `Esc` or `F5` leaves.
