// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  abbreviateInterfaceName,
  compareInterfaceNames,
  expandInterfaceRange,
  formatVlanList,
  normalizeInterfaceName,
  parseVlanList,
  sameInterfaceName,
} from '../src/index.ts';

describe('normalizeInterfaceName [FR-NET-03]', () => {
  it.each([
    ['Gi0/1', 'GigabitEthernet0/1', 'Gi0/1'],
    ['g0/1', 'GigabitEthernet0/1', 'Gi0/1'],
    ['GigabitEthernet1/0/24', 'GigabitEthernet1/0/24', 'Gi1/0/24'],
    ['fa0/1', 'FastEthernet0/1', 'Fa0/1'],
    ['te1/1/1', 'TenGigabitEthernet1/1/1', 'Te1/1/1'],
    ['TwentyFiveGigE1/0/1', 'TwentyFiveGigE1/0/1', 'Twe1/0/1'],
    ['Fo1/0/1', 'FortyGigabitEthernet1/0/1', 'Fo1/0/1'],
    ['Hu1/0/49', 'HundredGigE1/0/49', 'Hu1/0/49'],
    ['Eth1/1', 'Ethernet1/1', 'Eth1/1'],
    ['po1', 'Port-channel1', 'Po1'],
    ['Port-channel10', 'Port-channel10', 'Po10'],
    ['lo0', 'Loopback0', 'Lo0'],
    ['vlan10', 'Vlan10', 'Vl10'],
    ['Tu100', 'Tunnel100', 'Tu100'],
    ['Se0/0/0', 'Serial0/0/0', 'Se0/0/0'],
    ['mgmt0', 'mgmt0', 'mgmt0'],
  ])('%s → %s (%s)', (input, full, short) => {
    const n = normalizeInterfaceName(input);
    expect(n.name).toBe(full);
    expect(n.shortName).toBe(short);
  });

  it('parses sub-interfaces with dot1q tags [FR-NET-04]', () => {
    const n = normalizeInterfaceName('Gi0/0.10');
    expect(n).toMatchObject({
      name: 'GigabitEthernet0/0.10',
      shortName: 'Gi0/0.10',
      type: 'subinterface',
      dot1q: 10,
    });
  });

  it('assigns types and speeds', () => {
    expect(normalizeInterfaceName('Gi0/1')).toMatchObject({ type: 'gigabitethernet', speedMbps: 1000 });
    expect(normalizeInterfaceName('Te1/1/1').speedMbps).toBe(10000);
    expect(normalizeInterfaceName('Lo0').type).toBe('loopback');
  });

  it('keeps unknown names as-is with type "other"', () => {
    expect(normalizeInterfaceName('wan1')).toMatchObject({ name: 'wan1', type: 'other' });
    expect(normalizeInterfaceName('port 1 of something')).toMatchObject({ type: 'other' });
  });

  it('abbreviates and compares equivalent spellings', () => {
    expect(abbreviateInterfaceName('GigabitEthernet0/1')).toBe('Gi0/1');
    expect(sameInterfaceName('Gi0/1', 'GigabitEthernet0/1')).toBe(true);
    expect(sameInterfaceName('Gi0/1', 'Gi0/2')).toBe(false);
  });
});

describe('expandInterfaceRange [FR-NET-02]', () => {
  it('expands a range on the last number', () => {
    const r = expandInterfaceRange('Gi1/0/1-24');
    expect(r).toHaveLength(24);
    expect(r[0]).toBe('GigabitEthernet1/0/1');
    expect(r[23]).toBe('GigabitEthernet1/0/24');
  });

  it('supports lists and spaces', () => {
    expect(expandInterfaceRange('Gi1/0/1 - 2, Te1/1/1-2, Lo0')).toEqual([
      'GigabitEthernet1/0/1',
      'GigabitEthernet1/0/2',
      'TenGigabitEthernet1/1/1',
      'TenGigabitEthernet1/1/2',
      'Loopback0',
    ]);
  });

  it('rejects reversed and oversized ranges', () => {
    expect(() => expandInterfaceRange('Gi1/0/5-1')).toThrow(/before start/);
    expect(() => expandInterfaceRange('Gi1/0/1-99999')).toThrow(/too large/);
  });

  it('sorts naturally', () => {
    const names = ['Gi1/0/10', 'Gi1/0/2', 'Gi1/0/1'];
    expect([...names].sort(compareInterfaceNames)).toEqual(['Gi1/0/1', 'Gi1/0/2', 'Gi1/0/10']);
  });
});

describe('VLAN lists', () => {
  it('parses and formats', () => {
    expect(parseVlanList('1-3,5, 10-11')).toEqual([1, 2, 3, 5, 10, 11]);
    expect(formatVlanList([11, 1, 2, 3, 5, 10])).toBe('1-3,5,10-11');
    expect(parseVlanList('')).toEqual([]);
    expect(parseVlanList('all')).toHaveLength(4094);
  });

  it('rejects invalid input', () => {
    expect(() => parseVlanList('0-5')).toThrow();
    expect(() => parseVlanList('4095')).toThrow();
    expect(() => parseVlanList('abc')).toThrow();
  });
});
