# Links

A link in LineWise always joins two interfaces, one on each device. That is what lets LineWise
check both ends of a cable and export a cabling list. Shortcuts are written for Windows and Linux;
on macOS, use `⌘` where this page says `Ctrl`.

## Drawing a link

1. Hover a device. Four handles appear around its icon.
2. Drag from a handle and drop on another device.
3. The **Connect** dialog opens. For each end, pick a **Port**. Type in the filter box to narrow
   the list: `gi1/0/7`, `Gi1/0/7` and `GigabitEthernet1/0/7` all match.
4. Check the **Medium** and choose **Connect**.

From the keyboard: select or focus a device and press `L`. Type the name of the other device,
press `Enter` to pick it, then `Enter` again to connect with the suggested ports.

## Choosing ports

The port list puts **Free** ports first, then **In use** ports. It offers:

- **Next free port**, the default: the first free physical port. A device with no free port, such
  as a cloud, gets a new one.
- **New interface…**: type an **Interface name** to create a port on the spot.
- **Multipoint tunnels**: tunnel interfaces that already have links, so one DMVPN or mGRE tunnel can
  reach many peers.

An interface can carry only one physical link. Loopbacks, VLAN interfaces, sub-interfaces and
port-channels cannot be cabled. Tunnel interfaces take only links with the **Virtual or tunnel**
medium.

## Medium

The dialog suggests a medium from the ports you picked: serial for serial ports, virtual for
tunnels, multimode fiber when either port is fiber, and copper otherwise. Choose another to
override it.

| Medium                 | Drawn as                      |
| ---------------------- | ----------------------------- |
| **Copper**             | Solid line                    |
| **Fiber, single-mode** | Solid line in the fiber color |
| **Fiber, multimode**   | Solid line in the fiber color |
| **Serial**             | Line with a zigzag            |
| **Wireless**           | Dashed line                   |
| **Virtual or tunnel**  | Dotted line                   |
| **Console**            | Thin dashed line              |

Trunk links are drawn thicker in the physical and data link views. Links in a port-channel get a
bundle mark. Several links between the same two devices fan out on their own.

## Editing a link

Select a link to edit it in the **Inspector**. The top of the group shows both ends, device and
interface.

| Field                        | Notes                                                            |
| ---------------------------- | ---------------------------------------------------------------- |
| **Medium**                   | See the table above.                                             |
| **Bandwidth (Mb/s)**         | Shown in the middle of the link with the label.                  |
| **Label**                    | Shown in the middle of the link.                                 |
| **Cable ID**                 | For the cabling list.                                            |
| **Circuit ID**, **Provider** | For WAN circuits.                                                |
| **Line style**               | **Straight**, **Orthogonal**, **Curved** or **Diagram default**. |
| **Color**                    | Overrides the medium's color.                                    |

Select several links to change them together. To change the ports a link uses, delete it and draw
it again.

## Line styles and bend points

- Links follow the diagram's default line style unless you set **Line style** on them. Set the
  default in the Inspector's **Display** group when nothing is selected. Preferences sets the **Default link style** for new diagrams.
- Orthogonal links route around other devices and keep apart from links that share their path.
- **Double-click a link** to add a bend point where you clicked. Drag a bend point to move it, and
  double-click it to remove it. A link with bend points is drawn as straight segments through
  them.
- Without a mouse, use the bend fields in the Inspector: **Add bend point**, then edit **Bend 1 X**
  and **Bend 1 Y**. **Remove bend points** clears them all.

## Labels at the link ends

Each end of a link can show the interface name, its address and its VLANs. Which ones appear
depends on the [view](views.md): interface names in the physical view, VLANs in the data link view
and addresses in the network view. Turn on **Show interface names**, **Show IP addresses** or
**Show VLANs** in the **Display** group to show them in every view. **Interface names** chooses
short names (`Gi1/0/1`) or long ones (`GigabitEthernet1/0/1`).

What both ends share is written once, in the label in the middle of the link:

| View           | Middle label                                                       | Example                    |
| -------------- | ------------------------------------------------------------------ | -------------------------- |
| Physical (L1)  | The link's label, its speed, and the medium unless it is copper    | `10G · fiber`              |
| Data link (L2) | The access VLAN, or the trunk's VLAN list (first three, then `+N`) | `trunk ●10, ●20, ●99`      |
| Network (L3)   | The subnet; each end then shows its host part                      | `10.0.12.0/30`, `.1`, `.2` |

Each VLAN number has a dot in its VLAN color. When the ends differ (an access VLAN mismatch, a
trunk on one side only), each end keeps its own VLANs, so the difference is visible.

Labels are placed so they do not cover each other, devices or hostnames: an interface label moves
along its link, or just beside it, until it finds a free spot. Below 75% zoom labels stop
shrinking, so they stay readable, and above 150% they stop growing; below 40% they are hidden.

Hover over a link, or Tab to it, to see its details: both ends, the medium, speed and duplex, the
mode and VLANs, the addresses, and any problems with a button that applies the fix.

## Inserting a device into a link

Drag a template from the Library and drop it on a link. The link is replaced by two links through
the new device, with the same medium, using its next free ports.

## Point-to-point addressing

When both ends of a link are routers, L3 switches, firewalls or VPN concentrators, the Inspector
shows **Point-to-point addressing**. Enter a **Pool** such as `10.255.0.0/24`, choose `/30` or
`/31` and click **Assign /30** (or **Assign /31**). LineWise takes the next free subnet from the pool, numbers both ends and
records the subnet, as one undo step. See [VLANs and IPAM](vlans-ipam.md#point-to-point-links).

## Highlighting a path

Click **Highlight path between two devices** on the toolbar, then click the first and the second
device. LineWise highlights the shortest path by hop count and dims the rest; the status bar shows
the number of hops, or **No physical path**. `Esc` cancels while you pick; click the button again
(or press `Esc`) to clear the highlight.
