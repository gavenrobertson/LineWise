# Devices and interfaces

Every device in LineWise has a role, details such as model and management IP, and a list of real
interfaces. Links join interfaces, and VLANs and addresses live on interfaces, so most of the model
is edited here. Shortcuts are written for Windows and Linux; on macOS, use `⌘` where this page says
`Ctrl`.

## Adding devices

- Drag a template from the **Library** tab onto the canvas. Drop it on an existing link to insert
  the device in the middle of that link: the link is split into two through the new device.
- Or press `Ctrl+Shift+D`, type part of a name, model, role or vendor and press `Enter` to place
  the best match in the middle of the view. `Down arrow` moves into the result list.
- Star a template to add it to **Favorites**. Templates you used lately appear under **Recently
  used**.

New devices get a hostname from their role, such as `R1`, `SW2` or `FW1`. The built-in templates
are generic devices (routers, switches, firewalls, servers, clouds and so on) with a typical port
layout. All device icons are original LineWise icons.

## Device details

Select a device to edit it in the **Inspector**. Select several devices to change a field on all
of them at once; fields that differ show as mixed.

| Field                                               | Notes                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| **Hostname**                                        | Letters, digits, dot, dash and underscore; up to 63 characters.         |
| **Role**                                            | Picks the icon and which checks apply, for example router or L2 switch. |
| **Vendor**, **Model**, **Platform**, **OS version** | Free text.                                                              |
| **Mgmt IP**                                         | Must be a valid IPv4 or IPv6 address.                                   |
| **Serial**, **Asset tag**                           | Free text.                                                              |
| **Site**, **Rack**, **Rack unit**                   | Location. Rack unit is 1 to 60.                                         |
| **Zone**                                            | The zone the device belongs to.                                         |
| **Tags**                                            | Comma-separated, for example `core, prod`.                              |
| **Icon**                                            | The role's icon, another built-in icon, or one from an icon pack.       |
| **Color tag**                                       | A colored mark on the icon.                                             |
| **Locked**                                          | Stops the device from being moved.                                      |
| **Label**                                           | Puts the label **Below**, **Above**, **Left** or **Right** of the icon. |
| **Notes**                                           | Free text. A device with notes shows a note mark.                       |

With one device selected, pressing `Enter` on the canvas jumps to the **Hostname** field.

The icon also shows marks for problems found by [validation](validation.md), notes, locking and
the color tag.

## Routing annotations

The **Routing** group lists the routing a device takes part in, such as `OSPF area 0` or
`BGP 65001`. Click **+** (**Add routing annotation**), pick the **Protocol** (OSPF, EIGRP, BGP,
ISIS, RIP or STATIC) and type a **Value**. These show as badges with the device label in the
network (L3) view. They are labels only; LineWise does not simulate routing.

## Interfaces

With one device selected, the **Interfaces** group lists its ports, sorted naturally (`Gi1/0/2`
before `Gi1/0/10`). Each row shows the name, a summary of its configuration (access VLAN, trunk
VLANs or address) and what it connects to. A dot marks the state: connected, free or shut down.
Click the peer to select that link.

- **Add interfaces** by typing a name or a range in the box at the top and pressing `Enter`, for
  example `Gi1/0/1-24` or `Gi1/0/1-4, Te1/1/1-2`. Short names expand to full names
  (`gi0/1` becomes `GigabitEthernet0/1`), and names that already exist are skipped.
- **Filter interfaces** appears on devices with more than 8 interfaces.
- Tick the checkboxes of two or more ports and choose **Bundle as port-channel** to create the next
  `Port-channelN` with those members. The trash button deletes the ticked interfaces.

Click an interface name to open its editor:

| Field                                  | Notes                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Name**, **Enabled**, **Description** | **Enabled** off means shut down.                                                                                  |
| **Mode**                               | **Not set**, **Access**, **Trunk** or **Routed**.                                                                 |
| **Access VLAN**                        | Access ports only, 1 to 4094.                                                                                     |
| **Allowed VLANs**, **Native VLAN**     | Trunks only. Allowed VLANs use Cisco list syntax, such as `10,20,30-39`; empty means all.                         |
| **IPv4**, **IPv6**                     | Address with prefix, such as `10.0.0.1/24` or `2001:db8::1/64`. IPv4 also takes a mask: `10.0.0.1 255.255.255.0`. |
| **Next free**                          | Picks the next free address from a subnet you defined. See [VLANs and IPAM](vlans-ipam.md).                       |
| **Speed (Mb/s)**, **Duplex**, **MTU**  | Duplex is **Auto**, **Full** or **Half**.                                                                         |
| **Type**                               | The interface type, such as `gigabitethernet`, `serial`, `loopback`, `vlan`, `tunnel` or `subinterface`.          |
| **Media**                              | **Any**, **Copper** or **Fiber / SFP**.                                                                           |
| **VRF**                                | **Global** or a VRF you defined.                                                                                  |
| **PoE**                                | Whether the port supplies power.                                                                                  |
| **FHRP**                               | **HSRP**, **VRRP** or **GLBP**, with its **Group** and **Virtual IP**.                                            |

Typing an address on an interface whose mode is **Not set** makes it **Routed**. Under the IPv4
field, LineWise shows which defined subnet the address falls in.

Loopbacks, VLAN interfaces, sub-interfaces and port-channels are logical: they cannot be cabled.
Tunnel interfaces take virtual links only. See [Links](links.md).

## Device templates

Choose **New device template…** (the **+** at the top of the Library) to make your own template.

1. **Start from** a **Blank template** or copy an existing one.
2. Enter a **Name**, **Vendor**, **Model**, **Role and icon**, **Platform** and **OS version**.
   **Datasheet URL** records where the port layout comes from.
3. Under **Interfaces**, add port groups. Each group has a **Name or range** (for example
   `Gi1/0/1-48`, `Te1/1/1-4` or `Ethernet1/1-32`), a **Type** (or **From name**), a speed in Mb/s
   and **Media**.
4. Choose **Save to library**.

Your templates are marked "custom" in the Library and have an **Edit template** button. The editor
can also **Import JSON…** and **Export JSON…** to share a template, and **Delete** one.

## Icon packs

To use your own icons, open Preferences (`Ctrl+,`) and choose **Import…** under **Icon packs**.
A pack is a `.zip` or a set of SVG or PNG files, with an optional `manifest.json`. SVG files are
cleaned of scripts when they are imported. Then pick a pack icon with the **Icon** field in the
Inspector.

With **Embed pack icons in diagrams** on (the default), pack icons are stored in the `.lwise` file, so the diagram looks the same on a computer without the pack. If a diagram uses pack
icons that are not installed and not embedded, LineWise shows built-in icons and says so.

## Labels and display

With nothing selected, the Inspector's **Display** group applies to the whole diagram:

- **Icons**: **Classic (filled)** or **Line (print)**.
- **Label**: the device label template. Use the fields `{hostname}`, `{model}`, `{mgmtIp}`,
  `{site}` and `{role}`, for example `{hostname}\n{mgmtIp}`.
- **Links**: the default line style for links.
- **Show interface names**, **Show IP addresses** and **Show VLANs**: show these at the link ends in every view.
