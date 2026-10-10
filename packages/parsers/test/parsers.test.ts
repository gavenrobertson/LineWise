// SPDX-License-Identifier: Apache-2.0
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  detectKind,
  guessCsvMapping,
  isSecretLine,
  parseCdp,
  parseCsv,
  parseCsvRows,
  parseLldp,
  parseRunningConfig,
  parseText,
  parseVlanBrief,
  type ParseResult,
} from '../src/index.ts';

const FIX = join(import.meta.dirname, '..', 'fixtures');
const fixtures = readdirSync(FIX).flatMap((dir) =>
  readdirSync(join(FIX, dir)).map((f) => ({ dir, f, path: join(FIX, dir, f) })),
);
const read = (rel: string) => readFileSync(join(FIX, rel), 'utf8');

function summarize(r: ParseResult) {
  return {
    kind: r.kind,
    local: r.localHostname ?? null,
    devices: r.devices.map((d) => ({ ...d, interfaces: d.interfaces.map((i) => ({ ...i })) })),
    links: r.links,
    vlans: r.vlans,
    vrfs: r.vrfs,
    annotations: r.annotations.length,
    warnings: r.warnings,
    unparsed: r.unparsedLines.length,
  };
}

describe('fixtures: every parser has at least five [FR-IMP-26]', () => {
  it('counts fixtures per parser', () => {
    const counts = new Map<string, number>();
    for (const { dir } of fixtures) counts.set(dir, (counts.get(dir) ?? 0) + 1);
    expect(counts.size).toBe(12);
    for (const [dir, n] of counts) expect(n, dir).toBeGreaterThanOrEqual(5);
    for (const dir of counts.keys())
      expect(
        fixtures.some((f) => f.dir === dir && f.f.includes('malformed')),
        dir,
      ).toBe(true);
  });
});

describe('golden outputs [FR-IMP-26]', () => {
  for (const { dir, f, path } of fixtures) {
    it(`${dir}/${f}`, () => {
      const r = parseText(readFileSync(path, 'utf8'), { fileName: f });
      expect(summarize(r)).toMatchSnapshot();
    });
  }
});

describe('auto-detect [FR-IMP-20]', () => {
  it.each([
    ['cdp/01-ios-two-neighbors.txt', 'cdp'],
    ['lldp/02-nxos.txt', 'lldp'],
    ['lldp/03-lldpctl.txt', 'lldp'],
    ['running-config/03-nxos.txt', 'running-config'],
    ['ip-interface-brief/03-nxos.txt', 'ip-interface-brief'],
    ['interfaces-status/02-nxos.txt', 'interfaces-status'],
    ['vlan-brief/01-ios.txt', 'vlan-brief'],
    ['etherchannel-summary/02-nxos.txt', 'etherchannel-summary'],
    ['drawio/02-compressed.drawio', 'drawio'],
    ['nmap/01-scan.xml', 'nmap'],
  ])('%s → %s', (rel, kind) => {
    expect(detectKind(read(rel))).toBe(kind);
  });

  it('uses file names for CSV, GNS3 and Containerlab', () => {
    expect(detectKind('a;b', 'x.csv')).toBe('csv');
    expect(detectKind('{}', 'lab.gns3')).toBe('gns3');
    expect(detectKind('name: x', 'lab.clab.yml')).toBe('containerlab');
    expect(detectKind('hello world')).toBeNull();
    expect(parseText('hello world').warnings[0]).toMatch(/Could not recognize/);
  });
});

describe('CDP [FR-IMP-01]', () => {
  it('builds devices and links from IOS output with a prompt', () => {
    const r = parseCdp(read('cdp/01-ios-two-neighbors.txt'));
    expect(r.localHostname).toBe('R1');
    expect(r.devices.find((d) => d.hostname === 'SW1')).toMatchObject({
      role: 'l3-switch',
      mgmtIp: '10.10.0.2',
      model: 'WS-C3850-24P',
      vendor: 'Cisco',
      osVersion: '16.12.4',
    });
    expect(r.devices.find((d) => d.hostname === 'R2')?.role).toBe('router');
    expect(r.links).toContainEqual({
      a: { hostname: 'R1', iface: 'GigabitEthernet0/1' },
      b: { hostname: 'SW1', iface: 'GigabitEthernet1/0/24' },
    });
  });

  it('handles NX-OS serial suffixes and System Name', () => {
    const r = parseCdp(read('cdp/02-nxos.txt'));
    expect(r.devices.map((d) => d.hostname)).toEqual(['N9K-1', 'N9K-2']);
    expect(r.links).toHaveLength(2);
  });

  it('needs the local device when there is no prompt', () => {
    const noPrompt = read('cdp/03-no-prompt-ap-and-phone.txt');
    expect(parseCdp(noPrompt).links).toHaveLength(0);
    const r = parseCdp(noPrompt, { localHostname: 'ACCESS-1' });
    expect(r.links).toHaveLength(2);
    expect(r.devices.find((d) => d.hostname === 'AP-FLOOR2')?.role).toBe('access-point');
    expect(r.devices.find((d) => d.hostname.startsWith('SEP'))?.role).toBe('ip-phone');
    expect(r.links.find((l) => l.b.hostname.startsWith('SEP'))?.b.iface).toBe('Port 1');
  });
});

describe('LLDP [FR-IMP-02]', () => {
  it('parses IOS, NX-OS and lldpctl', () => {
    expect(parseLldp(read('lldp/01-ios.txt')).links).toEqual([
      {
        a: { hostname: 'SW1', iface: 'GigabitEthernet1/0/48' },
        b: { hostname: 'ACCESS-2', iface: 'GigabitEthernet1/0/1' },
      },
      {
        a: { hostname: 'SW1', iface: 'TenGigabitEthernet1/1/1' },
        b: { hostname: 'CORE1', iface: 'TenGigabitEthernet1/0/1' },
      },
    ]);
    expect(parseLldp(read('lldp/02-nxos.txt')).links[0]).toEqual({
      a: { hostname: 'N9K-1', iface: 'Ethernet1/1' },
      b: { hostname: 'LEAF-1', iface: 'Ethernet1/1' },
    });
    const ctl = parseLldp(read('lldp/03-lldpctl.txt'), { localHostname: 'srv17' });
    expect(ctl.links[0]).toEqual({
      a: { hostname: 'srv17', iface: 'eth0' },
      b: { hostname: 'tor-sw1', iface: 'Ethernet12' },
    });
    expect(ctl.devices.find((d) => d.hostname === 'tor-sw1')).toMatchObject({
      mgmtIp: '10.1.1.1',
      role: 'l3-switch',
    });
  });
});

describe('running-config [FR-IMP-03, FR-IMP-25]', () => {
  it('parses an access switch', () => {
    const r = parseRunningConfig(read('running-config/01-ios-access.txt'));
    const d = r.devices[0];
    expect(d).toMatchObject({
      hostname: 'ACCESS-1',
      role: 'l2-switch',
      mgmtIp: '10.99.0.11',
      vendor: 'Cisco',
      osVersion: '15.2',
    });
    const gi49 = d?.interfaces.find((i) => i.name === 'GigabitEthernet1/0/49');
    expect(gi49).toMatchObject({
      mode: 'trunk',
      nativeVlan: 99,
      allowedVlans: '10,20,99',
      channelGroup: { number: 1, mode: 'lacp-active' },
    });
    expect(d?.interfaces.find((i) => i.name === 'GigabitEthernet1/0/2')?.enabled).toBe(false);
    expect(r.vlans).toEqual([
      { number: 10, name: 'USERS' },
      { number: 20, name: 'VOICE' },
      { number: 99, name: 'MGMT' },
    ]);
  });

  it('parses a router with VRFs, secondaries, HSRP, sub-interfaces and routing', () => {
    const r = parseRunningConfig(read('running-config/02-ios-router.txt'));
    const d = r.devices[0];
    expect(d?.role).toBe('router');
    expect(d?.mgmtIp).toBe('10.255.0.1');
    const lan = d?.interfaces.find((i) => i.name === 'GigabitEthernet0/0/1');
    expect(lan?.ipv4).toEqual([
      { address: '10.0.0.2', prefix: 24, secondary: false },
      { address: '10.0.1.2', prefix: 24, secondary: true },
    ]);
    expect(lan?.fhrp).toEqual({ protocol: 'hsrp', group: 1, vip: '10.0.0.1' });
    expect(lan?.ipv6?.[0]).toMatchObject({ address: '2001:DB8:0:1::2', prefix: 64 });
    expect(d?.interfaces.find((i) => i.name === 'GigabitEthernet0/0/1.200')).toMatchObject({
      dot1q: 200,
      vrf: 'CUSTOMER-A',
    });
    expect(r.vrfs).toEqual([{ name: 'CUSTOMER-A', rd: '65000:100' }]);
    expect(d?.routing).toEqual([
      { protocol: 'ospf', value: '1' },
      { protocol: 'bgp', value: '65000' },
      { protocol: 'static', value: '' },
    ]);
  });

  it('parses NX-OS (switchname, CIDR addresses, vrf member, hsrp blocks)', () => {
    const d = parseRunningConfig(read('running-config/03-nxos.txt')).devices[0];
    expect(d).toMatchObject({ hostname: 'LEAF-1', role: 'l3-switch', mgmtIp: '192.168.100.11' });
    expect(d?.interfaces.find((i) => i.name === 'Vlan10')).toMatchObject({
      vrf: 'PROD',
      fhrp: { protocol: 'hsrp', group: 10, vip: '10.1.10.1' },
    });
    expect(d?.interfaces.find((i) => i.name === 'Ethernet1/1')).toMatchObject({
      mode: 'access',
      accessVlan: 10,
      speedMbps: 10000,
      duplex: 'full',
    });
  });

  it('handles allowed-VLAN add/remove/except', () => {
    const d = parseRunningConfig(read('running-config/04-trunk-add-remove.txt')).devices[0];
    expect(d?.interfaces.find((i) => i.name === 'TenGigabitEthernet1/1/1')?.allowedVlans).toBe('10,12,20,30');
    expect(d?.interfaces.find((i) => i.name === 'TenGigabitEthernet1/1/2')?.allowedVlans).toBe('100-4094');
    expect(d?.interfaces.find((i) => i.name === 'TenGigabitEthernet1/1/3')).toMatchObject({
      mode: 'routed',
      mtu: 9100,
    });
    expect(d?.interfaces.find((i) => i.name === 'Vlan10')?.fhrp).toEqual({
      protocol: 'vrrp',
      group: 10,
      vip: '10.10.0.254',
    });
  });

  it('never keeps secrets anywhere in the result', () => {
    for (const rel of ['running-config/01-ios-access.txt', 'running-config/02-ios-router.txt']) {
      const json = JSON.stringify(parseRunningConfig(read(rel)));
      for (const secret of ['$9$', 's3cr3t', '0822455D0A16', 'supersecret', 'mykey'])
        expect(json, `${rel}: ${secret}`).not.toContain(secret);
    }
    expect(parseRunningConfig(read('running-config/01-ios-access.txt')).warnings[0]).toMatch(
      /4 line\(s\) containing secrets/,
    );
    expect(isSecretLine(' neighbor 1.1.1.1 password x')).toBe(true);
    expect(isSecretLine(' description uplink')).toBe(false);
  });

  it('reports unknown lines instead of failing', () => {
    const r = parseRunningConfig(read('running-config/05-malformed.txt'));
    expect(r.devices[0]?.hostname).toBe('BROKEN');
    expect(r.unparsedLines.map((u) => u.text)).toEqual(
      expect.arrayContaining([
        'ip address 10.0.0.1 999.255.255.0',
        'ip address banana',
        'frobnicate the widgets',
        'switchport access vlan abc',
      ]),
    );
  });
});

describe('show commands [FR-IMP-04]', () => {
  it('treats ports listed under several VLANs as trunks', () => {
    const d = parseVlanBrief(read('vlan-brief/02-nxos.txt')).devices[0];
    expect(d?.interfaces.find((i) => i.name === 'Ethernet1/49')).toMatchObject({
      mode: 'trunk',
      allowedVlans: '1,10,20',
    });
    expect(d?.interfaces.find((i) => i.name === 'Ethernet1/1')).toMatchObject({
      mode: 'access',
      accessVlan: 10,
    });
  });
});

describe('CSV [FR-IMP-05]', () => {
  it('tokenizes quotes, BOM and separators', () => {
    expect(parseCsvRows('﻿a,"b ""c""","d,e"\n1;2\t3\r\n')).toEqual([
      ['a', 'b "c"', 'd,e'],
      ['1', '2', '3'],
    ]);
  });

  it('guesses column mappings and honors overrides', () => {
    expect(guessCsvMapping(['Hostname', 'Type', 'Management IP', 'Notes'])).toEqual([
      'hostname',
      'role',
      'mgmtIp',
      'ignore',
    ]);
    const r = parseCsv('Name,Kind\nX1,router\n', { mapping: ['hostname', 'ignore'] });
    expect(r.devices[0]).toEqual({ hostname: 'X1', interfaces: [] });
  });
});

describe('robustness [NFR-SEC-05]', () => {
  const kinds = [
    'cdp',
    'lldp',
    'running-config',
    'ip-interface-brief',
    'interfaces-status',
    'vlan-brief',
    'etherchannel-summary',
    'csv',
    'drawio',
    'gns3',
    'containerlab',
    'nmap',
  ] as const;
  const runs = Number(process.env.FUZZ_RUNS ?? 150);

  it('never throws or hangs on arbitrary input', () => {
    const lineish = fc
      .array(
        fc.oneof(
          fc.string({ maxLength: 80 }),
          fc.constantFrom(
            'Device ID: X',
            'Interface: Gi0/1,  Port ID (outgoing port): Gi0/2',
            'interface Gi0/1',
            ' ip address 1.2.3.4 255.255.255.0',
            'Local Intf: Gi0/1',
            'Chassis id: 1',
            '<mxCell vertex="1" style="router"/>',
            'VLAN Name Status Ports',
            '1 Po1(SU) LACP Gi0/1(P)',
          ),
        ),
        { maxLength: 60 },
      )
      .map((ls) => ls.join('\n'));
    fc.assert(
      fc.property(lineish, fc.constantFrom(...kinds), (text, kind) => {
        const t0 = performance.now();
        const r = parseText(text, {}, kind);
        expect(r).toBeTruthy();
        expect(performance.now() - t0).toBeLessThan(1000);
      }),
      { numRuns: runs },
    );
  });

  it('rejects oversized input with a warning', () => {
    const r = parseText('x'.repeat(21 * 1024 * 1024), {}, 'running-config');
    expect(r.warnings[0]).toMatch(/too large/);
  });

  it('parses a pathological line in linear time', () => {
    const t0 = performance.now();
    parseText(`${'interface '.repeat(20000)}\n${'Device ID: '.repeat(20000)}`, {}, 'running-config');
    parseText(`${'a,'.repeat(200000)}`, {}, 'csv');
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
