// SPDX-License-Identifier: Apache-2.0
/** The LineWise "Routed L" mark (spec section 15), drawn from the brand master. */
export function BrandMark({ size = 24, title }: { size?: number; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="64" height="64" rx="14" fill="#0E1726" />
      <path
        d="M20 22V44H38"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="12" y="9" width="16" height="15" rx="4" fill="#FFFFFF" />
      <circle cx="45" cy="44" r="8.5" fill="#0D9488" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{ fontFamily: 'var(--font-brand)', fontWeight: 600, letterSpacing: '-0.01em' }}
    >
      Line<span style={{ color: 'var(--accent)' }}>Wise</span>
    </span>
  );
}
