// SPDX-License-Identifier: Apache-2.0
/**
 * Help in context (FR-UX-10): short explanations of the networking ideas the inspector asks about,
 * each with why it matters, a tiny example and the user-guide page that says more. Everything is
 * bundled and translated; only "Learn more" goes online, and only when the user asks.
 */
import i18n from '../i18n/index.ts';

const t = (key: string, defaultValue: string) => i18n.t(key, { defaultValue });

export interface HelpTopic {
  title: string;
  what: string;
  why: string;
  example?: string;
  /** User-guide page and section, relative to the docs site. */
  doc: string;
}

export type HelpId = 'interfaces' | 'routing' | 'link' | 'display' | 'zone' | 'problems' | 'subnets';

export function helpTopic(id: HelpId): HelpTopic {
  switch (id) {
    case 'interfaces':
      return {
        title: t('help.interfaces.title', 'Interfaces and modes'),
        what: t(
          'help.interfaces.what',
          'Each row is a port. Its mode says what it carries: access carries one VLAN, untagged, for a PC or printer; trunk carries many VLANs, tagged, between switches; routed is an IP interface on a router or L3 switch.',
        ),
        why: t(
          'help.interfaces.why',
          'Both ends of a link must agree on mode and VLANs, or traffic is dropped. The Problems panel checks this for you.',
        ),
        example: t('help.interfaces.example', 'Gi1/0/1 · access · VLAN 20    Te1/1/1 · trunk · 10,20,99'),
        doc: 'user/devices#interfaces',
      };
    case 'routing':
      return {
        title: t('help.routing.title', 'Routing annotations'),
        what: t(
          'help.routing.what',
          'Notes about the routing a device runs, such as an OSPF area or a BGP AS number. They appear as badges in the network (L3) view.',
        ),
        why: t(
          'help.routing.why',
          'Readers see at a glance where each protocol runs. LineWise draws them; it does not check them.',
        ),
        example: t('help.routing.example', 'OSPF 0    BGP 65001'),
        doc: 'user/devices#routing-annotations',
      };
    case 'link':
      return {
        title: t('help.link.title', 'Links'),
        what: t(
          'help.link.what',
          'A link is one cable or circuit between two interfaces. Its medium sets how it is drawn; bandwidth, label and circuit ID appear in the label in its middle.',
        ),
        why: t(
          'help.link.why',
          'Medium and speed tell readers what the physical network is; a circuit ID is what you quote to a provider.',
        ),
        example: t('help.link.example', '10G · fiber    MPLS – AT&T'),
        doc: 'user/links#medium',
      };
    case 'display':
      return {
        title: t('help.display.title', 'Labels and display'),
        what: t(
          'help.display.what',
          'Choose what labels show. Each view shows what it is about: interface names in L1, VLANs in L2, addresses in L3. What both ends of a link share is written once, in the middle.',
        ),
        why: t(
          'help.display.why',
          'Fewer, larger labels read better than many small ones. Turn a detail on here to show it in every view.',
        ),
        example: t('help.display.example', 'trunk ●10, ●20, ●99    10.0.12.0/30 with .1 and .2 at the ends'),
        doc: 'user/links#labels-at-the-link-ends',
      };
    case 'zone':
      return {
        title: t('help.zone.title', 'Zones'),
        what: t(
          'help.zone.what',
          'A zone is a labeled area, such as a site, a building, a DMZ or a cloud VPC. Devices inside it move with it, and zones can nest.',
        ),
        why: t('help.zone.why', 'Zones show where things are and which security boundary they sit behind.'),
        example: t('help.zone.example', 'Site: Huntsville › Building A › DMZ'),
        doc: 'user/drawing#zones',
      };
    case 'problems':
      return {
        title: t('help.problems.title', 'Problems'),
        what: t(
          'help.problems.what',
          'LineWise checks the network as you draw: addresses, subnets, VLANs, trunks, speeds and more. Click a problem to select what it is about; many have a one-click fix.',
        ),
        why: t(
          'help.problems.why',
          'These are the mistakes that break a real network. Suppress a finding you accept; the reason is saved in the diagram.',
        ),
        doc: 'user/validation',
      };
    case 'subnets':
      return {
        title: t('help.subnets.title', 'Subnets and IPAM'),
        what: t(
          'help.subnets.what',
          'A subnet is a block of addresses, such as 10.0.20.0/24. LineWise tracks which addresses are in use, the gateway and the VLAN each subnet belongs to.',
        ),
        why: t(
          'help.subnets.why',
          'Planning addresses here avoids duplicates and overlaps, and the next free address is always one click away.',
        ),
        example: t('help.subnets.example', '10.0.20.0/24 · VLAN 20 · gateway 10.0.20.1'),
        doc: 'user/vlans-ipam#subnets',
      };
  }
}

/** One-sentence explanations of the networking terms inspector fields use (FR-UX-10). */
export function term(id: TermId): string {
  switch (id) {
    case 'mode':
      return t(
        'term.mode',
        'Access: one VLAN, untagged. Trunk: many VLANs, tagged. Routed: an IP interface.',
      );
    case 'accessVlan':
      return t(
        'term.accessVlan',
        'The one VLAN this port puts its traffic in. Both ends of a link should match.',
      );
    case 'allowedVlans':
      return t('term.allowedVlans', 'The VLANs this trunk carries, such as 10,20,30-40. Empty means all.');
    case 'nativeVlan':
      return t(
        'term.nativeVlan',
        'Untagged traffic on a trunk is placed in this VLAN. Both ends must match.',
      );
    case 'speed':
      return t('term.speed', 'The port speed in Mb/s (1000 = 1G). Leave it empty for auto.');
    case 'duplex':
      return t(
        'term.duplex',
        'Full duplex sends and receives at once. Both ends must match, or set both to auto.',
      );
    case 'media':
      return t('term.media', 'Whether the port takes copper or fiber. A link must join two of the same.');
    case 'fhrp':
      return t(
        'term.fhrp',
        'A first-hop redundancy group (HSRP, VRRP or GLBP): routers share one virtual gateway address.',
      );
    case 'vip':
      return t(
        'term.vip',
        'The shared gateway address hosts use; it moves to the backup router if the active one fails.',
      );
    case 'mgmtIp':
      return t('term.mgmtIp', 'The address you reach the device on for SSH, monitoring or SNMP.');
    case 'medium':
      return t(
        'term.medium',
        'What the link is: copper, fiber, serial, wireless, a tunnel or a console cable.',
      );
    case 'bandwidth':
      return t('term.bandwidth', 'The link speed in Mb/s, shown in its middle label (10000 shows as 10G).');
    case 'circuitId':
      return t(
        'term.circuitId',
        'The provider’s reference for a WAN circuit, which you quote when you call them.',
      );
    case 'interfaceNames':
      return t(
        'term.interfaceNames',
        'Short names (Gi1/0/1) keep labels compact; long names (GigabitEthernet1/0/1) are explicit.',
      );
    case 'labelTemplate':
      return t('term.labelTemplate', 'What each device’s label says, built from its fields.');
  }
}

export type TermId =
  | 'mode'
  | 'accessVlan'
  | 'allowedVlans'
  | 'nativeVlan'
  | 'speed'
  | 'duplex'
  | 'media'
  | 'fhrp'
  | 'vip'
  | 'mgmtIp'
  | 'medium'
  | 'bandwidth'
  | 'circuitId'
  | 'interfaceNames'
  | 'labelTemplate';
