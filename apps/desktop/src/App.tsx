// SPDX-License-Identifier: Apache-2.0
/**
 * Application shell (FR-APP-03): toolbar on top, library left, canvas center,
 * inspector right, problems bottom. Wires the platform (menu, file
 * associations, close prompts), validation, autosave and dialogs.
 */
import { ReactFlowProvider } from '@xyflow/react';
import * as RTooltip from '@radix-ui/react-tooltip';
import { CircleAlert, CircleCheck, Info, Lightbulb, X } from 'lucide-react';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Canvas } from './canvas/Canvas.tsx';
import { cx } from './components/ui.tsx';
import { AboutDialog } from './dialogs/AboutDialog.tsx';
import { CalculatorDialog } from './dialogs/CalculatorDialog.tsx';
import { CommandPalette } from './dialogs/CommandPalette.tsx';
import { ConnectDialog } from './dialogs/ConnectDialog.tsx';
import { ExportDialog } from './dialogs/ExportDialog.tsx';
import { FindPanel } from './dialogs/FindPanel.tsx';
import { ImportDialog } from './dialogs/ImportDialog.tsx';
import { IpamDialog } from './dialogs/IpamDialog.tsx';
import { LayoutDialog } from './dialogs/LayoutDialog.tsx';
import { LoadIssuesDialog } from './dialogs/LoadIssuesDialog.tsx';
import { PreferencesDialog } from './dialogs/PreferencesDialog.tsx';
import { ShortcutsDialog } from './dialogs/ShortcutsDialog.tsx';
import { TemplateEditorDialog } from './dialogs/TemplateEditorDialog.tsx';
import { UpdateDialog } from './dialogs/UpdateDialog.tsx';
import { VlanDialog } from './dialogs/VlanDialog.tsx';
import { WelcomeDialog } from './dialogs/WelcomeDialog.tsx';
import i18n from './i18n/index.ts';
import {
  autosaveNow,
  checkUpdates,
  confirmCloseAll,
  deleteItems,
  editTextField,
  openFile,
  runCommand,
} from './lib/actions.ts';
import { useKeyboard } from './lib/keyboard.ts';
import { platform } from './platform/index.ts';
import { Inspector } from './panels/Inspector.tsx';
import { PagesBar } from './panels/PagesBar.tsx';
import { ProblemsPanel } from './panels/ProblemsPanel.tsx';
import { SidePanel } from './panels/SidePanel.tsx';
import { StatusBar } from './panels/StatusBar.tsx';
import { TabBar } from './panels/TabBar.tsx';
import { Toolbar } from './panels/Toolbar.tsx';
import { dirtyTabIds, selectDirty, useEditor } from './store/editor.ts';
import { applyTheme, usePrefs } from './store/prefs.ts';
import { usePacks } from './store/packs.ts';
import { missingPackIcons } from './canvas/icons.ts';
import { useUi, type DialogState } from './store/ui.ts';
import { onValidation, requestValidation } from './workers/client.ts';

function ActiveDialog({ dialog }: { dialog: DialogState }): ReactNode {
  if (!dialog) return null;
  switch (dialog.kind) {
    case 'welcome':
    case 'recovery':
      return <WelcomeDialog />;
    case 'import':
      return <ImportDialog initialText={dialog.initialText} />;
    case 'export':
      return <ExportDialog />;
    case 'vlans':
      return <VlanDialog />;
    case 'ipam':
      return <IpamDialog />;
    case 'calculator':
      return <CalculatorDialog />;
    case 'preferences':
      return <PreferencesDialog />;
    case 'shortcuts':
      return <ShortcutsDialog />;
    case 'about':
      return <AboutDialog />;
    case 'layout':
      return <LayoutDialog />;
    case 'templateEditor':
      return <TemplateEditorDialog templateId={dialog.templateId} />;
    case 'connect':
      return <ConnectDialog sourceId={dialog.sourceId} targetId={dialog.targetId} />;
    case 'linkFromFocused':
      return <ConnectDialog sourceId={dialog.sourceId} />;
    case 'update':
      return <UpdateDialog info={dialog.info} />;
    case 'loadIssues':
      return <LoadIssuesDialog issues={dialog.issues} onRecover={dialog.onRecover} />;
  }
}

function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  const hold = useUi((s) => s.hold);
  const { t: tr } = useTranslation();
  return (
    <div
      className="lw-no-print pointer-events-none fixed bottom-10 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : undefined}
          data-lw-toast={t.kind}
          // Springs up from the bottom; the countdown hairline pauses on hover and focus (FR-UX-02).
          className={cx(
            'lw-toast lw-material pointer-events-auto relative flex max-w-md items-start gap-2 overflow-hidden rounded-lg border px-3 py-2 text-[13px] text-ink shadow-elev-2',
            t.kind === 'error' ? 'border-danger/40' : 'border-line',
          )}
          style={{ '--lw-toast-ms': `${t.ms}ms` } as CSSProperties}
          onMouseEnter={() => hold(t.id, true)}
          onMouseLeave={() => hold(t.id, false)}
          onFocus={() => hold(t.id, true)}
          onBlur={() => hold(t.id, false)}
        >
          {t.kind === 'error' ? (
            <CircleAlert size={15} className="mt-0.5 shrink-0 text-danger" />
          ) : t.kind === 'success' ? (
            <CircleCheck size={15} className="mt-0.5 shrink-0 text-accent-ink" />
          ) : t.kind === 'tip' ? (
            <Lightbulb size={15} className="mt-0.5 shrink-0 text-accent-ink" />
          ) : (
            <Info size={15} className="mt-0.5 shrink-0 text-info" />
          )}
          <span className="min-w-0 flex-1 break-words">{t.message}</span>
          {t.actions?.map((a) => (
            <button
              key={a.label}
              type="button"
              className="lw-btn shrink-0 rounded-md px-1.5 text-[12px] font-medium text-accent-ink hover:bg-accent-soft"
              onClick={() => {
                a.run();
                dismiss(t.id);
              }}
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            aria-label={tr('toast.dismiss', 'Dismiss')}
            className="lw-btn shrink-0 rounded-full p-0.5 text-subtle hover:bg-surface-3 hover:text-ink"
            onClick={() => dismiss(t.id)}
          >
            <X size={13} />
          </button>
          <span
            aria-hidden="true"
            className={cx(
              'lw-toast-progress absolute inset-x-0 bottom-0 h-px',
              t.kind === 'error' ? 'bg-danger' : 'bg-accent',
            )}
          />
        </div>
      ))}
    </div>
  );
}

/** Platform, validation, autosave, theme and title wiring. */
function useAppEffects(): void {
  const theme = usePrefs((s) => s.theme);
  const language = usePrefs((s) => s.language);
  const autosaveSeconds = usePrefs((s) => s.autosaveSeconds);
  const presentation = useUi((s) => s.presentation);

  useEffect(() => applyTheme(theme), [theme]);
  // Installed icon packs, then a notice for a diagram whose pack icons are not installed (FR-ICO-05).
  const packsLoaded = usePacks((s) => s.loaded);
  const docId = useEditor((s) => s.doc.id);
  useEffect(() => void usePacks.getState().refresh(), []);
  const noticed = useRef(new Set<string>());
  useEffect(() => {
    if (!packsLoaded || noticed.current.has(docId)) return;
    noticed.current.add(docId);
    const missing = missingPackIcons(useEditor.getState().doc).length;
    if (missing)
      useUi.getState().toast(
        i18n.t('packs.missing', {
          defaultValue:
            'This diagram uses {{n}} icons from icon packs that are not installed; built-in icons are shown instead.',
          n: missing,
        }),
        'info',
      );
  }, [packsLoaded, docId]);
  // Interface size follows the OS text size unless the user picked one (NFR-A11Y-04).
  const uiScale = usePrefs((s) => s.uiScale);
  useEffect(() => {
    let live = true;
    void (async () => {
      const scale =
        uiScale === 'system'
          ? await platform()
              .osTextScale()
              .catch(() => 1)
          : uiScale;
      if (live)
        await platform()
          .setUiScale(scale)
          .catch(() => undefined);
    })();
    return () => {
      live = false;
    };
  }, [uiScale]);
  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  // Title with unsaved indicator (FR-APP-02).
  useEffect(() => {
    const update = () => {
      const s = useEditor.getState();
      const name = s.fileName.replace(/\.lwise$/i, '');
      void platform().setTitle(
        `${selectDirty(s) ? '• ' : ''}${name}${s.readOnly ? ' (read-only)' : ''} — LineWise`,
      );
    };
    update();
    return useEditor.subscribe((s, p) => {
      if (
        s.rev !== p.rev ||
        s.savedRev !== p.savedRev ||
        s.fileName !== p.fileName ||
        s.readOnly !== p.readOnly
      )
        update();
    });
  }, []);

  // Validation in a worker, debounced, keyed on revision (FR-VAL-05).
  useEffect(() => {
    onValidation((rev, issues, suppressed) => useEditor.getState().setIssues(rev, issues, suppressed));
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      const s = useEditor.getState();
      requestValidation(s.rev, s.doc);
    };
    run();
    const unsub = useEditor.subscribe((s, p) => {
      if (s.doc === p.doc) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 150);
    });
    const now = () => run();
    window.addEventListener('linewise:validate', now);
    return () => {
      unsub();
      window.removeEventListener('linewise:validate', now);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Recovery copies (NFR-REL-02). The user's file is only written on Save.
  useEffect(() => {
    if (!autosaveSeconds) return;
    const id = setInterval(() => void autosaveNow(), autosaveSeconds * 1000);
    // Also when the window loses focus (FR-FMT-07).
    const onBlur = () => void autosaveNow();
    window.addEventListener('blur', onBlur);
    return () => {
      clearInterval(id);
      window.removeEventListener('blur', onBlur);
    };
  }, [autosaveSeconds]);

  // Canvas delete key, editor errors.
  useEffect(() => {
    const onDelete = (e: Event) => deleteItems((e as CustomEvent<string[]>).detail);
    window.addEventListener('linewise:delete', onDelete);
    const unsub = useEditor.subscribe((s) => {
      if (s.lastError) {
        useUi.getState().toast(s.lastError, 'error');
        s.clearError();
      }
    });
    return () => {
      window.removeEventListener('linewise:delete', onDelete);
      unsub();
    };
  }, []);

  // Native menu, "open with", close prompt and first-run screen.
  useEffect(() => {
    const p = platform();
    const offMenu = p.onMenu((cmd) => {
      if (cmd.startsWith('edit.') && editTextField(cmd)) return;
      runCommand(cmd);
    });
    let opened = false;
    const offOpen = p.onOpenFile((path) => {
      opened = true;
      void openFile(path);
    });
    // Quitting asks about every tab with unsaved changes (FR-APP-02).
    const offClose = p.onCloseRequested(confirmCloseAll, () => dirtyTabIds().length > 0);
    // Show the welcome screen unless a file is being opened.
    const t = setTimeout(() => {
      if (!opened && !useUi.getState().dialog && useEditor.getState().doc.devices.length === 0)
        useUi.getState().open({ kind: 'welcome' });
    }, 150);
    void checkUpdates(false);
    return () => {
      offMenu();
      offOpen();
      offClose();
      clearTimeout(t);
    };
  }, []);

  // Presentation mode: full screen, no chrome (FR-CAN-17).
  useEffect(() => {
    const el = document.documentElement;
    if (presentation && !document.fullscreenElement) void el.requestFullscreen?.().catch(() => undefined);
    if (!presentation && document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    const onFs = () => {
      if (!document.fullscreenElement && useUi.getState().presentation)
        useUi.getState().setPresentation(false);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [presentation]);
}

export function App() {
  const { t } = useTranslation();
  useKeyboard();
  useAppEffects();
  const dialog = useUi((s) => s.dialog);
  const find = useUi((s) => s.find);
  const presentation = useUi((s) => s.presentation);
  const libraryOpen = useUi((s) => s.libraryOpen);
  const inspectorOpen = useUi((s) => s.inspectorOpen);
  const problemsOpen = useUi((s) => s.problemsOpen);
  const readOnly = useEditor((s) => s.readOnly);
  return (
    <RTooltip.Provider delayDuration={500} skipDelayDuration={300}>
      <ReactFlowProvider>
        <a
          href="#lw-canvas"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-surface focus:px-2 focus:py-1"
        >
          {t('app.skip', 'Skip to canvas')}
        </a>
        <div className="flex h-full flex-col">
          {!presentation && <Toolbar />}
          {readOnly && !presentation && (
            <div
              role="status"
              className="lw-no-print border-b border-warning/40 bg-warning-soft px-3 py-1 text-[12px] text-warning"
            >
              {t(
                'app.readOnlyBanner',
                'This diagram was saved by a newer version of LineWise and is open read-only. Use Save As to keep a copy in this version’s format.',
              )}
            </div>
          )}
          <div className="flex min-h-0 flex-1">
            {!presentation && libraryOpen && <SidePanel />}
            <main
              id="lw-canvas"
              className="flex min-w-0 flex-1 flex-col"
              aria-label={t('app.main', 'Diagram')}
            >
              {!presentation && <TabBar />}
              <div className="relative min-h-0 flex-1">
                <Canvas />
                {find && !presentation && <FindPanel />}
              </div>
              {!presentation && problemsOpen && <ProblemsPanel />}
              {!presentation && <PagesBar />}
            </main>
            {!presentation && inspectorOpen && <Inspector />}
          </div>
          {!presentation && <StatusBar />}
        </div>
        <ActiveDialog dialog={dialog} />
        <CommandPalette />
        <Toasts />
      </ReactFlowProvider>
    </RTooltip.Provider>
  );
}
