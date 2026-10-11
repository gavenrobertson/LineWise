// SPDX-License-Identifier: Apache-2.0
import full from '@linewise/brand/svg/app-icon.svg?raw';
import small from '@linewise/brand/svg/app-icon-small.svg?raw';

const url = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;
const FULL = url(full);
const NO_GRID = url(full.replace(/\s*<rect id="grid-layer"[^>]*\/>/, ''));
const SMALL = url(small);

/** The brand master for a rendered size (spec section 15, size rules; BRD-04). */
export const markFor = (size: number) => (size <= 32 ? SMALL : size < 96 ? NO_GRID : FULL);

/** The LineWise "Routed L" mark (spec section 15), drawn from the brand masters. */
export function BrandMark({ size = 24, title }: { size?: number; title?: string }) {
  return (
    <img
      src={markFor(size)}
      width={size}
      height={size}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      draggable={false}
    />
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{ fontFamily: 'var(--font-brand)', fontWeight: 600, letterSpacing: '-0.03em' }}
    >
      Line<span style={{ color: 'var(--accent)' }}>Wise</span>
    </span>
  );
}
