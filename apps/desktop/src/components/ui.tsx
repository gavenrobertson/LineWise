// SPDX-License-Identifier: Apache-2.0
/**
 * Small accessible UI kit on Radix primitives (NFR-A11Y-01..04): real buttons,
 * labelled inputs, focus-trapped dialogs and tooltips that work with the keyboard.
 */
import * as RDialog from '@radix-ui/react-dialog';
import * as RTooltip from '@radix-ui/react-tooltip';
import { X } from 'lucide-react';
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
  primary: 'bg-accent-fill text-accent-contrast hover:bg-accent-strong border-transparent',
  secondary: 'bg-surface text-ink border-line hover:bg-surface-2',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-surface-3',
  danger: 'bg-danger text-white border-transparent hover:opacity-90',
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
        'inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
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
    active?: boolean;
    children: ReactNode;
  }
>(function IconButton({ label, shortcut, active, className, children, type = 'button', ...rest }, ref) {
  const btn = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      className={cx(
        'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-ink transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40',
        active && 'bg-accent-soft text-accent-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
  return (
    <Tooltip text={label} shortcut={shortcut}>
      {btn}
    </Tooltip>
  );
});

export function Tooltip({
  text,
  shortcut,
  children,
}: {
  text: string;
  shortcut?: string;
  children: ReactNode;
}) {
  return (
    <RTooltip.Root delayDuration={400}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side="bottom"
          sideOffset={6}
          className="z-50 rounded-md bg-ink px-2 py-1 text-xs text-surface shadow"
        >
          {text}
          {shortcut && <span className="ml-2 font-mono opacity-70">{shortcut}</span>}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
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
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-md border border-line bg-surface-2 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-7 rounded px-2.5 text-xs font-medium transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" />
        <RDialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface shadow-[var(--shadow)]"
          style={{ maxWidth: width }}
          aria-describedby={description ? undefined : undefined}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <RDialog.Title className="font-brand text-[15px] font-semibold text-ink">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-0.5 text-xs text-muted">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <RDialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="rounded-md p-1 text-muted hover:bg-surface-3 hover:text-ink"
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
