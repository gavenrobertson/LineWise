// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  addDevice,
  applyFix,
  assignIp,
  connect,
  createPortChannel,
  Editor,
  createDocument,
  listRules,
  registerRule,
  updateDevices,
  updateInterface,
  updateSettings,
  upsertSubnet,
  upsertVlan,
  validate,
  type Interface,
} from '../src/index.ts';
import { routerTemplate, switchTemplate, useDeterminism } from './helpers.ts';

useDeterminism();

/** Two devices joined by one link; returns handles to both ends. */
function pair(roleA: 'router' | 'l2-switch' = 'router', roleB: 'router' | 'l2-switch' = 'router') {
  const ed = new Editor(createDocument('V'));
  const pageId = ed.doc.pages[0]?.id as string;
  const tpl = (r: string) => (r === 'router' ? routerTemplate : switchTemplate);
  const a = addDevice({
    role: roleA,
    pageId,
    position: { x: 0, y: 0 },
    template: tpl(roleA),
    fields: { mgmtIp: '10.9.9.1' },
  });
  const b = addDevice({
    role: roleB,
    pageId,
    position: { x: 0, y: 0 },
    template: tpl(roleB),
    fields: { mgmtIp: '10.9.9.2' },
  });
  ed.execute(a);
  ed.execute(b);
  const c = connect({ deviceId: a.deviceId }, { deviceId: b.deviceId });
  ed.execute(c);
  const link = ed.doc.links[0];
  if (!link) throw new Error('no link');
  const ia = link.endpointA.interfaceId;
  const ib = link.endpointB.interfaceId;
  const setA = (p: Partial<Interface>) => ed.execute(updateInterface(a.deviceId, ia, p));
  const setB = (p: Partial<Interface>) => ed.execute(updateInterface(b.deviceId, ib, p));
  const ids = (rule: string) => validate(ed.doc).issues.filter((i) => i.ruleId === rule);
  return { ed, pageId, a: a.deviceId, b: b.deviceId, ia, ib, linkId: c.linkId, setA, setB, ids };
}

describe('rule registry [FR-VAL-04]', () => {
  it('registers VAL-001..020 and accepts new rules', () => {
    const ids = listRules().map((r) => r.id);
    for (let n = 1; n <= 20; n++) expect(ids).toContain(`VAL-${String(n).padStart(3, '0')}`);
    registerRule({
      id: 'VAL-900',
      severity: 'info',
      title: 'test',
      why: 'why',
      fix: 'fix',
      run: () => [{ message: 'hello', objectIds: [], fixes: [] }],
    });
    expect(validate(createDocument()).issues.some((i) => i.ruleId === 'VAL-900')).toBe(true);
    registerRule({ id: 'VAL-900', severity: 'info', title: 'test', why: '', fix: '', run: () => [] });
  });
  it('explains every rule: why it matters and how to fix it (FR-UX-11)', () => {
    for (const r of listRules().filter((x) => x.id < 'VAL-900')) {
      expect(r.why.length, r.id).toBeGreaterThan(20);
      expect(r.fix.length, r.id).toBeGreaterThan(10);
      expect(r.why.endsWith('.') && r.fix.endsWith('.'), r.id).toBe(true);
    }
  });
});

describe('rule severities match the spec table (section 7)', () => {
  it('VAL-001..020 have the specified severity', () => {
    const want = 'EEEEEWWWWWWWWWWIIIII';
    const sev = { E: 'error', W: 'warning', I: 'info' } as const;
    for (let n = 1; n <= 20; n++) {
      const id = `VAL-${String(n).padStart(3, '0')}`;
      expect(listRules().find((r) => r.id === id)?.severity, id).toBe(sev[want[n - 1] as 'E' | 'W' | 'I']);
    }
  });
});

describe('addressing rules', () => {
  it('VAL-001 duplicate IP in the same VRF', () => {
    const t = pair();
    t.ed.execute(assignIp(t.a, t.ia, '10.0.0.1', 30));
    expect(t.ids('VAL-001')).toHaveLength(0);
    t.ed.execute(assignIp(t.b, t.ib, '10.0.0.1', 30));
    expect(t.ids('VAL-001')).toHaveLength(1);
    t.setB({ vrfId: 'other-vrf' });
    expect(t.ids('VAL-001')).toHaveLength(0);
  });

  it('VAL-002 subnet mismatch with an assign-IP quick fix [FR-VAL-01]', () => {
    const t = pair();
    t.ed.execute(assignIp(t.a, t.ia, '10.0.12.1', 30));
    t.ed.execute(assignIp(t.b, t.ib, '10.0.12.2', 30));
    expect(t.ids('VAL-002')).toHaveLength(0);
    t.ed.execute(assignIp(t.b, t.ib, '10.0.13.2', 30));
    const [issue] = t.ids('VAL-002');
    expect(issue?.objectIds).toContain(t.linkId);
    const fix = issue?.fixes[0];
    expect(fix).toMatchObject({ kind: 'assign-ip', address: '10.0.12.2', prefix: 30 });
    if (!fix) return;
    t.ed.execute(applyFix(fix));
    expect(t.ids('VAL-002')).toHaveLength(0);
  });

  it('VAL-003 invalid, network and broadcast addresses', () => {
    const t = pair();
    t.ed.execute(assignIp(t.a, t.ia, '10.0.0.0', 24));
    t.setB({
      ipv4: [{ address: '999.1.1.1', prefix: 24, secondary: false }],
      ipv6: [{ address: '10.0.0.1', prefix: 64, secondary: false }],
    });
    expect(t.ids('VAL-003')).toHaveLength(3);
    t.ed.execute(assignIp(t.a, t.ia, '10.0.0.5', 24));
    t.setB({ ipv4: [], ipv6: [{ address: '2001:db8::1', prefix: 64, secondary: false }] });
    expect(t.ids('VAL-003')).toHaveLength(0);
  });

  it('VAL-004 overlapping subnets', () => {
    const t = pair();
    t.ed.execute(upsertSubnet({ cidr: '10.1.0.0/16' }));
    t.ed.execute(upsertSubnet({ cidr: '10.2.0.0/24' }));
    expect(t.ids('VAL-004')).toHaveLength(0);
    t.ed.execute(upsertSubnet({ cidr: '10.1.5.0/24' }));
    expect(t.ids('VAL-004')).toHaveLength(1);
  });

  it('VAL-014 gateway outside subnet or unowned', () => {
    const t = pair();
    t.ed.execute(upsertSubnet({ cidr: '10.5.0.0/24', gatewayIp: '10.6.0.1' }));
    expect(t.ids('VAL-014')[0]?.message).toMatch(/outside/);
    const sub = t.ed.doc.subnets[0]?.id as string;
    t.ed.execute(upsertSubnet({ id: sub, cidr: '10.5.0.0/24', gatewayIp: '10.5.0.1' }));
    expect(t.ids('VAL-014')[0]?.message).toMatch(/No interface owns/);
    t.ed.execute(assignIp(t.a, t.ia, '10.5.0.1', 24));
    expect(t.ids('VAL-014')).toHaveLength(0);
  });

  it('VAL-018 subnet utilization', () => {
    const t = pair();
    t.ed.execute(upsertSubnet({ cidr: '10.7.0.0/30' }));
    t.ed.execute(assignIp(t.a, t.ia, '10.7.0.1', 30));
    expect(t.ids('VAL-018')).toHaveLength(0);
    t.ed.execute(assignIp(t.b, t.ib, '10.7.0.2', 30));
    expect(t.ids('VAL-018')[0]?.message).toMatch(/100% utilized/);
  });
});

describe('layer 2 rules', () => {
  it('VAL-007 trunk/access mismatch with a fix', () => {
    const t = pair('l2-switch', 'l2-switch');
    t.setA({ mode: 'trunk' });
    t.setB({ mode: 'trunk' });
    expect(t.ids('VAL-007')).toHaveLength(0);
    t.setB({ mode: 'access', accessVlan: 10 });
    const [issue] = t.ids('VAL-007');
    expect(issue).toBeTruthy();
    if (issue?.fixes[0]) t.ed.execute(applyFix(issue.fixes[0]));
    expect(t.ids('VAL-007')).toHaveLength(0);
  });

  it('VAL-008 native VLAN mismatch', () => {
    const t = pair('l2-switch', 'l2-switch');
    t.setA({ mode: 'trunk', nativeVlan: 99 });
    t.setB({ mode: 'trunk', nativeVlan: 99 });
    expect(t.ids('VAL-008')).toHaveLength(0);
    t.setB({ nativeVlan: undefined });
    const [issue] = t.ids('VAL-008');
    expect(issue?.message).toMatch(/99/);
    if (issue?.fixes[0]) t.ed.execute(applyFix(issue.fixes[0]));
    expect(t.ids('VAL-008')).toHaveLength(0);
  });

  it('VAL-009 allowed VLAN difference', () => {
    const t = pair('l2-switch', 'l2-switch');
    t.setA({ mode: 'trunk', allowedVlans: '10,20,30' });
    t.setB({ mode: 'trunk', allowedVlans: '10,20' });
    const [issue] = t.ids('VAL-009');
    expect(issue?.message).toMatch(/only on SW1 Gi1\/0\/1: 30/);
    if (issue?.fixes[0]) t.ed.execute(applyFix(issue.fixes[0]));
    expect(t.ids('VAL-009')).toHaveLength(0);
    t.setA({ allowedVlans: '' });
    t.setB({ allowedVlans: '' });
    expect(t.ids('VAL-009')).toHaveLength(0);
  });

  it('VAL-010 access VLAN mismatch', () => {
    const t = pair('l2-switch', 'l2-switch');
    t.setA({ mode: 'access', accessVlan: 10 });
    t.setB({ mode: 'access', accessVlan: 10 });
    expect(t.ids('VAL-010')).toHaveLength(0);
    t.setB({ accessVlan: 20 });
    const [issue] = t.ids('VAL-010');
    expect(issue?.message).toMatch(/10.*20|20.*10/);
    if (issue?.fixes[0]) t.ed.execute(applyFix(issue.fixes[0]));
    expect(t.ids('VAL-010')).toHaveLength(0);
  });

  it('VAL-012 port-channel member consistency', () => {
    const t = pair('l2-switch', 'l2-switch');
    const sw = t.ed.doc.devices.find((d) => d.id === t.a);
    const members = sw?.interfaces.slice(0, 2).map((i) => i.id) as string[];
    t.ed.execute(connect({ deviceId: t.a }, { deviceId: t.b }));
    t.ed.execute(createPortChannel(t.a, 1, members));
    expect(t.ids('VAL-012')).toHaveLength(0);
    t.ed.execute(updateInterface(t.a, members[1] as string, { mode: 'access' }));
    expect(t.ids('VAL-012')[0]?.message).toMatch(/settings differ/);
  });

  it('VAL-012 port-channel members on different neighbors', () => {
    const t = pair('l2-switch', 'l2-switch');
    const c = addDevice({
      role: 'l2-switch',
      pageId: t.pageId,
      position: { x: 0, y: 0 },
      template: switchTemplate,
    });
    t.ed.execute(c);
    // Second member goes to a third switch instead of the same neighbor.
    t.ed.execute(connect({ deviceId: t.a }, { deviceId: c.deviceId }));
    const used = t.ed.doc.links
      .filter((l) => l.endpointA.deviceId === t.a)
      .map((l) => l.endpointA.interfaceId);
    t.ed.execute(createPortChannel(t.a, 2, used));
    expect(t.ids('VAL-012')[0]?.message).toMatch(/2 different neighbors/);
  });

  it('VAL-013 missing VLAN with a create fix', () => {
    const t = pair('l2-switch', 'l2-switch');
    t.setA({ mode: 'access', accessVlan: 30 });
    expect(t.ids('VAL-013')).toHaveLength(0); // no VLANs defined yet: not checked
    t.ed.execute(upsertVlan({ number: 10 }));
    const [issue] = t.ids('VAL-013');
    expect(issue?.message).toMatch(/VLAN 30/);
    if (issue?.fixes[0]) t.ed.execute(applyFix(issue.fixes[0]));
    expect(t.ids('VAL-013')).toHaveLength(0);
    t.setB({ vrfId: 'ghost' });
    expect(t.ids('VAL-013')[0]?.message).toMatch(/VRF/);
  });
});

describe('physical and inventory rules', () => {
  it('VAL-005 interface on two links', () => {
    const t = pair();
    expect(t.ids('VAL-005')).toHaveLength(0);
    const doc = structuredClone(t.ed.doc);
    const l = doc.links[0];
    if (!l) throw new Error('no link');
    doc.links.push({ ...l, id: 'dup-link' });
    const e = new Editor(doc);
    expect(validate(e.doc).issues.filter((i) => i.ruleId === 'VAL-005')).toHaveLength(2);
  });

  it('VAL-006 duplicate hostname', () => {
    const t = pair();
    expect(t.ids('VAL-006')).toHaveLength(0);
    t.ed.execute(updateDevices([t.b], { hostname: 'r1' }));
    expect(t.ids('VAL-006')).toHaveLength(1);
  });

  it('VAL-011 speed and duplex mismatch', () => {
    const t = pair();
    expect(t.ids('VAL-011')).toHaveLength(0);
    t.setA({ speedMbps: 100, duplex: 'full' });
    t.setB({ duplex: 'half' });
    expect(t.ids('VAL-011')[0]?.message).toMatch(/speed 100 vs 1000.*duplex full vs half/);
  });

  it('VAL-015 FHRP consistency', () => {
    const t = pair();
    t.ed.execute(assignIp(t.a, t.ia, '10.0.0.2', 24));
    t.ed.execute(assignIp(t.b, t.ib, '10.0.0.3', 24));
    t.setA({ fhrp: { protocol: 'hsrp', group: 1, vip: '10.0.0.1' } });
    t.setB({ fhrp: { protocol: 'hsrp', group: 1, vip: '10.0.0.1' } });
    expect(t.ids('VAL-015')).toHaveLength(0);
    t.setB({ fhrp: { protocol: 'hsrp', group: 2, vip: '10.0.0.254' } });
    expect(t.ids('VAL-015')[0]?.message).toMatch(/virtual IPs differ.*group differ/);
  });

  it('VAL-016 orphan, VAL-017 unlinked address, VAL-019 missing mgmt IP', () => {
    const t = pair();
    const orphan = addDevice({
      role: 'router',
      pageId: t.pageId,
      position: { x: 0, y: 0 },
      template: routerTemplate,
    });
    t.ed.execute(orphan);
    expect(t.ids('VAL-016').map((i) => i.objectIds[0])).toEqual([orphan.deviceId]);
    expect(t.ids('VAL-019').map((i) => i.objectIds[0])).toEqual([orphan.deviceId]);
    // Linked devices with a management IP are neither orphans nor missing one; a linked port's address is fine.
    expect(t.ids('VAL-016').map((i) => i.objectIds[0])).not.toContain(t.a);
    expect(t.ids('VAL-019').map((i) => i.objectIds[0])).not.toContain(t.a);
    t.ed.execute(assignIp(t.a, t.ia, '192.0.2.9', 24));
    expect(t.ids('VAL-017')).toHaveLength(0);
    const gi1 = t.ed.doc.devices.find((d) => d.id === orphan.deviceId)?.interfaces[1]?.id as string;
    t.ed.execute(assignIp(orphan.deviceId, gi1, '192.0.2.1', 24));
    expect(t.ids('VAL-017')).toHaveLength(1);
  });

  it('VAL-020 fiber to copper', () => {
    const t = pair();
    t.setA({ media: 'fiber' });
    t.setB({ media: 'fiber' });
    expect(t.ids('VAL-020')).toHaveLength(0);
    t.setB({ media: 'any' });
    expect(t.ids('VAL-020')).toHaveLength(0);
    t.setB({ media: 'copper' });
    expect(t.ids('VAL-020')).toHaveLength(1);
  });
});

describe('engine [FR-VAL-02, FR-VAL-05]', () => {
  it('disables rules and suppresses issues per document', () => {
    const t = pair();
    t.ed.execute(updateDevices([t.b], { hostname: 'R1' }));
    const issue = t.ids('VAL-006')[0];
    if (!issue) throw new Error('expected issue');
    t.ed.execute(
      updateSettings({
        suppressions: [{ ruleId: 'VAL-006', objectIds: issue.objectIds, reason: 'lab clone' }],
      }),
    );
    const r = validate(t.ed.doc);
    expect(r.issues.some((i) => i.ruleId === 'VAL-006')).toBe(false);
    expect(r.suppressed).toHaveLength(1);
    t.ed.execute(updateSettings({ disabledRules: ['VAL-019', 'VAL-016'] }));
    expect(validate(t.ed.doc).issues.some((i) => i.ruleId === 'VAL-019')).toBe(false);
  });

  it('sorts errors before warnings before info', () => {
    const t = pair();
    t.ed.execute(updateDevices([t.b], { hostname: 'R1', mgmtIp: '' }));
    t.ed.execute(assignIp(t.a, t.ia, '10.0.0.0', 24));
    const sev = validate(t.ed.doc).issues.map((i) => i.severity);
    expect(sev).toEqual(
      [...sev].sort(
        (x, y) => ['error', 'warning', 'info'].indexOf(x) - ['error', 'warning', 'info'].indexOf(y),
      ),
    );
  });

  it('validates 1,000 devices / 5,000+ interfaces in under 200 ms', () => {
    const ed = new Editor(createDocument('Big'));
    const pageId = ed.doc.pages[0]?.id as string;
    const cmds = Array.from({ length: 1000 }, (_, k) =>
      addDevice({
        role: 'l2-switch',
        pageId,
        position: { x: k, y: 0 },
        template: k % 2 ? switchTemplate : routerTemplate,
      }),
    );
    const doc = structuredClone(ed.doc);
    for (const c of cmds) c.run(doc as never);
    for (let k = 1; k < 1000; k++) {
      connect({ deviceId: doc.devices[k - 1]?.id as string }, { deviceId: doc.devices[k]?.id as string }).run(
        doc as never,
      );
    }
    const ifaceCount = doc.devices.reduce((n, d) => n + d.interfaces.length, 0);
    expect(ifaceCount).toBeGreaterThan(5000);
    validate(doc); // warm up
    const t0 = performance.now();
    validate(doc);
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
