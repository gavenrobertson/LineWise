# Importing from Cisco CLI

LineWise builds diagrams from text you have already captured: `show` command output, running
configurations, CSV files and a few other diagram and lab formats. It reads text only. LineWise
never connects to your devices or runs commands on them, and config text is parsed, never
executed. Shortcuts are written for Windows and Linux; on macOS, use `⌘` where this page says
`Ctrl`.

## Opening the import dialog

- **File → Import…** (`Ctrl+I`), or the import button on the toolbar.
- **Import from CLI output…** on the welcome screen.
- Paste CLI output on the canvas with `Ctrl+V`: LineWise recognizes it and opens the import dialog
  with the text already added.

## Adding sources

The **Import network data** dialog collects any number of sources, from many devices at once.

- Paste text into the box and choose **Add pasted text**. Fill in **Captured on** first if the text
  has no prompt (see below).
- Or choose **Choose files…** and pick one or more files (`.txt`, `.log`, `.cfg`, `.conf`, `.csv`,
  `.tsv`, `.drawio`, `.xml`, `.gns3`, `.yml`, `.yaml`, `.json`, or **All files**). Files larger than
  20 MB are skipped.

Each source is listed under **Sources** with its **Source type**, detected automatically
(**Auto: CDP neighbors**, for example). If LineWise could not tell what a source is, or guessed
wrong, choose the type yourself. The trash button removes a source.

### Which device the output came from

Neighbor and interface tables do not name the device they were captured on. LineWise takes the
hostname from the CLI prompt in the text, such as `SW1#show cdp neighbors detail`. If the text has
no prompt, type the hostname in the source's **Captured on** field. Running configurations carry
their own `hostname` line.

## Cisco CLI output

| Command                                                        | What LineWise reads                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `show cdp neighbors detail`                                    | Neighbor devices with their platform, address and a role guessed from their capabilities, and a link for each neighbor.                                                                                                                                                  |
| `show lldp neighbors detail`                                   | The same from LLDP. Linux `lldpctl` output works too.                                                                                                                                                                                                                    |
| `show running-config`                                          | Hostname, interfaces (description, shutdown, switchport mode and VLANs, IPv4 and IPv6 addresses, VRF, channel-group, HSRP, VRRP and GLBP, speed, duplex, 802.1Q tag, MTU), VLANs and names, VRFs and route distinguishers, and routing processes as routing annotations. |
| `show ip interface brief`                                      | Interfaces and whether they are up. This output has no subnet masks, so addresses are not imported; import the running-config for them.                                                                                                                                  |
| `show interfaces status`                                       | Interfaces with their access VLAN, trunk or routed state, duplex, speed and media.                                                                                                                                                                                       |
| `show vlan brief`                                              | VLAN numbers and names, and which ports are in each VLAN.                                                                                                                                                                                                                |
| `show etherchannel summary`, NX-OS `show port-channel summary` | Port-channels and their member ports.                                                                                                                                                                                                                                    |

IOS, IOS-XE and NX-OS output are supported. Interface names are normalized, so `Gi1/0/1` in one
output and `GigabitEthernet1/0/1` in another are the same port.

## Other formats

| Format                    | What LineWise reads                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **CSV**                   | Devices, interfaces and links from a spreadsheet. See [CSV columns](#csv-columns).                                |
| **draw.io diagram**       | Network shapes as devices and connectors as links, with their positions. Other labeled shapes become annotations. |
| **GNS3 project**          | Nodes, their positions and links from a `.gns3` file.                                                             |
| **Containerlab topology** | Nodes and links from a `.clab.yml` file.                                                                          |
| **Nmap scan**             | Hosts that were up in an Nmap XML file you already have. LineWise does not scan the network.                      |

### CSV columns

For a CSV source, LineWise shows each column with a field to map it to. It guesses from the header
names (`hostname`, `mgmt ip`, `interface`, `from`, `to` and so on); change any column that is wrong,
or set it to `ignore`. The fields are `hostname`, `role`, `vendor`, `model`, `mgmtIp`, `site`,
`serial`, `interface`, `description`, `ip`, `prefix`, `vlan`, `mode`, `deviceA`, `interfaceA`,
`deviceB`, `interfaceB`, `medium` and `label`. Rows with `deviceA` and `deviceB` become links.

## Reviewing the import

Choose **Review**. Nothing changes until you apply.

- The summary shows the number of new devices, updates to existing devices, new links, conflicts,
  VLANs and VRFs.
- **Devices** lists every device, marked **new** or **update**, with what will change. Untick a
  device to leave it out, or use **Select all** / **Select none**.
- **Links** lists every link. A link already in the diagram is marked **exists**. A link whose
  interface is already linked to something else is marked **conflict**. Both start unticked.
- Lines that were not understood are counted ("12 lines were not understood and were skipped") and
  can be expanded. Warnings from the parsers are listed too.

**Place on** chooses **This page** or a **New page** named "Imported". Then choose **Apply import**.
New devices are laid out automatically (top-down hierarchy); **Cancel layout** stops before
anything is applied. On **This page**, new devices go below the existing devices they connect to,
or to the right of the drawing when they connect to nothing there. The whole import is one undo
step.

## How merging works

- Sources are combined first. A device seen in several files (its config, and a neighbor's CDP
  output) becomes one device, and a link seen from both ends becomes one link.
- An imported device matches an existing one by hostname (ignoring case), then by serial number,
  then by management IP.
- For a matched device, imported details such as model, serial and management IP fill only fields
  that are empty. Interfaces are matched by name; the imported settings of an interface replace
  the old ones, and new interfaces are added.

## Secrets

Lines that may carry secrets are dropped while the text is read: passwords, enable secrets, keys,
SNMP communities, pre-shared keys and similar. They never reach the diagram, not even the list of
lines that were not understood. LineWise never stores device credentials.
