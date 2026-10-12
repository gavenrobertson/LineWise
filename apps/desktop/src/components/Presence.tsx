// SPDX-License-Identifier: Apache-2.0
/**
 * Exit animations for things React would unmount at once (FR-UX-02): panels, the find bar, toasts,
 * the canvas hover card and the tour. A closing element stays mounted, marked
 * `data-state="closed"` and inert, for the exit duration; under reduced motion it goes at once.
 */
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { DUR, motionMs } from '../lib/motion.ts';

/** Mounted while present, and for `ms` after it stops being present. */
export function usePresence(present: boolean, ms: number = DUR.fast): { mounted: boolean; closing: boolean } {
  const [lingering, setLingering] = useState(false);
  const [was, setWas] = useState(present);
  // A change of `present` during render: start lingering when it turns off (React's
  // "adjust state while rendering" pattern, so the closing frame is the same commit).
  if (was !== present) {
    setWas(present);
    setLingering(!present && motionMs(ms) > 0);
  }
  useEffect(() => {
    if (!lingering) return;
    const timer = setTimeout(() => setLingering(false), motionMs(ms));
    return () => clearTimeout(timer);
  }, [lingering, ms]);
  return { mounted: present || lingering, closing: !present && lingering };
}

const Closing = createContext(false);

/** True inside a <Presence> that is playing its exit. */
export function useClosing(): boolean {
  return useContext(Closing);
}

/** Props for the element that animates: its open/closed state, and inert while it leaves. */
export function presenceProps(closing: boolean): { 'data-state': 'open' | 'closed'; inert?: boolean } {
  return closing ? { 'data-state': 'closed', inert: true } : { 'data-state': 'open' };
}

export function Presence({ present, children }: { present: boolean; children: ReactNode }) {
  const { mounted, closing } = usePresence(present);
  if (!mounted) return null;
  return <Closing.Provider value={closing}>{children}</Closing.Provider>;
}

/**
 * A list whose removed items linger for their exit: the current items, plus the ones just removed
 * (marked `leaving`), in id order.
 */
export function useLeavingList<T extends { id: number }>(
  items: T[],
  ms: number = DUR.fast,
): (T & { leaving?: true })[] {
  const [prev, setPrev] = useState(items);
  const [gone, setGone] = useState<T[]>([]);
  if (prev !== items) {
    const removed = prev.filter((p) => !items.some((i) => i.id === p.id));
    setPrev(items);
    if (removed.length && motionMs(ms) > 0) setGone((g) => [...g, ...removed]);
  }
  useEffect(() => {
    if (!gone.length) return;
    const timer = setTimeout(() => setGone([]), motionMs(ms));
    return () => clearTimeout(timer);
  }, [gone, ms]);
  if (!gone.length) return items;
  return [...items, ...gone.map((g) => ({ ...g, leaving: true as const }))].sort((a, b) => a.id - b.id);
}

/**
 * Dialogs fade out on close. While one fades, it lets go of the page at once: keyboard focus
 * leaves it, so a shortcut or key pressed during the fade is not typed into it (Radix then returns
 * focus to the trigger), and the page takes clicks again (Radix blocks clicks outside a modal
 * until it unmounts), unless another modal dialog is still open.
 */
export function useReleaseOnClose(open: boolean): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (open) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && ref.current?.contains(active)) active.blur();
    if (!document.querySelector('[role="dialog"][data-state="open"]')) document.body.style.pointerEvents = '';
  }, [open]);
  return ref;
}
