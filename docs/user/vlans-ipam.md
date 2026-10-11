# VLANs and IPAM

VLANs, subnets, VRFs and addresses are part of the LineWise model, not just text on the drawing.
The **Network** menu holds the tools for them: **VLAN Manager…**, **Subnets & IPAM…** and
**Subnet Calculator…**. They are also in the command palette (`Ctrl+K`; `⌘K` on macOS).

## VLANs

**Network → VLAN Manager…** opens the **VLANs** dialog.

- Type a **VLAN ID or range** and an optional **Name**, then **Add VLAN**. A list such as
  `100-110,200` adds several VLANs at once, up to 512 at a time, as one undo step; a name given
  with a range becomes a prefix (`Users 101`, `Users 102`, …). VLAN IDs are 1–4094.
- Each VLAN gets a color. The color is used for access links in the data link (L2) view.
- Edit the **Name**, **Color** and **Description** in the table. **Used on** shows how many ports
  on how many devices carry the VLAN; expand it to see them.
- The eye button closes the dialog and highlights the VLAN on the canvas. The trash button
  deletes the VLAN.
- If ports use VLANs that are not defined, the dialog lists them under **Used on ports but not
  defined** with an **Add them** button.

Deleting a VLAN does not change the ports that use it; [validation](validation.md) then reports
them.

### Putting ports in VLANs

VLANs are set per interface in the [Inspector](devices.md#interfaces):

- **Access** ports have an **Access VLAN** (1 when empty).
- **Trunk** ports have **Allowed VLANs** in Cisco list syntax, such as `10,20,30-39` (empty means
  all) and a **Native VLAN** (1 when empty).
- **Bundle as port-channel** groups member ports. Members should have the same mode, VLANs and
  speed; validation checks this.

### Highlighting a VLAN

Pick a VLAN in the toolbar's **Highlight VLAN** list (it shows **VLAN: none** when off), or use the
highlight button in the VLANs dialog. LineWise highlights every device, port and link that carries
the VLAN and dims the rest. The status bar shows **Highlighting VLAN 10**. Choose **VLAN: none** or
press `Esc` to clear it.

## Subnets

**Network → Subnets & IPAM…** opens the **Subnets and IPAM** dialog. Its **Subnets** tab is the IP
plan.

- Enter a **Subnet** (`10.10.20.0/24` or `2001:db8:10::/64`), an optional **Name**, **VLAN**,
  **VRF** and **Gateway**, then **Add**.
- The table shows each subnet's name, VLAN and gateway (all editable), the **Next free** address
  (or "full") and how much of it is **Used**.
- Subnets that overlap another subnet in the same VRF are marked **overlap**.

Usage counts the addresses on interfaces, management IPs, FHRP virtual IPs and the gateway.
Addresses are matched to subnets by prefix, so typing `10.10.20.5/24` on an interface counts toward
`10.10.20.0/24` without any extra step.

### Assigning the next free address

When the diagram has IPv4 subnets, each interface editor in the Inspector has a **Next free** row.
Pick the subnet under **From subnet** and click **Assign**. LineWise picks the first usable address
that no interface uses, skipping the gateway.

## VLSM planner

The **VLSM planner** tab carves a block into subnets sized for host counts.

1. Enter an **Address block**, an IPv4 block such as `10.20.0.0/22`.
2. Add a row per requirement with a **Name** and the number of **Hosts**. **Add requirement** adds
   a row; the trash button removes one.
3. The **Subnet** column fills in as you type. Larger requirements are placed first. If the block
   is too small, the planner says so.
4. **Create these subnets** adds them all to the IP plan.

## Point-to-point links

The **Point-to-point** tab lists every link between two routed devices (routers, L3 switches,
firewalls and VPN concentrators) with the addresses on each end.

1. Set the **Pool**, for example `10.255.0.0/24`, and the **Size**, `/30` or `/31`.
2. Click **Assign /30** on a link, or **Renumber** on a link that already has addresses.

LineWise takes the next free subnet in the pool, gives one address to each end and adds the subnet
to the IP plan, named after the two hostnames. Each assignment is one undo step. The same helper
appears in the Inspector when you select such a link.

## VRFs

The **VRFs** tab adds a VRF by **VRF name** and an optional route distinguisher (**RD**, such as
`65000:10`). The list shows how many interfaces use each VRF. Put an interface in a VRF with its
**VRF** field; subnets have a VRF too. Deleting a VRF moves its interfaces and subnets back to the
global routing table. With no VRFs, everything is in the global table.

Duplicate addresses and overlapping subnets are checked per VRF, so the same subnet can appear in
two VRFs.

## Subnet calculator

**Network → Subnet Calculator…** works out a subnet from an address and a prefix or mask:
`10.0.0.5/24`, `10.0.0.5 255.255.255.0` or `2001:db8::/48`.

It shows the **Network**, **Mask**, **Wildcard**, **Broadcast**, **First usable**, **Last usable**,
**Usable hosts** and **Addresses**. For IPv4 it also shows the prefix as a dotted mask.

**Split into equal subnets** divides the subnet into the number of parts you type. The number is
rounded up to a power of two, up to 256.
