// SPDX-License-Identifier: Apache-2.0
import '@xyflow/react/dist/base.css';
import '@linewise/brand/fonts/fonts.css';
import './styles.css';
import i18n from './i18n/index.ts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { applyTheme, usePrefs } from './store/prefs.ts';

// Paint the first frame in the chosen theme (dark by default), not light then dark.
applyTheme(usePrefs.getState().theme);

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
