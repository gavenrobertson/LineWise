# FAQ

## Does LineWise need an internet connection?

No. LineWise works fully offline. The only network request it makes is the update check, at most
once a day, which you can turn off with **Check for updates automatically** in Preferences. It
sends no telemetry and no crash reports. See [PRIVACY.md](../../PRIVACY.md).

## Can LineWise discover my network or log in to my devices?

No. LineWise never connects to your devices, runs commands on them or stores credentials. Run the
`show` commands yourself and import the output; see [Importing from Cisco CLI](import.md). LineWise
also does not push configuration or simulate traffic or routing.

## Are passwords from my configs kept?

No. When you import a running-config, lines that may carry secrets (passwords, enable secrets, keys,
SNMP communities and similar) are dropped while the text is read. They never reach the diagram.

## Which files can I import?

Cisco CLI output (`show cdp neighbors detail`, `show lldp neighbors detail`, `show running-config`,
`show ip interface brief`, `show interfaces status`, `show vlan brief`, `show etherchannel
summary`), CSV, draw.io diagrams, GNS3 projects, Containerlab topologies and Nmap XML. Packet
Tracer `.pkt` files and Visio files are not supported.

## What is in a `.lwise` file?

Plain JSON with the whole model (devices, interfaces, links, VLANs, subnets, zones) and the drawing.
Keys are sorted, so an unchanged diagram saves to the same bytes and changes show up cleanly in
Git. Images and embedded icons are stored inside the file. See the [file format](../file-format.md).

## LineWise crashed. Is my work lost?

Probably not. LineWise writes a recovery copy of unsaved diagrams every 60 seconds and when the
window loses focus. After a restart, the welcome screen lists them under **Recovered work**. Each
save also keeps the previous version as `<name>.lwise.bak`. See
[Getting started](getting-started.md#recovery-copies).

## Why is a device missing in the network (L3) view?

The L3 view leaves out layer 2 devices: L2 switches, access points and patch panels without an IPv4
address on a port other than a VLAN interface. Switch to the physical view (`Ctrl+1`, `⌘1` on
macOS) to see every device. See [Views](views.md).

## Why can't I cable a loopback or VLAN interface?

Loopbacks, VLAN interfaces, sub-interfaces and port-channels are logical interfaces, so they cannot
take a cable. Link the physical ports instead, and bundle them as a port-channel if needed. Tunnel
interfaces take virtual links only. See [Links](links.md#choosing-ports).

## Can one port have more than one link?

Not for physical links: validation reports a port with two cables as an error. A tunnel interface
can have many virtual links, for DMVPN or mGRE hubs.

## How do I get rid of a warning that is intended?

Suppress it from the Problems panel with **Suppress…** and a reason; the reason is saved in the
diagram. To turn a rule off for a whole diagram, add its ID to `settings.disabledRules` in the
file. See [Validation](validation.md).

## Can I use my own icons?

Yes. Import an icon pack (a `.zip` or a set of SVG or PNG files) under **Icon packs** in
Preferences, then pick an icon with the **Icon** field in the Inspector. The built-in icons are
LineWise's own. See [Devices and interfaces](devices.md#icon-packs).

## Why does a diagram open read-only?

It was saved by a newer version of LineWise. You can look at it and export it. Use **Save As** to
keep a copy in your version's format, or update LineWise with **Help → Check for Updates…**.

## Can several people edit one diagram at the same time?

No. There is no shared editing or cloud sync. Keep the `.lwise` file in a shared folder or in Git;
its sorted, stable format makes changes easy to review.

## Where are the logs?

**Help → Open Logs Folder** opens them. Logs record events, never diagram contents. If LineWise
shows the **Something went wrong** screen, **Copy diagnostics** copies details to the clipboard so
you can include them in a bug report; nothing is uploaded.
