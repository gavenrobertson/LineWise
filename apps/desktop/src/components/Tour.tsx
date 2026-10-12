// SPDX-License-Identifier: Apache-2.0
/**
 * First-run tour (FR-UX-12): four coach marks — library, canvas, drawing a link, inspector. It
 * never blocks work: it is not modal, the rest of the app stays usable, Escape or "Skip" ends it,
 * and it is remembered once finished. Help → Take the tour shows it again.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatShortcut } from '../lib/actions.ts';
import { helpQuiet } from '../lib/tips.ts';
import { usePrefs } from '../store/prefs.ts';
import { useUi } from '../store/ui.ts';
import { Button } from './ui.tsx';

interface Step {
  target: string;
  title: string;
  body: string;
  side: 'right' | 'left' | 'center';
}

function useSteps(): Step[] {
  const { t } = useTranslation();
  return useMemo(
    () => [
      {
        target: 'aside[aria-label="Sidebar"]',
        title: t('tour.library.title', 'Add devices'),
        body: t(
          'tour.library.body',
          'Drag a device from the library onto the canvas, or select one and press Enter. Search finds a model, role or vendor.',
        ),
        side: 'right',
      },
      {
        target: '#lw-canvas',
        title: t('tour.canvas.title', 'Move around'),
        body: t(
          'tour.canvas.body',
          'Scroll to pan, {{mod}} + scroll to zoom. Press {{k}} to run any command.',
          {
            mod: formatShortcut('mod'),
            k: formatShortcut('mod+K'),
          },
        ),
        side: 'center',
      },
      {
        target: '.react-flow__node-device',
        title: t('tour.connect.title', 'Draw links'),
        body: t(
          'tour.connect.body',
          'Hover a device and drag from a teal handle to another device. You then pick the interface at each end.',
        ),
        side: 'right',
      },
      {
        target: 'aside[aria-label="Inspector"]',
        title: t('tour.inspector.title', 'Edit details'),
        body: t(
          'tour.inspector.body',
          'Select anything to edit it here. Look for ? beside a heading and ⓘ beside a field when a term is new.',
        ),
        side: 'left',
      },
    ],
    [t],
  );
}

const W = 300;

export function Tour() {
  const { t } = useTranslation();
  const step = useUi((s) => s.tour);
  const setTour = useUi((s) => s.setTour);
  const dialog = useUi((s) => s.dialog);
  const tourDone = usePrefs((s) => s.tourDone);
  const steps = useSteps();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const primary = useRef<HTMLButtonElement>(null);

  // First run: once the welcome screen closes on a diagram, offer the tour.
  const offered = useRef(false);
  useEffect(() => {
    if (dialog || tourDone || offered.current || helpQuiet()) return;
    if (!document.querySelector('#lw-canvas')) return;
    offered.current = true;
    setTour(0);
  }, [dialog, tourDone, setTour]);

  const current = step === null || dialog ? null : (steps[step] ?? null);
  const target = current?.target;
  useLayoutEffect(() => {
    if (!target) return;
    const find = () => {
      const el = document.querySelector(target) ?? (step === 2 ? document.querySelector('#lw-canvas') : null);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    find();
    window.addEventListener('resize', find);
    return () => window.removeEventListener('resize', find);
  }, [target, step]);
  useEffect(() => {
    if (target) primary.current?.focus({ preventScroll: true });
  }, [target, step]);

  if (!current || step === null) return null;
  const finish = () => {
    setTour(null);
    usePrefs.getState().set({ tourDone: true });
  };
  const last = step === steps.length - 1;
  // Place the card beside its target, kept inside the window.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = vw / 2 - W / 2;
  let top = vh / 2 - 80;
  if (rect && current.side === 'right') {
    left = rect.right + 12;
    top = rect.top + Math.min(80, rect.height / 3);
  } else if (rect && current.side === 'left') {
    left = rect.left - W - 12;
    top = rect.top + Math.min(80, rect.height / 3);
  } else if (rect) {
    left = rect.left + rect.width / 2 - W / 2;
    top = rect.top + rect.height / 2 - 80;
  }
  left = Math.max(8, Math.min(left, vw - W - 8));
  top = Math.max(8, Math.min(top, vh - 200));

  return (
    <>
      {rect && (
        <div
          aria-hidden="true"
          className="lw-tour-ring lw-no-print pointer-events-none fixed z-[75] rounded-xl"
          style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
      )}
      <section
        aria-label={t('tour.label', 'Quick tour')}
        aria-live="polite"
        data-lw-tour={step}
        key={step}
        className="lw-pop lw-material lw-no-print fixed z-[76] rounded-xl border border-line p-4 text-[12.5px] leading-snug text-ink shadow-elev-3"
        data-state="open"
        style={{ left, top, width: W }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            finish();
          }
        }}
      >
        <p className="text-[11px] font-medium text-subtle">
          {t('tour.step', 'Step {{n}} of {{total}}', { n: step + 1, total: steps.length })}
        </p>
        <h2 className="mt-0.5 font-brand text-[14px] font-semibold">{current.title}</h2>
        <p className="mt-1 text-muted">{current.body}</p>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={finish}>
            {t('tour.skip', 'Skip tour')}
          </Button>
          <span className="flex-1" />
          {step > 0 && (
            <Button size="sm" onClick={() => setTour(step - 1)}>
              {t('tour.back', 'Back')}
            </Button>
          )}
          <Button
            ref={primary}
            size="sm"
            variant="primary"
            onClick={() => (last ? finish() : setTour(step + 1))}
          >
            {last ? t('tour.done', 'Done') : t('tour.next', 'Next')}
          </Button>
        </div>
      </section>
    </>
  );
}
