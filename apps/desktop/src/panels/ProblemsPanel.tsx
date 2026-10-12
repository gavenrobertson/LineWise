// SPDX-License-Identifier: Apache-2.0
/**
 * Problems panel (FR-VAL-01..03): issues from the validation worker, filter
 * by severity and rule, click to select the affected objects, one-click quick
 * fixes, and suppression with a reason stored in the document.
 */
import { applyFix, listRules, updateSettings, type Issue, type Severity } from '@linewise/core';
import { CircleAlert, CircleHelp, EyeOff, Info, TriangleAlert, Wand2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { canvasApi } from '../canvas/Canvas.tsx';
import { Button, cx, EmptyState, IconButton, Tooltip } from '../components/ui.tsx';
import { HelpButton } from '../components/HelpButton.tsx';
import { useEditor } from '../store/editor.ts';
import { useUi } from '../store/ui.ts';
import { ruleText, severityLabel } from '../lib/labels.ts';

const ICON = {
  error: <CircleAlert size={14} className="shrink-0 text-danger" aria-hidden="true" />,
  warning: <TriangleAlert size={14} className="shrink-0 text-warning" aria-hidden="true" />,
  info: <Info size={14} className="shrink-0 text-info" aria-hidden="true" />,
};

/** Select an issue's objects on the canvas: interfaces select their device. */
export function revealIssue(issue: Issue): void {
  const ed = useEditor.getState();
  const doc = ed.doc;
  const devices = new Set<string>();
  const links: string[] = [];
  for (const id of issue.objectIds) {
    if (doc.devices.some((d) => d.id === id)) devices.add(id);
    else if (doc.links.some((l) => l.id === id)) links.push(id);
    else {
      const owner = doc.devices.find((d) => d.interfaces.some((i) => i.id === id));
      if (owner) devices.add(owner.id);
    }
  }
  // Switch to the page holding the first device.
  const first = [...devices][0];
  if (first && !doc.pages.find((p) => p.id === ed.pageId)?.nodePositions[first]) {
    const home = doc.pages.find((p) => p.nodePositions[first]);
    if (home) ed.setPage(home.id);
  }
  useEditor.getState().setSelection({ devices: [...devices], links });
  requestAnimationFrame(() => canvasApi.focusOn([...devices]));
}

function issueKey(i: Issue): string {
  return `${i.ruleId}:${[...i.objectIds].sort().join(',')}`;
}

export function ProblemsPanel() {
  const { t } = useTranslation();
  const issues = useEditor((s) => s.issues);
  const suppressed = useEditor((s) => s.suppressed);
  const settings = useEditor((s) => s.doc.settings);
  const execute = useEditor((s) => s.execute);
  const readOnly = useEditor((s) => s.readOnly);
  const toggle = useUi((s) => s.toggle);
  const [sev, setSev] = useState<Set<Severity>>(new Set(['error', 'warning', 'info']));
  const [rule, setRule] = useState('');
  const [showSuppressed, setShowSuppressed] = useState(false);
  const [suppressing, setSuppressing] = useState<string | null>(null);
  const [explained, setExplained] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const rules = useMemo(() => listRules(), []);
  const counts = { error: 0, warning: 0, info: 0 } as Record<Severity, number>;
  for (const i of issues) counts[i.severity]++;
  const shown = (showSuppressed ? suppressed : issues).filter(
    (i) => sev.has(i.severity) && (!rule || i.ruleId === rule),
  );
  const ruleTitle = (id: string) => ruleText(id, 'title') || id;

  const suppress = (issue: Issue) => {
    execute(
      updateSettings({
        suppressions: [
          ...settings.suppressions,
          {
            ruleId: issue.ruleId,
            objectIds: issue.objectIds,
            reason: reason.trim() || t('problems.noReason', 'No reason given'),
          },
        ],
      }),
    );
    setSuppressing(null);
    setReason('');
  };
  const unsuppress = (issue: Issue) => {
    const k = issueKey(issue);
    execute(
      updateSettings({
        suppressions: settings.suppressions.filter(
          (s) => `${s.ruleId}:${[...s.objectIds].sort().join(',')}` !== k,
        ),
      }),
    );
  };

  return (
    <section
      aria-label={t('problems.title', 'Problems')}
      className="lw-no-print lw-panel-bottom flex h-56 shrink-0 flex-col border-t border-line bg-surface"
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3">
        <h2 className="font-brand text-[13px] font-semibold text-ink">{t('problems.title', 'Problems')}</h2>
        <HelpButton topic="problems" />
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t('problems.severityFilter', 'Severity filter')}
        >
          {(['error', 'warning', 'info'] as Severity[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sev.has(s)}
              onClick={() => {
                const n = new Set(sev);
                if (n.has(s)) n.delete(s);
                else n.add(s);
                setSev(n);
              }}
              className={cx(
                'inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11.5px]',
                sev.has(s) ? 'bg-surface-3 text-ink' : 'text-subtle',
              )}
            >
              {ICON[s]}
              {counts[s]}
              <span className="sr-only">{severityLabel(s)}</span>
            </button>
          ))}
        </div>
        <select
          aria-label={t('problems.ruleFilter', 'Rule filter')}
          className="h-6 rounded border border-line bg-surface px-1 text-[11.5px]"
          value={rule}
          onChange={(e) => setRule(e.target.value)}
        >
          <option value="">{t('problems.allRules', 'All rules')}</option>
          {rules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} · {r.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={showSuppressed}
          onClick={() => setShowSuppressed(!showSuppressed)}
          className={cx(
            'inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11.5px]',
            showSuppressed ? 'bg-surface-3 text-ink' : 'text-muted',
          )}
        >
          <EyeOff size={13} />
          {t('problems.suppressed', 'Suppressed ({{n}})', { n: suppressed.length })}
        </button>
        <div className="flex-1" />
        <IconButton
          label={t('problems.close', 'Close problems panel')}
          className="h-7 min-w-7"
          onClick={() => toggle('problemsOpen')}
        >
          <X size={14} />
        </IconButton>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        {shown.length === 0 && (
          <li>
            {showSuppressed ? (
              <EmptyState art="check" title={t('problems.noneSuppressed', 'No suppressed problems.')} />
            ) : issues.length ? (
              <EmptyState
                art="search"
                title={t('problems.filtered', 'No problems match the filters.')}
                action={{
                  label: t('problems.clearFilters', 'Show all problems'),
                  onClick: () => {
                    setSev(new Set(['error', 'warning', 'info']));
                    setRule('');
                  },
                }}
              />
            ) : (
              <EmptyState art="check" title={t('problems.none', 'No problems found. Nice network.')}>
                {t(
                  'problems.noneHint',
                  'LineWise checks addresses, subnets, VLANs, trunks and speeds as you draw.',
                )}
              </EmptyState>
            )}
          </li>
        )}
        {shown.map((issue, idx) => {
          const k = issueKey(issue);
          return (
            <li key={`${k}-${idx}`} className="group border-b border-line px-3 py-1.5 hover:bg-surface-2">
              <div className="flex items-start gap-2">
                <span className="mt-0.5">{ICON[issue.severity]}</span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => revealIssue(issue)}>
                  <span className="text-[12.5px] text-ink">{issue.message}</span>
                  <Tooltip text={ruleTitle(issue.ruleId)}>
                    <span className="ml-2 font-mono text-[10.5px] text-subtle">{issue.ruleId}</span>
                  </Tooltip>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-expanded={explained.has(k)}
                    aria-controls={`lw-why-${idx}`}
                    onClick={() => {
                      const next = new Set(explained);
                      if (next.has(k)) next.delete(k);
                      else next.add(k);
                      setExplained(next);
                    }}
                  >
                    <CircleHelp size={12} aria-hidden="true" />
                    {t('problems.why', 'Why?')}
                  </Button>
                  {!showSuppressed &&
                    !readOnly &&
                    issue.fixes.map((f, i) => (
                      <Tooltip
                        key={i}
                        text={f.label}
                        description={t('problems.fixHint', 'Apply this fix (undoable)')}
                      >
                        <Button size="sm" variant="primary" onClick={() => execute(applyFix(f))}>
                          <Wand2 size={12} />
                          {f.label}
                        </Button>
                      </Tooltip>
                    ))}
                  {showSuppressed ? (
                    <Button size="sm" variant="ghost" onClick={() => unsuppress(issue)}>
                      {t('problems.unsuppress', 'Unsuppress')}
                    </Button>
                  ) : (
                    !readOnly && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                        onClick={() => setSuppressing(suppressing === k ? null : k)}
                      >
                        {t('problems.suppress', 'Suppress…')}
                      </Button>
                    )
                  )}
                </div>
              </div>
              {explained.has(k) && (
                // What is wrong, why it matters and how to fix it (FR-UX-11).
                <div
                  id={`lw-why-${idx}`}
                  className="lw-rise ml-6 mt-1 rounded-md border border-line bg-surface-2 px-2.5 py-2 text-[12px] leading-snug"
                >
                  <p className="font-semibold text-ink">{ruleText(issue.ruleId, 'title')}</p>
                  <p className="mt-0.5 text-ink">{ruleText(issue.ruleId, 'why')}</p>
                  <p className="mt-1 text-muted">
                    <span className="font-medium text-ink">{t('problems.howToFix', 'How to fix:')}</span>{' '}
                    {issue.fixes.length && !readOnly
                      ? t('problems.useFix', 'Use {{fix}}, or: {{how}}', {
                          fix: issue.fixes[0]!.label,
                          how: ruleText(issue.ruleId, 'fix'),
                        })
                      : ruleText(issue.ruleId, 'fix')}
                  </p>
                </div>
              )}
              {suppressing === k && (
                <form
                  className="ml-6 mt-1 flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    suppress(issue);
                  }}
                >
                  <input
                    autoFocus
                    aria-label={t('problems.reason', 'Reason')}
                    placeholder={t('problems.reasonPlaceholder', 'Why is this OK? (saved in the diagram)')}
                    className="h-7 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-[12px]"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <Button size="sm" type="submit">
                    {t('problems.suppress2', 'Suppress')}
                  </Button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
