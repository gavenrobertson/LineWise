// SPDX-License-Identifier: Apache-2.0
/** Auto-update (REL-10..12, NFR-SEC-06): when the app checks, what it shows, and that it never forces. */
import * as RTooltip from '@radix-ui/react-tooltip';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { updateDevices } from '@linewise/core';
import { STARTERS } from '@linewise/device-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateDialog } from '../src/dialogs/UpdateDialog.tsx';
import { checkUpdates } from '../src/lib/actions.ts';
import { platform, setPlatform, type PlatformAdapter, type UpdateInfo } from '../src/platform/index.ts';
import { useEditor } from '../src/store/editor.ts';
import { usePrefs } from '../src/store/prefs.ts';
import { useUi } from '../src/store/ui.ts';

const real = platform();
let check: ReturnType<typeof vi.fn<PlatformAdapter['checkForUpdates']>>;

function update(over: Partial<UpdateInfo> = {}): UpdateInfo {
  return { version: '1.1.0', notes: '- Faster layout', install: vi.fn(async () => {}), ...over };
}

beforeEach(() => {
  check = vi.fn<PlatformAdapter['checkForUpdates']>(async () => null);
  setPlatform({ ...real, kind: 'tauri', checkForUpdates: check });
  usePrefs.getState().set({ updateChecks: true, updateChannel: 'stable', lastUpdateCheck: null });
  useUi.setState({ dialog: null, toasts: [] });
  const doc = STARTERS.find((s) => s.id === 'ccna-lab')!.build();
  useEditor.getState().loadDocument(doc, { path: '/d/lab.lwise', name: 'lab.lwise' });
});
afterEach(() => setPlatform(real));

describe('REL-10 checking for updates', () => {
  it('checks on launch at most once per 24 hours, and Help → Check for updates always checks', async () => {
    await checkUpdates(false);
    expect(check).toHaveBeenCalledTimes(1);
    await checkUpdates(false);
    expect(check).toHaveBeenCalledTimes(1);
    usePrefs.getState().set({ lastUpdateCheck: new Date(Date.now() - 25 * 3600 * 1000).toISOString() });
    await checkUpdates(false);
    expect(check).toHaveBeenCalledTimes(2);
    await checkUpdates(true);
    expect(check).toHaveBeenCalledTimes(3);
    expect(useUi.getState().toasts.at(-1)?.message).toBe('LineWise is up to date.');
  });

  it('does not check on launch when update checks are off (NFR-PRIV-01)', async () => {
    usePrefs.getState().set({ updateChecks: false });
    await checkUpdates(false);
    expect(check).not.toHaveBeenCalled();
  });

  it('a failed automatic check is silent; a manual one says why', async () => {
    check.mockRejectedValue(new Error('offline'));
    await checkUpdates(false);
    expect(useUi.getState().toasts).toHaveLength(0);
    await checkUpdates(true);
    expect(useUi.getState().toasts.at(-1)?.message).toBe('Could not check for updates: offline');
  });

  it('shows the release notes and lets the user choose Install and restart or Later; Later installs nothing', async () => {
    const info = update();
    check.mockResolvedValue(info);
    await checkUpdates(false);
    const dialog = useUi.getState().dialog;
    expect(dialog).toMatchObject({ kind: 'update', info: { version: '1.1.0' } });
    render(
      <RTooltip.Provider>
        <UpdateDialog info={info} />
      </RTooltip.Provider>,
    );
    expect(screen.getByRole('dialog', { name: 'LineWise 1.1.0 is available' })).toBeInTheDocument();
    expect(screen.getByText('- Faster layout')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Install and restart' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(useUi.getState().dialog).toBeNull();
    expect(info.install).not.toHaveBeenCalled();
  });
});

describe('REL-11 update channels', () => {
  it('uses the stable feed unless the user opts into beta', async () => {
    await checkUpdates(true);
    usePrefs.getState().set({ updateChannel: 'beta' });
    await checkUpdates(true);
    expect(check.mock.calls.map((c) => c[0])).toEqual(['stable', 'beta']);
  });
});

describe('REL-12, NFR-SEC-06 installing', () => {
  it('saves unsaved work first, then installs', async () => {
    const order: string[] = [];
    const saveDiagram = vi.fn<PlatformAdapter['saveDiagram']>(async (_text, path, name) => {
      order.push('save');
      return { path: path ?? '/d/lab.lwise', name };
    });
    setPlatform({ ...platform(), saveDiagram });
    const r1 = useEditor.getState().doc.devices.find((d) => d.hostname === 'R1')!;
    act(() => void useEditor.getState().execute(updateDevices([r1.id], { hostname: 'EDGE1' })));
    const info = update({ install: vi.fn(async () => void order.push('install')) });
    render(
      <RTooltip.Provider>
        <UpdateDialog info={info} />
      </RTooltip.Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Install and restart' }));
    expect(order).toEqual(['save', 'install']);
    expect(saveDiagram.mock.calls[0]![0]).toContain('EDGE1');
  });

  it('a package that fails signature verification is not installed: the error is shown and the app keeps running', async () => {
    const info = update({
      install: vi.fn(async () => Promise.reject(new Error('signature verification failed'))),
    });
    render(
      <RTooltip.Provider>
        <UpdateDialog info={info} />
      </RTooltip.Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Install and restart' }));
    expect(useUi.getState().toasts.at(-1)).toMatchObject({
      message: 'Update failed: signature verification failed',
      kind: 'error',
    });
    expect(screen.getByRole('button', { name: 'Install and restart' })).toBeEnabled();
  });
});
