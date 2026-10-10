// SPDX-License-Identifier: Apache-2.0
/** Component tests: behavior plus zero axe violations (spec section 10). */
import * as RTooltip from '@radix-ui/react-tooltip';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { applyFix, assignIp, validate, type NetworkDocument } from '@linewise/core';
import { STARTERS } from '@linewise/device-library';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AboutDialog } from '../src/dialogs/AboutDialog.tsx';
import { CalculatorDialog } from '../src/dialogs/CalculatorDialog.tsx';
import { CommandPalette } from '../src/dialogs/CommandPalette.tsx';
import { ConnectDialog } from '../src/dialogs/ConnectDialog.tsx';
import { ExportDialog } from '../src/dialogs/ExportDialog.tsx';
import { ImportDialog } from '../src/dialogs/ImportDialog.tsx';
import { IpamDialog } from '../src/dialogs/IpamDialog.tsx';
import { LayoutDialog } from '../src/dialogs/LayoutDialog.tsx';
import { PreferencesDialog } from '../src/dialogs/PreferencesDialog.tsx';
import { ShortcutsDialog } from '../src/dialogs/ShortcutsDialog.tsx';
import { TemplateEditorDialog } from '../src/dialogs/TemplateEditorDialog.tsx';
import { VlanDialog } from '../src/dialogs/VlanDialog.tsx';
import { WelcomeDialog } from '../src/dialogs/WelcomeDialog.tsx';
import { Inspector } from '../src/panels/Inspector.tsx';
import { ProblemsPanel } from '../src/panels/ProblemsPanel.tsx';
import { StatusBar } from '../src/panels/StatusBar.tsx';
import { Toolbar } from '../src/panels/Toolbar.tsx';
import { useKeyboard } from '../src/lib/keyboard.ts';
import { platform, setPlatform } from '../src/platform/index.ts';
import { useEditor } from '../src/store/editor.ts';
import { useUi } from '../src/store/ui.ts';

async function expectNoAxeViolations(root: Element = document.body): Promise<void> {
  const r = await axe.run(root, {
    rules: {
      // jsdom has no layout, so contrast cannot be computed here; it is covered by the Playwright pass.
      'color-contrast': { enabled: false },
      // Components are tested in isolation, outside the app's landmarks.
      region: { enabled: false },
    },
  });
  const msg = r.violations
    .map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`)
    .join('\n');
  expect(r.violations, msg).toEqual([]);
}

function wrap(ui: ReactNode) {
  return render(<RTooltip.Provider>{ui}</RTooltip.Provider>);
}

function load(doc: NetworkDocument) {
  act(() => {
    useEditor.getState().loadDocument(doc, { path: null, name: `${doc.name}.lwise` });
    const r = validate(doc);
    useEditor.getState().setIssues(useEditor.getState().rev, r.issues, r.suppressed);
  });
}

const starter = (id: string) => STARTERS.find((s) => s.id === id)!.build();

beforeEach(() => {
  load(starter('ccna-lab'));
  useUi.setState({ dialog: null, palette: false, toasts: [] });
});

describe('Inspector', () => {
  it('shows diagram settings with nothing selected, without a11y violations', async () => {
    wrap(<Inspector />);
    expect(screen.getAllByLabelText('Name')[0]).toHaveValue('CCNA lab');
    await expectNoAxeViolations();
  });

  it('edits a device hostname on Enter as one undo step', async () => {
    const r1 = useEditor.getState().doc.devices.find((d) => d.hostname === 'R1')!;
    act(() => useEditor.getState().setSelection({ devices: [r1.id] }));
    wrap(<Inspector />);
    const field = screen.getByLabelText('Hostname');
    await userEvent.clear(field);
    await userEvent.type(field, 'HQ-R1{Enter}');
    expect(useEditor.getState().doc.devices.find((d) => d.id === r1.id)?.hostname).toBe('HQ-R1');
    act(() => useEditor.getState().undo());
    expect(useEditor.getState().doc.devices.find((d) => d.id === r1.id)?.hostname).toBe('R1');
  });

  it('shows inline errors for invalid input (FR-INS-04)', async () => {
    const r1 = useEditor.getState().doc.devices.find((d) => d.hostname === 'R1')!;
    act(() => useEditor.getState().setSelection({ devices: [r1.id] }));
    wrap(<Inspector />);
    const mgmt = screen.getByLabelText('Mgmt IP');
    await userEvent.clear(mgmt);
    await userEvent.type(mgmt, '10.0.0.999');
    expect(screen.getByRole('alert')).toHaveTextContent('Not a valid IPv4 or IPv6 address');
    expect(mgmt).toHaveAttribute('aria-invalid', 'true');
    await expectNoAxeViolations();
  });

  it('edits many devices at once (FR-INS-02)', async () => {
    const ids = useEditor.getState().doc.devices.map((d) => d.id);
    act(() => useEditor.getState().setSelection({ devices: ids }));
    wrap(<Inspector />);
    expect(screen.getByText(`${ids.length} devices`)).toBeInTheDocument();
    const site = screen.getByLabelText('Site');
    await userEvent.type(site, 'Lab{Enter}');
    expect(useEditor.getState().doc.devices.every((d) => d.site === 'Lab')).toBe(true);
  });

  it('expands an interface and assigns an address', async () => {
    const r1 = useEditor.getState().doc.devices.find((d) => d.hostname === 'R1')!;
    const free = r1.interfaces.find((i) => i.ipv4.length === 0 && i.type !== 'loopback')!;
    act(() => useEditor.getState().setSelection({ devices: [r1.id] }));
    wrap(<Inspector />);
    await userEvent.click(
      screen.getByRole('button', { name: new RegExp(`^${free.shortName.replace('/', '\\/')},`) }),
    );
    const ip = screen.getByLabelText('IPv4');
    await userEvent.type(ip, '172.16.9.1/24{Enter}');
    const after = useEditor
      .getState()
      .doc.devices.find((d) => d.id === r1.id)!
      .interfaces.find((i) => i.id === free.id)!;
    expect(after.ipv4[0]).toMatchObject({ address: '172.16.9.1', prefix: 24 });
    await expectNoAxeViolations();
  });
});

describe('Problems panel', () => {
  it('lists issues and applies a quick fix', async () => {
    const doc = useEditor.getState().doc;
    const link = doc.links[0]!;
    act(() => {
      useEditor
        .getState()
        .execute(assignIp(link.endpointB.deviceId, link.endpointB.interfaceId, '192.168.200.2', 30));
      useEditor
        .getState()
        .execute(assignIp(link.endpointA.deviceId, link.endpointA.interfaceId, '10.99.0.1', 30));
      const r = validate(useEditor.getState().doc);
      useEditor.getState().setIssues(useEditor.getState().rev, r.issues, r.suppressed);
    });
    wrap(<ProblemsPanel />);
    const item = screen.getAllByRole('listitem').find((li) => li.textContent?.includes('VAL-002'))!;
    expect(item).toBeTruthy();
    await expectNoAxeViolations();
    const fix = within(item).getByRole('button', { name: /^Set / });
    const issue = useEditor.getState().issues.find((i) => i.ruleId === 'VAL-002')!;
    expect(issue.fixes[0]).toBeTruthy();
    await userEvent.click(fix);
    const r = validate(useEditor.getState().doc);
    expect(r.issues.filter((i) => i.ruleId === 'VAL-002')).toHaveLength(0);
    expect(applyFix).toBeTypeOf('function');
  });

  it('suppresses an issue with a reason stored in the document', async () => {
    act(() => {
      const r = validate(useEditor.getState().doc);
      useEditor.getState().setIssues(useEditor.getState().rev, r.issues, r.suppressed);
    });
    const before = useEditor.getState().issues.length;
    if (!before) return;
    wrap(<ProblemsPanel />);
    const first = screen.getAllByRole('listitem')[0]!;
    await userEvent.click(within(first).getByRole('button', { name: 'Suppress…' }));
    await userEvent.type(screen.getByLabelText('Reason'), 'Known lab quirk{Enter}');
    expect(useEditor.getState().doc.settings.suppressions[0]?.reason).toBe('Known lab quirk');
  });
});

describe('Chrome', () => {
  it('toolbar and status bar have no a11y violations', async () => {
    wrap(
      <>
        <Toolbar />
        <StatusBar />
      </>,
    );
    expect(screen.getByRole('toolbar', { name: 'Main toolbar' })).toBeInTheDocument();
    await expectNoAxeViolations();
  });

  it('switches network views from the toolbar', async () => {
    wrap(<Toolbar />);
    await userEvent.click(screen.getByRole('radio', { name: 'L3' }));
    expect(useEditor.getState().layer).toBe('l3');
  });
});

describe('Dialogs', () => {
  const r1 = () => useEditor.getState().doc.devices.find((d) => d.hostname === 'R1')!.id;
  const r2 = () => useEditor.getState().doc.devices.find((d) => d.hostname === 'R2')!.id;
  const cases: [string, () => ReactNode][] = [
    ['welcome', () => <WelcomeDialog />],
    ['export', () => <ExportDialog />],
    ['vlans', () => <VlanDialog />],
    ['ipam', () => <IpamDialog />],
    ['calculator', () => <CalculatorDialog />],
    ['preferences', () => <PreferencesDialog />],
    ['shortcuts', () => <ShortcutsDialog />],
    ['about', () => <AboutDialog />],
    ['layout', () => <LayoutDialog />],
    ['template editor', () => <TemplateEditorDialog />],
    ['import', () => <ImportDialog />],
    ['connect', () => <ConnectDialog sourceId={r1()} targetId={r2()} />],
    ['link from focused', () => <ConnectDialog sourceId={r1()} />],
  ];
  for (const [name, el] of cases) {
    it(`${name} dialog has a title and no a11y violations`, async () => {
      wrap(el());
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveAccessibleName();
      await expectNoAxeViolations();
    });
  }

  it('about dialog shows the bundled third-party notices offline (OSS-03)', async () => {
    const original = globalThis.fetch;
    const requested: string[] = [];
    globalThis.fetch = ((url: string) => {
      requested.push(url);
      return Promise.resolve(new Response('# Third-party notices\n- react 19 — MIT'));
    }) as typeof fetch;
    try {
      wrap(<AboutDialog />);
      await userEvent.click(screen.getByRole('button', { name: 'Licenses' }));
      expect(await screen.findByLabelText('Third-party notices')).toHaveTextContent('react 19 — MIT');
      expect(requested).toEqual(['./THIRD_PARTY_NOTICES.md']);
      await expectNoAxeViolations();
    } finally {
      globalThis.fetch = original;
    }
  });

  it('calculator answers subnet questions', async () => {
    wrap(<CalculatorDialog />);
    const input = screen.getByLabelText('Address and prefix or mask');
    fireEvent.change(input, { target: { value: '192.168.1.130/26' } });
    expect(screen.getByText('192.168.1.128/26')).toBeInTheDocument();
    expect(screen.getByText('255.255.255.192')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.190')).toBeInTheDocument();
  });

  it('VLAN manager adds a VLAN and rejects duplicates', async () => {
    wrap(<VlanDialog />);
    const id = screen.getByLabelText('VLAN ID');
    await userEvent.type(id, '300');
    await userEvent.type(screen.getAllByLabelText('Name')[0]!, 'Guests');
    await userEvent.click(screen.getByRole('button', { name: 'Add VLAN' }));
    expect(useEditor.getState().doc.vlans.some((v) => v.number === 300 && v.name === 'Guests')).toBe(true);
    await userEvent.type(screen.getByLabelText('VLAN ID'), '300');
    await userEvent.click(screen.getByRole('button', { name: 'Add VLAN' }));
    expect(screen.getByRole('alert')).toHaveTextContent('already exists');
  });

  it('import dialog detects pasted CLI output and previews the merge', async () => {
    wrap(
      <ImportDialog
        initialText={
          'R9#show ip interface brief\nInterface              IP-Address      OK? Method Status                Protocol\nGigabitEthernet0/0     10.9.9.1        YES manual up                    up\n'
        }
      />,
    );
    expect(await screen.findByText(/Auto: IP interface brief/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.getByText('R9')).toBeInTheDocument();
    await expectNoAxeViolations();
  });
});

describe('Keyboard', () => {
  function Shortcuts() {
    useKeyboard();
    return null;
  }

  it('Ctrl/Cmd+S in a text field commits the edit and saves (FR-KEY-01)', async () => {
    const saves: string[] = [];
    const real = platform();
    setPlatform({
      ...real,
      saveDiagram: async (text, path, name) => {
        saves.push(text);
        return { path: path ?? `/tmp/${name}`, name };
      },
    });
    try {
      const r1 = useEditor.getState().doc.devices.find((d) => d.hostname === 'R1')!;
      act(() => useEditor.getState().setSelection({ devices: [r1.id] }));
      wrap(
        <>
          <Shortcuts />
          <Inspector />
        </>,
      );
      const field = screen.getByLabelText('Hostname');
      await userEvent.clear(field);
      await userEvent.type(field, 'CORE-1');
      await userEvent.keyboard('{Control>}s{/Control}');
      await act(() => new Promise((r) => setTimeout(r, 20)));
      expect(useEditor.getState().doc.devices.find((d) => d.id === r1.id)?.hostname).toBe('CORE-1');
      expect(saves).toHaveLength(1);
      expect(saves[0]).toContain('"hostname": "CORE-1"');
    } finally {
      setPlatform(real);
    }
  });

  it('plain keys typed in a field never trigger canvas shortcuts', async () => {
    const r1 = useEditor.getState().doc.devices.find((d) => d.hostname === 'R1')!;
    act(() => useEditor.getState().setSelection({ devices: [r1.id] }));
    wrap(
      <>
        <Shortcuts />
        <Inspector />
      </>,
    );
    await userEvent.type(screen.getByLabelText('Hostname'), 'l');
    expect(useUi.getState().dialog).toBeNull();
  });
});

describe('Command palette', () => {
  it('finds commands and devices and runs the choice', async () => {
    act(() => useUi.getState().setPalette(true));
    wrap(<CommandPalette />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'L3');
    expect(screen.getAllByRole('option').some((o) => o.textContent?.includes('Network view (L3)'))).toBe(
      true,
    );
    await expectNoAxeViolations();
    await userEvent.clear(input);
    await userEvent.type(input, 'network view (l3){Enter}');
    expect(useEditor.getState().layer).toBe('l3');
    expect(useUi.getState().palette).toBe(false);
  });
});
