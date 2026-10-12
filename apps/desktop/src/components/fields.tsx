// SPDX-License-Identifier: Apache-2.0
/**
 * Inspector fields that commit on Enter or blur (one undo step per edit, not
 * per keystroke), revert on Escape, and show inline validation (FR-INS-04).
 * A `mixed` value renders as an empty field with a "Mixed" placeholder for
 * multi-select edits (FR-INS-02).
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { cx, Tooltip } from './ui.tsx';

export const MIXED = Symbol('mixed');
export type Maybe<T> = T | typeof MIXED;

/** Shared value of a field across items, or MIXED. */
export function shared<T, V>(items: T[], get: (x: T) => V): Maybe<V> {
  if (!items.length) return MIXED;
  const first = get(items[0] as T);
  return items.every((x) => Object.is(get(x), first)) ? first : MIXED;
}

const inputCls =
  'h-7 w-full rounded-md border border-line bg-surface px-2 text-[12.5px] text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft aria-[invalid=true]:border-danger';

interface RowProps {
  label: string;
  /** A one-sentence explanation of the networking term, shown from a small info button (FR-UX-10). */
  term?: string;
  error?: string | null;
  hint?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  wide?: boolean;
  /** Use this id for the control (e.g. #inspector-hostname) so the label stays associated. */
  id?: string;
}

export function Row({ label, term, error, hint, children, wide, id: forced }: RowProps) {
  const auto = useId();
  const id = forced ?? auto;
  const desc = error || hint ? `${id}-d` : undefined;
  return (
    <div className={cx('grid items-start gap-x-2 gap-y-0.5', wide ? 'grid-cols-1' : 'grid-cols-[96px_1fr]')}>
      <span className={cx('flex items-start gap-1', !wide && 'pt-1.5')}>
        <label htmlFor={id} className="text-[11.5px] text-muted">
          {label}
        </label>
        {term && <TermTip label={label} text={term} />}
      </span>
      <div className="min-w-0">
        {children(id, desc)}
        {(error || hint) && (
          <p
            id={desc}
            role={error ? 'alert' : undefined}
            className={cx('mt-0.5 text-[11px]', error ? 'text-danger' : 'text-subtle')}
          >
            {error || hint}
          </p>
        )}
      </div>
    </div>
  );
}

export function TextField({
  label,
  term,
  value,
  onCommit,
  validate,
  placeholder,
  hint,
  id: forcedId,
  multiline,
  mono,
  disabled,
}: {
  label: string;
  term?: string;
  value: Maybe<string>;
  onCommit: (v: string) => void;
  validate?: (v: string) => string | null;
  placeholder?: string;
  hint?: string;
  id?: string;
  multiline?: boolean;
  mono?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const initial = value === MIXED ? '' : value;
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial]);
  const error = validate && draft !== '' ? validate(draft) : null;
  const commit = () => {
    if (error) return;
    if (draft !== initial || (value === MIXED && draft !== '')) onCommit(draft);
  };
  return (
    <Row label={label} term={term} error={error} hint={hint} wide={multiline} id={forcedId}>
      {(id, desc) => {
        const common = {
          id,
          value: draft,
          disabled,
          placeholder: value === MIXED ? t('field.mixed', 'Mixed') : placeholder,
          'aria-invalid': !!error,
          'aria-describedby': desc,
          onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
          onBlur: commit,
        };
        return multiline ? (
          <textarea
            {...common}
            rows={3}
            className={cx(inputCls, 'h-auto py-1', mono && 'font-mono')}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setDraft(initial);
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
            }}
          />
        ) : (
          <input
            {...common}
            className={cx(inputCls, mono && 'font-mono')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setDraft(initial);
            }}
          />
        );
      }}
    </Row>
  );
}

export function NumberField({
  label,
  term,
  value,
  onCommit,
  min,
  max,
  placeholder,
  allowEmpty = true,
}: {
  label: string;
  term?: string;
  value: Maybe<number | undefined>;
  onCommit: (v: number | undefined) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <TextField
      label={label}
      term={term}
      value={value === MIXED ? MIXED : value === undefined ? '' : String(value)}
      placeholder={placeholder}
      mono
      validate={(v) => {
        if (v.trim() === '') return allowEmpty ? null : t('field.required', 'Required');
        const n = Number(v);
        if (!Number.isInteger(n)) return t('field.integer', 'Enter a whole number');
        if (min !== undefined && n < min) return t('field.min', 'Must be at least {{n}}', { n: min });
        if (max !== undefined && n > max) return t('field.max', 'Must be at most {{n}}', { n: max });
        return null;
      }}
      onCommit={(v) => onCommit(v.trim() === '' ? undefined : Number(v))}
    />
  );
}

export function SelectField<T extends string>({
  label,
  term,
  value,
  options,
  onCommit,
  allowNone,
}: {
  label: string;
  term?: string;
  value: Maybe<T | undefined>;
  options: { value: T; label: string }[];
  onCommit: (v: T | undefined) => void;
  allowNone?: string;
}) {
  const { t } = useTranslation();
  return (
    <Row label={label} term={term}>
      {(id) => (
        <select
          id={id}
          className={inputCls}
          value={value === MIXED ? '__mixed' : (value ?? '')}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '__mixed') return;
            onCommit(v === '' ? undefined : (v as T));
          }}
        >
          {value === MIXED && <option value="__mixed">{t('field.mixed', 'Mixed')}</option>}
          {allowNone !== undefined && <option value="">{allowNone}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Row>
  );
}

export function BoolField({
  label,
  term,
  value,
  onCommit,
}: {
  label: string;
  term?: string;
  value: Maybe<boolean>;
  onCommit: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-2">
      <span className="flex items-center gap-1">
        <label htmlFor={id} className="text-[11.5px] text-muted">
          {label}
        </label>
        {term && <TermTip label={label} text={term} />}
      </span>
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 accent-[var(--accent)]"
        checked={value === true}
        ref={(el) => {
          if (el) el.indeterminate = value === MIXED;
        }}
        onChange={(e) => onCommit(e.target.checked)}
      />
    </div>
  );
}

export function ColorField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: Maybe<string | undefined>;
  onCommit: (v: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const v = value === MIXED || !value ? '' : value;
  const [draft, setDraft] = useState(v);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setDraft(v), [v]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  // The native picker fires continuously while dragging; commit once it settles.
  const change = (next: string) => {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(next), 350);
  };
  return (
    <Row label={label}>
      {(id) => (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="color"
            value={draft || '#64748b'}
            onChange={(e) => change(e.target.value)}
            className="h-7 w-9 cursor-pointer rounded border border-line bg-surface p-0.5"
          />
          <span className="font-mono text-[11px] text-muted">
            {value === MIXED ? t('field.mixed', 'Mixed') : draft || t('field.default', 'Default')}
          </span>
          {v && (
            <button
              type="button"
              className="ml-auto text-[11px] text-muted underline hover:text-ink"
              onClick={() => onCommit(undefined)}
            >
              {t('field.reset', 'Reset')}
            </button>
          )}
        </div>
      )}
    </Row>
  );
}

/** A small info button whose tooltip explains a term (FR-UX-10); focusable, so keyboard users get it. */
export function TermTip({ label, text }: { label: string; text: string }) {
  const { t } = useTranslation();
  return (
    <Tooltip text={label} description={text} side="left">
      <button
        type="button"
        aria-label={t('help.whatIs', 'What is {{term}}?', { term: label })}
        className="lw-btn -m-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full p-0.5 text-subtle hover:bg-surface-3 hover:text-accent-ink"
      >
        <Info size={11} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
