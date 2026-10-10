// SPDX-License-Identifier: Apache-2.0
/** Starter diagrams for the welcome screen (FR-APP-06), built with real commands. */
import {
  addDevice,
  addInterfaces,
  addZone,
  assignIp,
  connect,
  createDocument,
  Editor,
  updateInterface,
  upsertSubnet,
  upsertVlan,
  type DeviceRole,
  type LinkMedium,
  type NetworkDocument,
} from '@linewise/core';
import { defaultTemplateFor, getTemplate } from './index.ts';

export interface Starter {
  id: string;
  name: string;
  description: string;
  build: () => NetworkDocument;
}

class Builder {
  readonly ed: Editor;
  readonly pageId: string;
  private ids = new Map<string, string>();

  constructor(name: string) {
    this.ed = new Editor(createDocument(name));
    this.pageId = this.ed.doc.pages[0]?.id as string;
  }

  dev(hostname: string, role: DeviceRole, x: number, y: number, templateId?: string, mgmtIp = ''): this {
    const template = (templateId ? getTemplate(templateId) : undefined) ?? defaultTemplateFor(role);
    const opts: Parameters<typeof addDevice>[0] = {
      role,
      pageId: this.pageId,
      position: { x, y },
      hostname,
      fields: { mgmtIp },
    };
    if (template) opts.template = template;
    const cmd = addDevice(opts);
    this.ed.execute(cmd);
    this.ids.set(hostname, cmd.deviceId);
    return this;
  }

  private iface(host: string, name: string): string | undefined {
    const id = this.ids.get(host);
    return this.ed.doc.devices
      .find((d) => d.id === id)
      ?.interfaces.find((i) => i.shortName === name || i.name === name)?.id;
  }

  link(
    a: string,
    b: string,
    medium: LinkMedium = 'copper',
    ia?: string,
    ib?: string,
    ipA?: [string, number],
    ipB?: [string, number],
  ): this {
    const endA: { deviceId: string; interfaceId?: string } = { deviceId: this.ids.get(a) as string };
    const endB: { deviceId: string; interfaceId?: string } = { deviceId: this.ids.get(b) as string };
    const fa = ia ? this.iface(a, ia) : undefined;
    const fb = ib ? this.iface(b, ib) : undefined;
    if (fa) endA.interfaceId = fa;
    if (fb) endB.interfaceId = fb;
    const c = connect(endA, endB, medium);
    this.ed.execute(c);
    const l = this.ed.doc.links.find((x) => x.id === c.linkId);
    if (l && ipA) this.ed.execute(assignIp(l.endpointA.deviceId, l.endpointA.interfaceId, ipA[0], ipA[1]));
    if (l && ipB) this.ed.execute(assignIp(l.endpointB.deviceId, l.endpointB.interfaceId, ipB[0], ipB[1]));
    return this;
  }

  trunk(a: string, b: string, allowed: string): this {
    const l = this.ed.doc.links.find(
      (x) =>
        (x.endpointA.deviceId === this.ids.get(a) && x.endpointB.deviceId === this.ids.get(b)) ||
        (x.endpointA.deviceId === this.ids.get(b) && x.endpointB.deviceId === this.ids.get(a)),
    );
    if (!l) return this;
    for (const e of [l.endpointA, l.endpointB])
      this.ed.execute(updateInterface(e.deviceId, e.interfaceId, { mode: 'trunk', allowedVlans: allowed }));
    return this;
  }

  ifaces(host: string, spec: string): this {
    this.ed.execute(addInterfaces(this.ids.get(host) as string, spec));
    return this;
  }

  zone(name: string, kind: Parameters<typeof addZone>[2], x: number, y: number, w: number, h: number): this {
    this.ed.execute(addZone(this.pageId, name, kind, { x, y, w, h }));
    return this;
  }

  vlan(number: number, name: string, cidr?: string, gateway?: string): this {
    const v = upsertVlan({ number, name });
    this.ed.execute(v);
    if (cidr) this.ed.execute(upsertSubnet({ cidr, name, vlanId: v.vlanId, gatewayIp: gateway ?? '' }));
    return this;
  }

  done(): NetworkDocument {
    return this.ed.doc;
  }
}

export const STARTERS: Starter[] = [
  {
    id: 'small-office',
    name: 'Small office',
    description: 'Internet, firewall, one switch, Wi-Fi, users, printer and a server.',
    build: () =>
      new Builder('Small office')
        .dev('INTERNET', 'internet', 400, 40)
        .dev('FW1', 'firewall', 400, 180, undefined, '192.168.1.1')
        .dev('SW1', 'l2-switch', 400, 320, 'generic/access-switch-24ge-4sfp', '192.168.1.2')
        .dev('AP1', 'access-point', 160, 480)
        .dev('PC1', 'workstation', 300, 480)
        .dev('PC2', 'workstation', 440, 480)
        .dev('PRN1', 'printer', 580, 480)
        .dev('SRV1', 'server', 720, 480)
        .link('INTERNET', 'FW1', 'copper', undefined, 'Gi0/0', undefined, ['203.0.113.2', 30])
        .link('FW1', 'SW1', 'copper', 'Gi0/1', 'Gi1/1/1', ['192.168.1.1', 24])
        .link('SW1', 'AP1')
        .link('SW1', 'PC1')
        .link('SW1', 'PC2')
        .link('SW1', 'PRN1')
        .link('SW1', 'SRV1')
        .vlan(1, 'default', '192.168.1.0/24', '192.168.1.1')
        .done(),
  },
  {
    id: 'three-tier-campus',
    name: 'Three-tier campus',
    description: 'Core, distribution and access layers with redundant uplinks and VLANs.',
    build: () => {
      const b = new Builder('Three-tier campus')
        .zone('Core', 'custom', 180, 0, 560, 140)
        .zone('Distribution', 'custom', 180, 170, 560, 140)
        .zone('Access', 'custom', 40, 340, 840, 140)
        .dev('CORE1', 'l3-switch', 330, 70, 'generic/l3-switch-24sfpplus-2qsfp', '10.0.0.1')
        .dev('CORE2', 'l3-switch', 590, 70, 'generic/l3-switch-24sfpplus-2qsfp', '10.0.0.2')
        .dev('DIST1', 'l3-switch', 330, 240, 'generic/l3-switch-24sfpplus-2qsfp', '10.0.0.11')
        .dev('DIST2', 'l3-switch', 590, 240, 'generic/l3-switch-24sfpplus-2qsfp', '10.0.0.12');
      ['ACC1', 'ACC2', 'ACC3', 'ACC4'].forEach((h, i) =>
        b.dev(h, 'l2-switch', 140 + i * 210, 410, 'generic/access-switch-48ge-4sfpplus', `10.0.0.${21 + i}`),
      );
      b.link('CORE1', 'CORE2', 'fiber-sm')
        .link('CORE1', 'DIST1', 'fiber-sm')
        .link('CORE1', 'DIST2', 'fiber-sm')
        .link('CORE2', 'DIST1', 'fiber-sm')
        .link('CORE2', 'DIST2', 'fiber-sm');
      for (const a of ['ACC1', 'ACC2', 'ACC3', 'ACC4']) {
        b.link('DIST1', a, 'fiber-mm', undefined, 'Te1/1/1').link(
          'DIST2',
          a,
          'fiber-mm',
          undefined,
          'Te1/1/2',
        );
        b.trunk('DIST1', a, '10,20,99').trunk('DIST2', a, '10,20,99');
      }
      return b
        .vlan(10, 'USERS', '10.10.0.0/22')
        .vlan(20, 'VOICE', '10.20.0.0/22')
        .vlan(99, 'MGMT', '10.0.0.0/24')
        .done();
    },
  },
  {
    id: 'collapsed-core',
    name: 'Collapsed-core campus',
    description: 'Two core/distribution switches, firewall and access switches.',
    build: () => {
      const b = new Builder('Collapsed-core campus')
        .dev('INTERNET', 'internet', 460, 20)
        .dev('FW1', 'firewall', 460, 140, undefined, '10.0.0.254')
        .dev('CORE1', 'l3-switch', 330, 280, 'generic/l3-switch-48ge-4sfpplus', '10.0.0.1')
        .dev('CORE2', 'l3-switch', 590, 280, 'generic/l3-switch-48ge-4sfpplus', '10.0.0.2');
      ['ACC1', 'ACC2', 'ACC3'].forEach((h, i) =>
        b.dev(h, 'l2-switch', 250 + i * 210, 440, 'generic/access-switch-48ge-4sfpplus'),
      );
      b.link('INTERNET', 'FW1')
        .link('FW1', 'CORE1')
        .link('FW1', 'CORE2')
        .link('CORE1', 'CORE2', 'fiber-sm', 'Te1/1/4', 'Te1/1/4');
      ['ACC1', 'ACC2', 'ACC3'].forEach((a, i) => {
        b.link('CORE1', a, 'fiber-mm', `Te1/1/${i + 1}`, 'Te1/1/1').link(
          'CORE2',
          a,
          'fiber-mm',
          `Te1/1/${i + 1}`,
          'Te1/1/2',
        );
      });
      return b.vlan(10, 'USERS').vlan(20, 'VOICE').done();
    },
  },
  {
    id: 'spine-leaf',
    name: 'Spine-leaf data center',
    description: 'Two spines fully meshed to four leaves, with servers.',
    build: () => {
      const b = new Builder('Spine-leaf data center')
        .dev('SPINE1', 'l3-switch', 340, 60, 'generic/l3-switch-24sfpplus-2qsfp')
        .dev('SPINE2', 'l3-switch', 620, 60, 'generic/l3-switch-24sfpplus-2qsfp');
      const leaves = ['LEAF1', 'LEAF2', 'LEAF3', 'LEAF4'];
      leaves.forEach((h, i) =>
        b.dev(h, 'l3-switch', 160 + i * 220, 260, 'generic/l3-switch-24sfpplus-2qsfp'),
      );
      let n = 0;
      for (const s of ['SPINE1', 'SPINE2']) {
        for (const l of leaves) {
          b.link(s, l, 'fiber-mm', undefined, undefined, [`10.255.${n}.0`, 31], [`10.255.${n}.1`, 31]);
          n++;
        }
      }
      leaves.forEach((l, i) => {
        b.dev(`SRV${i * 2 + 1}`, 'server', 110 + i * 220, 440, 'generic/server-2x10g').dev(
          `SRV${i * 2 + 2}`,
          'server',
          210 + i * 220,
          440,
          'generic/server-2x10g',
        );
        b.link(l, `SRV${i * 2 + 1}`, 'fiber-mm').link(l, `SRV${i * 2 + 2}`, 'fiber-mm');
      });
      return b.done();
    },
  },
  {
    id: 'hub-and-spoke',
    name: 'Hub-and-spoke WAN',
    description: 'Headquarters hub and three branches over an MPLS cloud.',
    build: () =>
      new Builder('Hub-and-spoke WAN')
        .dev('HQ-R1', 'router', 460, 60, 'generic/router-4ge', '10.255.0.1')
        .dev('MPLS', 'mpls-cloud', 460, 230)
        .dev('BR1-R1', 'router', 200, 400, 'generic/router-4ge', '10.255.0.11')
        .dev('BR2-R1', 'router', 460, 400, 'generic/router-4ge', '10.255.0.12')
        .dev('BR3-R1', 'router', 720, 400, 'generic/router-4ge', '10.255.0.13')
        .link('HQ-R1', 'MPLS', 'fiber-sm', 'Gi0/0', undefined, ['172.16.0.1', 30])
        .link('BR1-R1', 'MPLS', 'copper', 'Gi0/0', undefined, ['172.16.1.1', 30])
        .link('BR2-R1', 'MPLS', 'copper', 'Gi0/0', undefined, ['172.16.2.1', 30])
        .link('BR3-R1', 'MPLS', 'copper', 'Gi0/0', undefined, ['172.16.3.1', 30])
        .done(),
  },
  {
    id: 'dmvpn',
    name: 'DMVPN',
    description: 'A DMVPN hub with spokes over the internet; tunnels drawn as virtual links.',
    build: () => {
      const b = new Builder('DMVPN')
        .dev('HUB', 'router', 460, 60, 'generic/router-4ge', '10.255.0.1')
        .dev('INTERNET', 'internet', 460, 230)
        .dev('SPOKE1', 'router', 200, 400, 'generic/router-4ge')
        .dev('SPOKE2', 'router', 460, 400, 'generic/router-4ge')
        .dev('SPOKE3', 'router', 720, 400, 'generic/router-4ge')
        .link('HUB', 'INTERNET', 'copper', 'Gi0/0', undefined, ['198.51.100.1', 29]);
      ['SPOKE1', 'SPOKE2', 'SPOKE3'].forEach((s, i) =>
        b.link(s, 'INTERNET', 'copper', 'Gi0/0', undefined, [`203.0.113.${(i + 1) * 4 + 1}`, 30]),
      );
      b.ifaces('HUB', 'Tunnel0');
      ['SPOKE1', 'SPOKE2', 'SPOKE3'].forEach((s, i) => {
        b.ifaces(s, 'Tunnel0');
        b.link('HUB', s, 'virtual', 'Tunnel0', 'Tunnel0', i === 0 ? ['10.200.0.1', 24] : undefined, [
          `10.200.0.${i + 11}`,
          24,
        ]);
      });
      return b.done();
    },
  },
  {
    id: 'ccna-lab',
    name: 'CCNA lab',
    description: 'Three routers in a triangle and two switches: a classic study topology.',
    build: () =>
      new Builder('CCNA lab')
        .dev('R1', 'router', 460, 60, 'generic/router-2ge-2serial')
        .dev('R2', 'router', 240, 260, 'generic/router-2ge-2serial')
        .dev('R3', 'router', 680, 260, 'generic/router-2ge-2serial')
        .dev('SW1', 'l2-switch', 240, 440, 'generic/access-switch-24ge-4sfp')
        .dev('SW2', 'l2-switch', 680, 440, 'generic/access-switch-24ge-4sfp')
        .link('R1', 'R2', 'serial', 'Se0/1/0', 'Se0/1/0', ['10.0.12.1', 30], ['10.0.12.2', 30])
        .link('R1', 'R3', 'serial', 'Se0/1/1', 'Se0/1/0', ['10.0.13.1', 30], ['10.0.13.2', 30])
        .link('R2', 'R3', 'copper', 'Gi0/1', 'Gi0/1', ['10.0.23.1', 30], ['10.0.23.2', 30])
        .link('R2', 'SW1', 'copper', 'Gi0/0', undefined, ['192.168.2.1', 24])
        .link('R3', 'SW2', 'copper', 'Gi0/0', undefined, ['192.168.3.1', 24])
        .done(),
  },
];
