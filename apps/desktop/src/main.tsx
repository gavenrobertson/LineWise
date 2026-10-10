// SPDX-License-Identifier: Apache-2.0
import '@xyflow/react/dist/base.css';
import '@linewise/brand/fonts/fonts.css';
import './styles.css';
import './i18n/index.ts';
import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { autosaveNow } from './lib/actions.ts';

/**
 * Last-resort error screen (NFR-REL-02): a rendering crash never loses work —
 * a recovery copy is written first and the user can reload into it.
 */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('LineWise crashed', error, info.componentStack);
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
            Something went wrong
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 12px' }}>
            LineWise saved a recovery copy of your diagram. Reload to continue; the copy is offered on the
            welcome screen.
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
          <button
            type="button"
            onClick={() => location.reload()}
            style={{
              marginTop: 12,
              padding: '6px 12px',
              borderRadius: 6,
              border: 0,
              background: 'var(--accent)',
              color: 'var(--accent-contrast)',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
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
