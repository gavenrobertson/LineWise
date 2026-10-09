// SPDX-License-Identifier: Apache-2.0
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  bigIntToIp,
  cidrContains,
  cidrsOverlap,
  cidrToString,
  ipToBigInt,
  isNetworkOrBroadcast,
  maskToPrefix,
  nextFreeIp,
  nextP2pSubnet,
  parseCidr,
  prefixToMask,
  sameSubnet,
  splitEqual,
  subnetInfo,
  utilization,
  vlsm,
} from '../src/index.ts';

describe('subnet calculator [FR-NET-07]', () => {
  it('computes IPv4 details', () => {
    const s = subnetInfo('192.168.10.77/26');
    expect(s).toMatchObject({
      cidr: '192.168.10.64/26',
      network: '192.168.10.64',
      broadcast: '192.168.10.127',
      firstUsable: '192.168.10.65',
      lastUsable: '192.168.10.126',
      mask: '255.255.255.192',
      wildcard: '0.0.0.63',
    });
    expect(s.hosts).toBe(62n);
  });

  it('handles /31 and /32 (RFC 3021)', () => {
    expect(subnetInfo('10.0.0.0/31').hosts).toBe(2n);
    expect(subnetInfo('10.0.0.0/31').firstUsable).toBe('10.0.0.0');
    expect(subnetInfo('10.0.0.5/32').hosts).toBe(1n);
  });

  it('computes IPv6 details', () => {
    const s = subnetInfo('2001:db8:abcd:12::1/64');
    expect(s.network).toBe('2001:db8:abcd:12::');
    expect(s.broadcast).toBeNull();
    expect(s.lastUsable).toBe('2001:db8:abcd:12:ffff:ffff:ffff:ffff');
  });

  it('converts masks', () => {
    expect(prefixToMask(24)).toBe('255.255.255.0');
    expect(maskToPrefix('255.255.255.252')).toBe(30);
    expect(maskToPrefix('0.0.0.0')).toBe(0);
    expect(() => maskToPrefix('255.0.255.0')).toThrow(/Non-contiguous/);
  });

  it('rejects invalid input', () => {
    expect(() => parseCidr('10.0.0.0')).toThrow();
    expect(() => parseCidr('10.0.0.0/33')).toThrow();
    expect(() => parseCidr('300.0.0.0/8')).toThrow();
  });
});

describe('containment and overlap [FR-NET-06]', () => {
  it('detects membership and overlap', () => {
    const c = parseCidr('10.1.0.0/16');
    expect(cidrContains(c, '10.1.255.1')).toBe(true);
    expect(cidrContains(c, '10.2.0.1')).toBe(false);
    expect(cidrContains(c, '2001:db8::1')).toBe(false);
    expect(cidrsOverlap(parseCidr('10.1.0.0/16'), parseCidr('10.1.4.0/24'))).toBe(true);
    expect(cidrsOverlap(parseCidr('10.1.0.0/24'), parseCidr('10.1.1.0/24'))).toBe(false);
    expect(sameSubnet('10.0.12.1', 30, '10.0.12.2', 30)).toBe(true);
    expect(sameSubnet('10.0.12.1', 30, '10.0.12.5', 30)).toBe(false);
    expect(sameSubnet('10.0.12.1', 30, '10.0.12.2', 29)).toBe(false);
  });

  it('flags network and broadcast addresses', () => {
    expect(isNetworkOrBroadcast('10.0.0.0', 24)).toBe(true);
    expect(isNetworkOrBroadcast('10.0.0.255', 24)).toBe(true);
    expect(isNetworkOrBroadcast('10.0.0.1', 24)).toBe(false);
    expect(isNetworkOrBroadcast('10.0.0.0', 31)).toBe(false);
  });
});

describe('allocation [FR-NET-06, FR-NET-08]', () => {
  it('splits a block and runs VLSM', () => {
    expect(splitEqual('10.0.0.0/24', 4)).toEqual([
      '10.0.0.0/26',
      '10.0.0.64/26',
      '10.0.0.128/26',
      '10.0.0.192/26',
    ]);
    const r = vlsm('192.168.0.0/24', [
      { name: 'users', hosts: 100 },
      { name: 'voice', hosts: 50 },
      { name: 'p2p', hosts: 2 },
    ]);
    expect(r).toEqual([
      { name: 'users', cidr: '192.168.0.0/25', hosts: 100 },
      { name: 'voice', cidr: '192.168.0.128/26', hosts: 50 },
      { name: 'p2p', cidr: '192.168.0.192/30', hosts: 2 },
    ]);
    expect(() => vlsm('192.168.0.0/28', [{ name: 'big', hosts: 100 }])).toThrow(/too small/);
  });

  it('finds the next free IP, honoring reservations', () => {
    expect(nextFreeIp('10.0.0.0/29', ['10.0.0.1', '10.0.0.2'])).toBe('10.0.0.3');
    expect(nextFreeIp('10.0.0.0/29', [], [{ start: '10.0.0.1', end: '10.0.0.4' }])).toBe('10.0.0.5');
    expect(nextFreeIp('10.0.0.0/30', ['10.0.0.1', '10.0.0.2'])).toBeNull();
  });

  it('allocates point-to-point subnets from a pool', () => {
    expect(nextP2pSubnet('10.255.0.0/24', ['10.255.0.0/30'])).toEqual({
      cidr: '10.255.0.4/30',
      a: '10.255.0.5',
      b: '10.255.0.6',
    });
    expect(nextP2pSubnet('10.255.0.0/24', [], 31)).toEqual({
      cidr: '10.255.0.0/31',
      a: '10.255.0.0',
      b: '10.255.0.1',
    });
    expect(nextP2pSubnet('10.255.0.0/30', ['10.255.0.0/30'])).toBeNull();
  });

  it('computes utilization', () => {
    expect(utilization('10.0.0.0/29', ['10.0.0.1', '10.0.0.2', '10.0.0.3', '10.9.9.9'])).toBeCloseTo(0.5);
  });
});

describe('IP math properties', () => {
  const v4 = fc
    .tuple(
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
    )
    .map((p) => p.join('.'));

  it('address ↔ BigInt round-trips', () => {
    fc.assert(fc.property(v4, (ip) => bigIntToIp(ipToBigInt(ip), 4) === ip));
  });

  it('every address is contained in its own normalized subnet', () => {
    fc.assert(
      fc.property(v4, fc.integer({ min: 0, max: 32 }), (ip, prefix) => {
        const c = parseCidr(`${ip}/${prefix}`);
        return cidrContains(c, ip) && cidrToString(parseCidr(cidrToString(c))) === cidrToString(c);
      }),
    );
  });

  it('mask ↔ prefix round-trips', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 32 }), (p) => maskToPrefix(prefixToMask(p)) === p));
  });

  it('equal splits tile the block without overlap', () => {
    fc.assert(
      fc.property(
        v4,
        fc.integer({ min: 8, max: 28 }),
        fc.integer({ min: 1, max: 16 }),
        (ip, prefix, count) => {
          const parts = splitEqual(`${ip}/${prefix}`, count).map(parseCidr);
          const block = parseCidr(`${ip}/${prefix}`);
          for (let i = 0; i < parts.length; i++) {
            const pi = parts[i];
            if (!pi || !cidrContains(block, cidrToString(pi).split('/')[0] as string)) return false;
            for (let j = i + 1; j < parts.length; j++) {
              const pj = parts[j];
              if (pj && cidrsOverlap(pi, pj)) return false;
            }
          }
          return true;
        },
      ),
    );
  });
});
