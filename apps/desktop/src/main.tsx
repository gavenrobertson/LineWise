// SPDX-License-Identifier: Apache-2.0
import '@xyflow/react/dist/base.css';
import '@linewise/brand/fonts/fonts.css';
import './styles.css';
import i18n from './i18n/index.ts';
import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { autosaveNow } from './lib/actions.ts';

/**
 * Last-resort error screen (NFR-REL-02): a rendering crash never loses work —
 * a recovery copy is written first and the user can reload into it.
 */
const t = (key: string, defaultValue: string) => i18n.t(key, { defaultValue });

class ErrorBoundary extends Component<
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
                const e = this.state.error;
                const text = [
                  `LineWise ${import.meta.env.VITE_APP_VERSION ?? ''}`.trim(),
                  `User agent: ${navigator.userAgent}`,
                  `Error: ${e?.name ?? ''}: ${e?.message ?? ''}`,
                  e?.stack ?? '',
                  this.state.stack ? `Component stack:${this.state.stack}` : '',
                ]
                  .filter(Boolean)
                  .join('\n');
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

// Read-only state access for automated tests in the browser build (never in the desktop app).
if (!('__TAURI_INTERNALS__' in window) && (import.meta.env.DEV || navigator.webdriver)) {
  void Promise.all([import('./store/editor.ts'), import('@linewise/core')]).then(([{ useEditor }, core]) => {
    (window as unknown as { __lwTest: unknown }).__lwTest = {
      doc: () => useEditor.getState().doc,
      issues: () => useEditor.getState().issues,
      serialize: () => core.serializeDocument(useEditor.getState().doc),
      dirty: () => useEditor.getState().rev !== useEditor.getState().savedRev,
      /**
       * Switch to a pseudo-locale with every string 40% longer and accented (NFR-I18N-02), added
       * at run time like any new language file, to check the layout and that no text bypasses i18n.
       */
      pseudoLocale: async () => {
        const en = i18n.getResourceBundle('en', 'translation') as Record<string, string>;
        const accent: Record<string, string> = {
          a: 'á',
          e: 'é',
          i: 'í',
          o: 'ó',
          u: 'ú',
          A: 'Á',
          E: 'É',
          O: 'Ó',
        };
        const pseudo = Object.fromEntries(
          Object.entries(en).map(([k, v]) => {
            const parts = v.split(/(\{\{[^}]+\}\})/);
            const body = parts
              .map((p) => (p.startsWith('{{') ? p : p.replace(/[aeiouAEO]/g, (c) => accent[c] ?? c)))
              .join('');
            return [k, `${body}${'~'.repeat(Math.ceil(v.length * 0.4))}`];
          }),
        );
        i18n.addResourceBundle('en-XA', 'translation', pseudo, true, true);
        await i18n.changeLanguage('en-XA');
      },
    };
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
