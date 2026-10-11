// SPDX-License-Identifier: Apache-2.0
/**
 * Minimap (FR-CAN-01): the page drawn from the page model, with the visible area marked. Click or
 * drag to move the view there; the wheel zooms. Unlike React Flow's own minimap it holds no
 * subscription per node, which re-ran on every frame of a drag with 500 devices (NFR-PERF-04);
 * a device being dragged moves here when it is dropped.
 */
import { Panel, useReactFlow, useStore } from '@xyflow/react';
import { memo, useMemo, useRef, type PointerEvent, type WheelEvent } from 'react';
import { DEVICE_W, ICON } from './geometry.ts';
import { pageBounds, type PageModel } from './model.ts';

const W = 200;
const H = 150;

const Shapes = memo(function Shapes({ model }: { model: PageModel }) {
  return (
    <>
      {model.zones.map((z) => (
        <rect
          key={z.zone.id}
          x={z.box.x}
          y={z.box.y}
          width={z.box.w}
          height={z.box.h}
          rx={8}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={4}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {model.devices.map((d) => (
        <rect
          key={d.device.id}
          x={d.center.x - ICON / 2}
          y={d.center.y - ICON / 2}
          width={ICON}
          height={ICON}
          rx={10}
          fill="var(--device)"
        />
      ))}
      {model.offPage.map((o) => (
        <rect
          key={o.deviceId}
          x={o.position.x}
          y={o.position.y}
          width={DEVICE_W}
          height={24}
          rx={12}
          fill="var(--text-subtle)"
        />
      ))}
    </>
  );
});

export function Minimap({ model, label }: { model: PageModel; label: string }) {
  const rf = useReactFlow();
  const [tx, ty, zoom] = useStore((s) => s.transform);
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const view = { x: -tx / zoom, y: -ty / zoom, w: width / zoom, h: height / zoom };
  const content = useMemo(() => pageBounds(model, 80), [model]);
  // The map shows the page and the visible area together.
  const x0 = Math.min(content.x, view.x);
  const y0 = Math.min(content.y, view.y);
  const x1 = Math.max(content.x + content.w, view.x + view.w);
  const y1 = Math.max(content.y + content.h, view.y + view.h);
  const scale = Math.max((x1 - x0) / W, (y1 - y0) / H) || 1;
  const box = {
    x: x0 - (W * scale - (x1 - x0)) / 2,
    y: y0 - (H * scale - (y1 - y0)) / 2,
    w: W * scale,
    h: H * scale,
  };
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const toFlow = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return {
      x: box.x + ((e.clientX - r.left) / r.width) * box.w,
      y: box.y + ((e.clientY - r.top) / r.height) * box.h,
    };
  };
  const centerOn = (e: { clientX: number; clientY: number }) => {
    const p = toFlow(e);
    void rf.setCenter(p.x, p.y, { zoom });
  };
  return (
    <Panel position="bottom-right" className="lw-minimap nopan nodrag nowheel">
      <svg
        ref={svg}
        role="img"
        aria-label={label}
        width={W}
        height={H}
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        className="block cursor-pointer rounded-md border border-line bg-surface"
        onPointerDown={(e: PointerEvent<SVGSVGElement>) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          centerOn(e);
        }}
        onPointerMove={(e) => dragging.current && centerOn(e)}
        onPointerUp={() => (dragging.current = false)}
        onWheel={(e: WheelEvent<SVGSVGElement>) => {
          const p = toFlow(e);
          const next = Math.min(4, Math.max(0.1, zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
          void rf.setCenter(p.x, p.y, { zoom: next });
        }}
      >
        <Shapes model={model} />
        <rect
          x={view.x}
          y={view.y}
          width={view.w}
          height={view.h}
          fill="var(--accent)"
          fillOpacity={0.08}
          stroke="var(--accent)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </Panel>
  );
}
