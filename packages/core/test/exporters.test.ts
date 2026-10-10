// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  addDevice,
  addZone,
  assignIp,
  connect,
  csvEscape,
  exportContainerlab,
  exportDevicesCsv,
  exportDot,
  exportDrawio,
  exportHtmlReport,
  exportInterfacesCsv,
  exportIpPlanCsv,
  exportLinksCsv,
  exportMarkdownReport,
  exportMermaid,
  exportPortMapCsv,
  updateDevices,
  upsertSubnet,
  upsertVlan,
  validate,
} from '../src/index.ts';
import { newEditor, routerTemplate, switchTemplate, useDeterminism } from './helpers.ts';

useDeterminism();

function sample() {
  const { ed, pageId } = newEditor();
  const r = addDevice({
    role: 'router',
    pageId,
    position: { x: 100, y: 0 },
    template: routerTemplate,
    fields: { mgmtIp: '10.0.0.1', model: 'ISR4331' },
  });
  const s = addDevice({ role: 'l2-switch', pageId, position: { x: 100, y: 200 }, template: switchTemplate });
  ed.execute(r);
  ed.execute(s);
  ed.execute(addZone(pageId, 'HQ', 'site', { x: 0, y: -50, w: 300, h: 320 }));
  const c = connect({ deviceId: r.deviceId }, { deviceId: s.deviceId }, 'fiber-sm', { label: '10G' });
  ed.execute(c);
  const rIf = ed.doc.links[0]?.endpointA.interfaceId as string;
  ed.execute(assignIp(r.deviceId, rIf, '10.10.0.1', 24));
  const v = upsertVlan({ number: 10, name: 'Users' });
  ed.execute(v);
  ed.execute(upsertSubnet({ cidr: '10.10.0.0/24', name: 'Users', vlanId: v.vlanId, gatewayIp: '10.10.0.1' }));
  ed.execute(updateDevices([s.deviceId], { notes: '=HYPERLINK("http://evil")' }));
  return { doc: ed.doc, pageId };
}

describe('CSV exports [FR-EXP-04]', () => {
  it('escapes quotes, commas, newlines and formula injection', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('=1+1')).toBe("'=1+1");
    expect(csvEscape(undefined)).toBe('');
  });

  it('exports devices, interfaces, links, IP plan and port map', () => {
    const { doc } = sample();
    const devices = exportDevicesCsv(doc).split('\r\n');
    expect(devices[0]).toMatch(/^hostname,role,vendor,model/);
    expect(devices[1]).toMatch(/^R1,router,,ISR4331,,,,,10\.0\.0\.1/);
    expect(exportDevicesCsv(doc)).toContain(`'=HYPERLINK`);
    expect(exportInterfacesCsv(doc).split('\r\n')).toHaveLength(1 + 4 + 28 + 1);
    expect(exportLinksCsv(doc)).toContain('R1,GigabitEthernet0/0,SW1,GigabitEthernet1/0/1,fiber-sm,,10G');
    const plan = exportIpPlanCsv(doc);
    expect(plan).toContain('10.10.0.0/24,Users,10,10.10.0.1,<1%,10.10.0.1,R1,GigabitEthernet0/0,gateway');
    expect(exportPortMapCsv(doc)).toContain('R1,GigabitEthernet0/0,,routed,SW1,GigabitEthernet1/0/1');
  });

  it('lists addresses outside declared subnets as undeclared', () => {
    const { doc } = sample();
    const d = structuredClone(doc);
    d.devices[0]?.interfaces[1]?.ipv4.push({ address: '192.0.2.5', prefix: 24, secondary: false });
    expect(exportIpPlanCsv(d)).toContain('192.0.2.0/24,(undeclared),,,,192.0.2.5,R1,GigabitEthernet0/1,');
  });
});

describe('reports [FR-EXP-05]', () => {
  it('renders Markdown and self-contained HTML with all sections', () => {
    const { doc } = sample();
    const issues = validate(doc).issues;
    const md = exportMarkdownReport(doc, {
      issues,
      generatedAt: '2026-10-09',
      imageDataUrl: 'data:image/png;base64,AAAA',
    });
    for (const h of ['## Device inventory', '## Links', '## IP plan', '## VLANs', '## Validation'])
      expect(md).toContain(h);
    expect(md).toContain('![Test](data:image/png;base64,AAAA)');
    const html = exportHtmlReport(doc, { issues, imageDataUrl: 'data:image/png;base64,AAAA' });
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<h2>IP plan</h2>');
    expect(html).not.toMatch(/<script|<link |https?:\/\//);
    const evil = structuredClone(doc);
    if (evil.devices[0]) evil.devices[0].hostname = '<img src=x onerror=alert(1)>';
    expect(exportHtmlReport(evil)).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('diagram exports [FR-EXP-06..08]', () => {
  it('writes draw.io XML with shapes, zones and labelled links', () => {
    const { doc, pageId } = sample();
    const xml = exportDrawio(doc, pageId);
    expect(xml).toMatch(/^<mxfile host="LineWise">/);
    expect(xml).toContain('shape=mxgraph.cisco.routers.router');
    expect(xml).toContain('value="HQ"');
    expect(xml).toContain('value="Gi0/0 - Gi1/0/1"');
    expect(xml).toContain('strokeColor=#EA580C');
  });

  it('writes Containerlab, Mermaid and DOT', () => {
    const { doc } = sample();
    const clab = exportContainerlab(doc);
    expect(clab).toContain('name: Test');
    expect(clab).toContain('- endpoints: ["R1:eth1", "SW1:eth1"]  # Gi0/0 ↔ Gi1/0/1');
    expect(exportMermaid(doc)).toMatch(/^graph LR\n/);
    expect(exportMermaid(doc)).toContain('---|"Gi0/0 – Gi1/0/1"|');
    expect(exportDot(doc)).toContain('taillabel="Gi0/0", headlabel="Gi1/0/1"');
  });
});
