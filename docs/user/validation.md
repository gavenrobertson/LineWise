# Validation

LineWise checks the network model as you work: addresses, subnets, VLANs, trunks, port-channels
and cabling. Findings appear in the **Problems** panel and as badges on the canvas. The checks run in
the background a moment after each change, so they never block editing.

## The Problems panel

Open it with `Ctrl+Shift+M` (`⌘⇧M` on macOS), the toolbar button, or the error and warning counts
in the status bar. **Network → Validate Now** runs the checks at once and opens the panel.

- The three severity buttons (errors, warnings, information) show a count each. Click one to hide
  or show that severity.
- The **Rule filter** list shows the findings of one rule.
- Click a finding to select the devices and links involved. If they are on another page, LineWise
  switches to it.
- A finding with a quick fix has a button such as **Set both ends to trunk**. A fix is one change
  you can undo.

On the canvas, devices and links with findings show a badge: ✕ for errors, ▲ for warnings and i
for information. Turn the badges off with **View → Toggle Problem Badges**.

## Rules

| Rule    | Severity | Title                                 | What it checks                                                                                                                                                        | Quick fix                                                    |
| ------- | -------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| VAL-001 | Error    | Duplicate IP address                  | The same IPv4 or IPv6 address on more than one interface in the same VRF.                                                                                             |                                                              |
| VAL-002 | Error    | Link endpoints in different subnets   | The primary IPv4 addresses at the two ends of a link are not in the same subnet.                                                                                      | Set the second end to the next address after the first end's |
| VAL-003 | Error    | Invalid interface address             | An address that is not valid, or an IPv4 address that is the network or broadcast address of its subnet.                                                              |                                                              |
| VAL-004 | Error    | Overlapping subnets                   | Two subnets in the IP plan overlap in the same VRF.                                                                                                                   |                                                              |
| VAL-005 | Error    | Interface used by more than one link  | An interface with two or more links. Links with the **Virtual or tunnel** medium do not count.                                                                        |                                                              |
| VAL-006 | Warning  | Duplicate hostname                    | Two or more devices with the same hostname, ignoring case.                                                                                                            |                                                              |
| VAL-007 | Warning  | Trunk on one end, access on the other | A link with a trunk port at one end and an access port at the other.                                                                                                  | Set both ends to trunk                                       |
| VAL-008 | Warning  | Native VLAN mismatch                  | A trunk link whose ends have different native VLANs (empty counts as 1).                                                                                              | Use the first end's native VLAN on both                      |
| VAL-009 | Warning  | Allowed VLANs differ across a trunk   | A trunk link whose ends allow different VLANs.                                                                                                                        | Allow the combined list on both ends                         |
| VAL-010 | Warning  | Access VLAN mismatch                  | An access link whose ends are in different VLANs.                                                                                                                     | Put the second end in the first end's VLAN                   |
| VAL-011 | Warning  | Speed or duplex mismatch              | Both ends set a speed and the speeds differ, or both set a duplex other than auto and they differ.                                                                    |                                                              |
| VAL-012 | Warning  | Inconsistent port-channel members     | Members of one port-channel differ in mode, VLANs or speed, or connect to different neighbors.                                                                        |                                                              |
| VAL-013 | Warning  | Reference to a missing VLAN or VRF    | An interface in a VRF that does not exist. Once any VLAN is defined: an access VLAN, native VLAN or VLAN interface number that is not defined (VLAN 1 always exists). | Create the VLAN                                              |
| VAL-014 | Warning  | Gateway problem                       | A subnet's gateway is outside the subnet, or no interface address or FHRP virtual IP owns it.                                                                         |                                                              |
| VAL-015 | Warning  | FHRP group mismatch                   | Interfaces with HSRP, VRRP or GLBP in the same subnet use different virtual IPs, protocols or group numbers, or the virtual IP is outside the subnet.                 |                                                              |
| VAL-016 | Info     | Device with no links                  | A device that is not linked to anything.                                                                                                                              |                                                              |
| VAL-017 | Info     | Addressed interface without a link    | An enabled physical interface with an address but no link and no port-channel.                                                                                        |                                                              |
| VAL-018 | Info     | Subnet over 90% utilized              | An IPv4 subnet in the IP plan with more than 90% of its addresses in use.                                                                                             |                                                              |
| VAL-019 | Info     | Device missing management IP          | A router, switch, firewall, wireless LAN controller, access point, load balancer, VPN concentrator or IDS/IPS without a **Mgmt IP**.                                  |                                                              |
| VAL-020 | Info     | Media mismatch                        | A fiber port linked to a copper port.                                                                                                                                 |                                                              |

## Suppressing a finding

Some findings are intended, for example a lab device with no management IP. To hide one:

1. Hover the finding and choose **Suppress…**.
2. Type a **Reason** ("Why is this OK?") and choose **Suppress**. With no reason, LineWise records
   "No reason given".

The suppression and its reason are saved in the diagram, so everyone who opens the file sees the
same list. It applies to that rule and those exact objects; a new finding of the same rule still
shows. Click **Suppressed** in the panel to see suppressed findings, and **Unsuppress** to bring one
back.

## Turning a rule off

A diagram can turn rules off completely. LineWise skips every rule whose ID is listed in the
diagram's `settings.disabledRules`, for example `"disabledRules": ["VAL-016", "VAL-019"]`. The app
has no control for this list; edit it in the `.lwise` file, which is plain JSON (see the
[file format](../file-format.md#settings)). To hide a rule only while you look at the panel, use
the **Rule filter** or the severity buttons instead.

## Read-only diagrams

A diagram opened read-only (saved by a newer version) is still checked, but quick fixes and
suppression are not offered.
