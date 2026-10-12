# Views

One LineWise model shows three ways. The views share the same devices and positions; they change
what links look like and which details appear. Switching views never changes the diagram and is not
an undo step.

## Switching views

Use the **L1 / L2 / L3** switch on the toolbar, the **View** menu, the **Network views** list in
the sidebar's **Layers** tab, or the shortcuts:

| View               | Shortcut | Shows                                       |
| ------------------ | -------- | ------------------------------------------- |
| **Physical (L1)**  | `Ctrl+1` | All links, media styles and interface names |
| **Data link (L2)** | `Ctrl+2` | VLAN colors, trunks and port-channels       |
| **Network (L3)**   | `Ctrl+3` | Routed devices, IPs and routing badges      |

On macOS the shortcuts are `⌘1`, `⌘2` and `⌘3`.

## Physical (L1)

- Every link, drawn by medium: copper, fiber, serial, wireless, virtual or console. See
  [Links](links.md#medium).
- The interface name at each end of a link.
- Trunk links are drawn thicker.

## Data link (L2)

- Access links take the color of their VLAN, set in the [VLAN manager](vlans-ipam.md#vlans).
  Trunks are drawn thicker in the text color. A color you set on a link yourself always wins.
- The VLAN at each link end: `VLAN 10` for an access port, `trunk 10,20` (or `trunk all`) for a
  trunk.
- Port-channel members get a bundle mark (this mark shows in every view).

## Network (L3)

- The IPv4 address and prefix at each link end.
- Routing annotations, such as `OSPF area 0`, as badges with the device label. Add them in the
  Inspector's **Routing** group (see [Devices and interfaces](devices.md#routing-annotations)).
- Layer 2 devices are left out: L2 switches, access points and patch panels are hidden unless they
  have an IPv4 address on a port other than a VLAN interface. Links to hidden devices are hidden
  with them.

## Showing details in every view

With nothing selected, the Inspector's **Display** group has **Show interface names**, **Show IP addresses** and
**Show VLANs**. Turn one on to show that detail at the link ends in all three views.

## Highlights

Two highlights work in any view and dim everything else:

- **Highlight VLAN** on the toolbar shows everything that carries one VLAN. See
  [VLANs and IPAM](vlans-ipam.md#highlighting-a-vlan).
- **Highlight path between two devices** shows the shortest path between two devices. See
  [Links](links.md#highlighting-a-path).

`Esc` clears a highlight.

## Problem badges

Devices and links with problems show a badge with a severity mark: ✕ for errors, ▲ for warnings
and i for information. Turn badges off with **View → Toggle Problem Badges** or **Show problem
badges on the canvas** in Preferences; the Problems panel still lists everything. See
[Validation](validation.md).

## Views in exports

Image and PDF exports and printing use the view that is showing when you export. Switch to the
view you want first. See [Exporting](export.md).
