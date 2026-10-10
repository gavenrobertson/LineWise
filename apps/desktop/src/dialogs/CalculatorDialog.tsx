// SPDX-License-Identifier: Apache-2.0
/** Subnet calculator (FR-NET-07): IPv4 and IPv6, mask ↔ prefix, and equal splits of a block. */
import { maskToPrefix, prefixToMask, splitEqual, subnetInfo, type SubnetInfo } from '@linewise/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Field, TextInput } from '../components/ui.tsx';
import { formatNumber } from '../i18n/index.ts';
import { useUi } from '../store/ui.ts';

/** Accepts "10.1.2.3/26", "10.1.2.3 255.255.255.192", "10.1.2.3 /26" or "2001:db8::/48". */
export function parseCalcInput(v: string): string {
  const s = v.trim().replace(/\s*\/\s*/, '/');
  const parts = s.split(/\s+/);
  if (parts.length === 2 && parts[1]?.includes('.')) return `${parts[0]}/${maskToPrefix(parts[1])}`;
  if (!s.includes('/')) return `${s}/${s.includes(':') ? 128 : 32}`;
  return s;
}

function fmtBig(n: bigint): string {
  return n < 10n ** 15n ? formatNumber(Number(n)) : `2^${n.toString(2).length - 1}`;
}

export function CalculatorDialog() {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const [input, setInput] = useState('192.168.10.37/26');
  const [count, setCount] = useState('4');
  let info: SubnetInfo | null = null;
  let err: string | null = null;
  try {
    info = subnetInfo(parseCalcInput(input));
  } catch (e) {
    err = (e as Error).message;
  }
  let split: string[] = [];
  let splitErr: string | null = null;
  const n = Number(count);
  if (info && Number.isInteger(n) && n > 1) {
    try {
      split = splitEqual(info.cidr, Math.min(n, 256));
    } catch (e) {
      splitErr = (e as Error).message;
    }
  }
  const rows: [string, string | null][] = info
    ? [
        [t('calc.network', 'Network'), info.cidr],
        [t('calc.mask', 'Mask'), info.mask],
        [t('calc.wildcard', 'Wildcard'), info.wildcard],
        [t('calc.broadcast', 'Broadcast'), info.broadcast],
        [t('calc.first', 'First usable'), info.firstUsable],
        [t('calc.last', 'Last usable'), info.lastUsable],
        [t('calc.hosts', 'Usable hosts'), fmtBig(info.hosts)],
        [t('calc.size', 'Addresses'), fmtBig(info.size)],
      ]
    : [];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={t('calc.title', 'Subnet calculator')}
      width={600}
      footer={<Button onClick={close}>{t('common.done', 'Done')}</Button>}
    >
      <div className="flex flex-col gap-4">
        <Field
          label={t('calc.input', 'Address and prefix or mask')}
          error={err}
          hint={t('calc.hint', 'e.g. 10.0.0.5/24, 10.0.0.5 255.255.255.0, 2001:db8::/48')}
        >
          {(id, d) => (
            <TextInput
              id={id}
              aria-describedby={d}
              aria-invalid={!!err}
              className="font-mono"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
          )}
        </Field>
        {info && (
          <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-1 rounded-lg bg-surface-2 p-3 text-[13px]">
            {rows
              .filter(([, v]) => v !== null)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-mono text-ink">{v}</dd>
                </div>
              ))}
          </dl>
        )}
        {info?.family === 4 && (
          <p className="text-xs text-muted">
            {t('calc.convert', '/{{p}} = {{m}}', { p: info.prefix, m: prefixToMask(info.prefix) })}
          </p>
        )}
        {info && (
          <div>
            <Field label={t('calc.split', 'Split into equal subnets')} error={splitErr}>
              {(id) => (
                <TextInput
                  id={id}
                  className="w-24 font-mono"
                  inputMode="numeric"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              )}
            </Field>
            {split.length > 0 && (
              <ol className="mt-2 grid max-h-48 grid-cols-2 gap-x-4 overflow-y-auto font-mono text-[12.5px] sm:grid-cols-3">
                {split.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
