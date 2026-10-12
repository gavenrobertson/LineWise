// SPDX-License-Identifier: Apache-2.0
/**
 * Small accessible UI kit on Radix primitives (NFR-A11Y-01..04): real buttons,
 * labelled inputs, focus-trapped dialogs and tooltips that work with the keyboard.
 */
import * as RDialog from '@radix-ui/react-dialog';
import * as RPopover from '@radix-ui/react-popover';
import * as RTooltip from '@radix-ui/react-tooltip';
import { CircleHelp, ExternalLink, X } from 'lucide-react';
import i18n from '../i18n/index.ts';
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'lw-btn-lift bg-accent-fill text-accent-contrast hover:bg-accent-strong border-transparent shadow-elev-1',
  secondary: 'lw-btn-lift bg-surface text-ink border-line hover:bg-surface-2 hover:border-line-strong',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-surface-3',
  danger: 'lw-btn-lift bg-danger text-white border-transparent hover:opacity-90',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' }
>(function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'lw-btn inline-flex items-center justify-center gap-1.5 rounded-md border font-medium disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-[13px]',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    shortcut?: string;
    /** One line for controls whose icon does not say everything (FR-UX-08). */
    description?: string;
    active?: boolean;
    children: ReactNode;
  }
>(function IconButton(
  { label, shortcut, description, active, className, children, type = 'button', ...rest },
  ref,
) {
  const btn = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      className={cx(
        'lw-btn inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-ink hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40',
        active && 'bg-accent-soft text-accent-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
  return (
    <Tooltip text={label} shortcut={shortcut} description={description}>
      {btn}
    </Tooltip>
  );
});

/**
 * A shortcut as key caps: `Ctrl+Shift+Z` → Ctrl, Shift, Z; `⌘⇧Z` → ⌘, ⇧, Z (FR-UX-08).
 * Exported for tests.
 */
export function keyParts(formatted: string): string[] {
  if (!formatted) return [];
  const mods = formatted.match(/^[⌘⇧⌥⌃]+/)?.[0] ?? '';
  if (mods) return [...mods, formatted.slice(mods.length)].filter(Boolean);
  return formatted.split(/\+(?=.)/);
}

export function Keys({ shortcut, tone = 'light' }: { shortcut: string; tone?: 'light' | 'dark' }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {keyParts(shortcut).map((k, i) => (
        <kbd
          key={i}
          className={cx(
            'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] px-1 font-ui text-[11px] font-medium leading-none',
            tone === 'dark'
              ? 'bg-[color-mix(in_srgb,var(--surface)_18%,transparent)] text-surface'
              : 'border border-line bg-surface-2 text-muted shadow-[0_1px_0_var(--border)]',
          )}
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

/**
 * The one tooltip (FR-UX-08): a short label, the shortcut as key caps and an optional one-line
 * description. It shows on hover after the provider's delay, at once while moving between
 * controls, and on keyboard focus; Escape, scrolling or a press dismisses it. The tooltip only
 * adds to a control's accessible name, it never replaces it.
 */
export function Tooltip({
  text,
  shortcut,
  description,
  side = 'bottom',
  children,
}: {
  text: string;
  shortcut?: string;
  description?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
}) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          data-lw-tooltip=""
          className="lw-pop z-[80] max-w-72 rounded-lg bg-ink px-2.5 py-1.5 text-[12px] leading-snug text-surface shadow-elev-2"
        >
          <span className="flex items-center gap-3">
            <span className="font-medium">{text}</span>
            {shortcut && <Keys shortcut={shortcut} tone="dark" />}
          </span>
          {description && (
            <span className="mt-0.5 block text-[11.5px] text-[color-mix(in_srgb,var(--surface)_78%,transparent)]">
              {description}
            </span>
          )}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

/**
 * A rich hover card (FR-UX-09): the same timing as a tooltip, on a light material surface, for
 * details of a device, link, interface, subnet or problem. Its content is read-only text; whatever
 * it shows is also reachable without a pointer (inspector, outline, problems panel).
 */
export function HoverCard({
  content,
  side = 'top',
  align = 'center',
  children,
  delay,
}: {
  content: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  children: ReactNode;
  delay?: number;
}) {
  return (
    <RTooltip.Root delayDuration={delay ?? 350}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={8}
          data-lw-hovercard=""
          className="lw-pop lw-material z-[80] max-w-80 rounded-lg border border-line px-3 py-2.5 text-[12px] leading-snug text-ink shadow-elev-2"
        >
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

/** Label and value rows inside a hover card. */
export function CardRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="m-0 min-w-0 break-words font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  inline,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (id: string, describedBy?: string) => ReactNode;
  inline?: boolean;
}) {
  const id = useId();
  const descId = hint || error ? `${id}-desc` : undefined;
  return (
    <div className={cx(inline ? 'flex items-center justify-between gap-3' : 'flex flex-col gap-1')}>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      {children(id, descId)}
      {(error || hint) && (
        <p
          id={descId}
          role={error ? 'alert' : undefined}
          className={cx('text-xs', error ? 'text-danger' : 'text-subtle')}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}

const inputCls =
  'h-8 w-full rounded-md border border-line bg-surface px-2 text-[13px] text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft aria-[invalid=true]:border-danger';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...rest }, ref) {
    return <input ref={ref} className={cx(inputCls, className)} {...rest} />;
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx(inputCls, 'h-auto min-h-16 py-1.5', className)} {...rest} />;
  },
);

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputCls, 'pr-6', className)} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  id,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
}) {
  const auto = useId();
  const cid = id ?? auto;
  return (
    <label htmlFor={cid} className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink">
      <input
        id={cid}
        type="checkbox"
        className="h-4 w-4 accent-[var(--accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; title?: string; shortcut?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative inline-grid rounded-lg border border-line bg-surface-2 p-0.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {/* The selected thumb glides between equal-width options (FR-UX-02). */}
      <span
        aria-hidden="true"
        className="lw-thumb inset-y-0.5 left-0.5 rounded-md bg-surface shadow-elev-1"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o) => {
        const btn = (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cx(
              'lw-btn relative h-7 rounded-md px-2.5 text-xs font-medium',
              value === o.value ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
        return o.title ? (
          <Tooltip key={o.value} text={o.title} shortcut={o.shortcut}>
            {btn}
          </Tooltip>
        ) : (
          btn
        );
      })}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">
      {children}
    </kbd>
  );
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'error' | 'warning' | 'info' | 'accent';
  children: ReactNode;
}) {
  const tones = {
    neutral: 'bg-surface-3 text-muted',
    error: 'bg-danger-soft text-danger',
    warning: 'bg-warning-soft text-warning',
    info: 'bg-info-soft text-info',
    accent: 'bg-accent-soft text-accent-ink',
  };
  return (
    <span
      className={cx('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium', tones[tone])}
    >
      {children}
    </span>
  );
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 560,
  help,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  /** A help button beside the title (FR-UX-10). */
  help?: ReactNode;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="lw-overlay fixed inset-0 z-40 bg-[rgba(14,23,38,0.32)]" />
        <RDialog.Content
          className="lw-sheet fixed inset-0 z-50 m-auto flex h-fit max-h-[88vh] w-[calc(100vw-32px)] flex-col rounded-xl border border-line bg-surface shadow-elev-3"
          style={{ maxWidth: width }}
          aria-describedby={description ? undefined : undefined}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <div className="flex items-center gap-1.5">
                <RDialog.Title className="font-brand text-[15px] font-semibold text-ink">
                  {title}
                </RDialog.Title>
                {help}
              </div>
              {description ? (
                <RDialog.Description className="mt-0.5 text-xs text-muted">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <RDialog.Close asChild>
              <button
                type="button"
                aria-label={i18n.t('common.close', { defaultValue: 'Close' })}
                className="lw-btn rounded-full p-1 text-muted hover:bg-surface-3 hover:text-ink"
              >
                <X size={16} />
              </button>
            </RDialog.Close>
          </div>
          <ScrollBody label={title}>{children}</ScrollBody>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
          )}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/**
 * A dialog body that keyboard users can scroll: it becomes a focusable, labelled region only
 * while its content overflows (WCAG 2.1.1; axe "scrollable-region-focusable").
 */
function ScrollBody({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const check = () => setScrolls(el.scrollHeight > el.clientHeight + 1);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    for (const c of el.children) ro.observe(c);
    check();
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="min-h-0 flex-1 overflow-auto px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus)]"
      {...(scrolls ? { tabIndex: 0, role: 'region', 'aria-label': label } : {})}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-2 mt-4 flex items-center justify-between first:mt-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{children}</h3>
      {actions}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-6 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="text-xs text-muted">{children}</div>}
    </div>
  );
}

/**
 * A "?" button that opens a short explanation (FR-UX-10): what it is, why it matters, a tiny
 * example and a link to the user guide. Dismissed with Escape or a click outside; never blocks work.
 */
export function HelpPopover({
  title,
  what,
  why,
  example,
  onLearnMore,
}: {
  title: string;
  what: string;
  why: string;
  example?: string;
  onLearnMore?: () => void;
}) {
  return (
    <RPopover.Root>
      <Tooltip text={i18n.t('help.about', { defaultValue: 'About {{topic}}', topic: title })}>
        <RPopover.Trigger asChild>
          <button
            type="button"
            data-lw-help=""
            aria-label={i18n.t('help.about', { defaultValue: 'About {{topic}}', topic: title })}
            className="lw-btn inline-flex h-5 w-5 items-center justify-center rounded-full text-subtle hover:bg-surface-3 hover:text-accent-ink data-[state=open]:bg-accent-soft data-[state=open]:text-accent-ink"
          >
            <CircleHelp size={13} aria-hidden="true" />
          </button>
        </RPopover.Trigger>
      </Tooltip>
      <RPopover.Portal>
        <RPopover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="lw-pop lw-material z-[70] w-72 rounded-lg border border-line p-3 text-[12px] leading-snug text-ink shadow-elev-2"
        >
          <p className="text-[13px] font-semibold">{title}</p>
          <p className="mt-1">{what}</p>
          <p className="mt-1.5 text-muted">{why}</p>
          {example && (
            <p className="mt-2 rounded-md bg-surface-2 px-2 py-1 font-mono text-[11px] text-muted">
              {example}
            </p>
          )}
          {onLearnMore && (
            <button
              type="button"
              onClick={onLearnMore}
              className="lw-btn mt-2 inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-medium text-accent-ink hover:bg-accent-soft"
            >
              {i18n.t('help.learnMore', { defaultValue: 'Learn more in the user guide' })}
              <ExternalLink size={11} aria-hidden="true" />
            </button>
          )}
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}
