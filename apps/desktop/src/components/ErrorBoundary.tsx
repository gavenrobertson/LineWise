// SPDX-License-Identifier: Apache-2.0
import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '../i18n/index.ts';
import { autosaveNow } from '../lib/actions.ts';

/**
 * What "Copy diagnostics" puts on the clipboard: version, user agent, the error and where it
 * happened. Nothing from the diagram, and nothing is sent anywhere (NFR-REL-02, NFR-PRIV-02).
 */
export function diagnostics(e: Error | null, componentStack: string): string {
  return [
    `LineWise ${import.meta.env.VITE_APP_VERSION ?? ''}`.trim(),
    `User agent: ${navigator.userAgent}`,
    `Error: ${e?.name ?? ''}: ${e?.message ?? ''}`,
    e?.stack ?? '',
    componentStack ? `Component stack:${componentStack}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Last-resort error screen (NFR-REL-02): a rendering crash never loses work —
 * a recovery copy is written first and the user can reload into it.
 */
const t = (key: string, defaultValue: string) => i18n.t(key, { defaultValue });

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; stack: string; copied: boolean }
> {
  override state = { error: null as Error | null, stack: '', copied: false };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('LineWise crashed', error, info.componentStack);
    this.setState({ stack: info.componentStack ?? '' });
    void autosaveNow();
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          display: 'grid',
          placeItems: 'center',
          height: '100%',
          padding: 24,
          fontFamily: 'var(--font-ui)',
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 18, margin: '0 0 8px' }}>
            {t('crash.title', 'Something went wrong')}
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 12px' }}>
            {t(
              'crash.body',
              'LineWise saved a recovery copy of your diagram. Reload to continue; the copy is offered on the welcome screen.',
            )}
          </p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: 12,
              background: 'var(--surface-2)',
              padding: 8,
              borderRadius: 6,
              maxHeight: 160,
              overflow: 'auto',
            }}
          >
            {this.state.error.message}
          </pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={() => location.reload()}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 0,
                background: 'var(--accent-fill)',
                color: 'var(--accent-contrast)',
                cursor: 'pointer',
              }}
            >
              {t('crash.reload', 'Reload')}
            </button>
            {/* Diagnostics stay on this machine: they are copied for the user to share, never sent. */}
            <button
              type="button"
              onClick={() => {
                const text = diagnostics(this.state.error, this.state.stack);
                void navigator.clipboard?.writeText(text).then(
                  () => this.setState({ copied: true }),
                  () => this.setState({ copied: false }),
                );
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-strong)',
                background: 'var(--surface)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              {this.state.copied
                ? t('crash.copied', 'Diagnostics copied')
                : t('crash.copyDiagnostics', 'Copy diagnostics')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
