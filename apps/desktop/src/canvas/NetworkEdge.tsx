// SPDX-License-Identifier: Apache-2.0
/**
 * Link rendering (FR-LNK-02..06): floating ends that stop at the icon,
 * straight/orthogonal/curved routing, parallel fan-out, medium styles
 * (fiber, serial zigzag, wireless, tunnel, console), trunk weight, interface
 * labels at each end, a mid label, and a bundle mark for port-channels.
 */
import { BaseEdge, useReactFlow, type Edge, type EdgeProps, type InternalNode } from '@xyflow/react';
import { updateLinkStyle } from '@linewise/core';
import { createContext, memo, useContext, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEditor } from '../store/editor.ts';
import { edgeGeometryPure as edgeGeometry } from './edgeGeometry.ts';
import { midDirection, nodeCenter, type XY } from './geometry.ts';
import { SEVERITY_GLYPH, type LinkView } from './model.ts';

/** Link anchor for a node: device icon center, or the middle of an off-page reference pill. */
export function anchorOf(n: InternalNode): XY {
  const p = n.internals.positionAbsolute;
  if (n.type === 'offpage')
    return { x: p.x + (n.measured.width ?? 120) / 2, y: p.y + (n.measured.height ?? 24) / 2 };
  return nodeCenter(p);
}

/** Drag a bend point; double-click removes it (FR-LNK-02). */
function Waypoints({
  linkId,
  points,
  onPreview,
}: {
  linkId: string;
  points: XY[];
  onPreview: (p: XY[] | null) => void;
}) {
  const rf = useReactFlow();
  const { t } = useTranslation();
  const execute = useEditor((s) => s.execute);
  const [drag, setDrag] = useState<{ index: number; pts: XY[] } | null>(null);
  const current = drag?.pts ?? points;
  const down = (e: PointerEvent, index: number) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ index, pts: points });
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    const f = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const pts = drag.pts.map((p, i) => (i === drag.index ? { x: Math.round(f.x), y: Math.round(f.y) } : p));
    setDrag({ ...drag, pts });
    onPreview(pts);
  };
  const up = () => {
    if (!drag) return;
    execute(updateLinkStyle([linkId], { waypoints: drag.pts }));
    setDrag(null);
    onPreview(null);
  };
  return (
    <>
      {current.map((p, i) => (
        <circle
          key={i}
          role="button"
          tabIndex={-1}
          aria-label={t('link.bendPoint', 'Bend point')}
          className="nodrag nopan cursor-move"
          cx={p.x}
          cy={p.y}
          r={6}
          fill="var(--surface)"
          stroke="var(--accent)"
          strokeWidth={2}
          style={{ pointerEvents: 'all' }}
          onPointerDown={(e) => down(e, i)}
          onPointerMove={move}
          onPointerUp={up}
          onDoubleClick={(e) => {
            e.stopPropagation();
            execute(updateLinkStyle([linkId], { waypoints: points.filter((_, j) => j !== i) }));
          }}
        >
          <title>{t('link.bendHint', 'Drag to move; double-click to remove')}</title>
        </circle>
      ))}
    </>
  );
}

/**
 * Like React Flow's EdgeLabelRenderer, but the canvas finds the label layer once and hands it
 * down: a DOM query or a store subscription per edge re-ran on every store update, which cost
 * ~270 ms per edit with 800 links (NFR-PERF-04).
 */
export const EdgeLabelLayer = createContext<Element | null>(null);

function EdgeLabels({ children }: { children: ReactNode }) {
  const layer = useContext(EdgeLabelLayer);
  return layer ? createPortal(children, layer) : null;
}

export type NetworkEdgeData = { view: LinkView };
export type NetworkEdgeType = Edge<NetworkEdgeData, 'network'>;

const SEV = { error: 'var(--danger)', warning: 'var(--warning)', info: 'var(--info)' } as const;

export const NetworkEdge = memo(function NetworkEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps<NetworkEdgeType>) {
  const readOnly = useEditor((st) => st.readOnly);
  const [preview, setPreview] = useState<XY[] | null>(null);
  if (!data) return null;
  const view = preview ? { ...data.view, waypoints: preview } : data.view;
  // React Flow places the ends on each node's centered anchor handle, the same point as anchorOf,
  // without a node subscription per end (NFR-PERF-04).
  const a = { x: sourceX, y: sourceY };
  const b = { x: targetX, y: targetY };
  const { points, d, anchors } = edgeGeometry(a, b, view);
  const { mid, ux, uy } = midDirection(points);
  const px = -uy;
  const py = ux;
  const stroke = view.severity === 'error' ? SEV.error : view.color;
  return (
    <g className={view.dimmed ? 'lw-dim' : undefined}>
      {selected && (
        <path
          d={d}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={view.width + 6}
          strokeOpacity={0.25}
          strokeLinecap="round"
        />
      )}
      <BaseEdge
        id={id}
        path={d}
        interactionWidth={14}
        style={{
          stroke,
          strokeWidth: view.width,
          strokeDasharray: view.dash ?? undefined,
          fill: 'none',
          strokeLinecap: 'round',
        }}
      />
      {view.serial && (
        <path
          d={`M${mid.x - ux * 8} ${mid.y - uy * 8}L${mid.x - ux * 2 + px * 6} ${mid.y - uy * 2 + py * 6}L${mid.x + ux * 2 - px * 6} ${mid.y + uy * 2 - py * 6}L${mid.x + ux * 8} ${mid.y + uy * 8}`}
          fill="none"
          stroke={stroke}
          strokeWidth={view.width}
          strokeLinejoin="round"
        />
      )}
      {view.bundle?.lead && (
        <ellipse
          cx={anchors.a.x * 0.6 + mid.x * 0.4}
          cy={anchors.a.y * 0.6 + mid.y * 0.4}
          rx={(view.bundle.size * 14) / 2 + 6}
          ry={7}
          transform={`rotate(${(Math.atan2(py, px) * 180) / Math.PI} ${anchors.a.x * 0.6 + mid.x * 0.4} ${anchors.a.y * 0.6 + mid.y * 0.4})`}
          fill="none"
          stroke={stroke}
          strokeWidth={1.25}
        />
      )}
      {/* Bend points are drawn in the edge's own group so they sit above its hit path. */}
      {selected && !readOnly && view.waypoints.length > 0 && (
        <Waypoints linkId={view.link.id} points={data.view.waypoints} onPreview={setPreview} />
      )}
      {view.severity && (
        // Problem badge at the middle of the link, drawn with the link so it shows at every zoom.
        <g
          transform={`translate(${anchors.mid.x} ${anchors.mid.y + 10})`}
          data-lw-badge={view.severity}
          aria-hidden="true"
          pointerEvents="none"
        >
          <circle r={7} fill={SEV[view.severity]} stroke="var(--canvas)" strokeWidth={1.5} />
          <text textAnchor="middle" dy={3} fontSize={8} fontWeight={700} fill="#fff">
            {SEVERITY_GLYPH[view.severity]}
          </text>
        </g>
      )}
      <EdgeLabels>
        {view.labelA && (
          <div
            className="lw-edge-label nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${anchors.a.x}px, ${anchors.a.y}px)` }}
          >
            {view.labelA}
          </div>
        )}
        {view.labelB && (
          <div
            className="lw-edge-label nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${anchors.b.x}px, ${anchors.b.y}px)` }}
          >
            {view.labelB}
          </div>
        )}
        {view.labelMid && (
          <div
            className="lw-edge-label lw-edge-label--mid nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${anchors.mid.x}px, ${anchors.mid.y - 10}px)`,
            }}
          >
            {view.labelMid}
          </div>
        )}
      </EdgeLabels>
    </g>
  );
});

export const edgeTypes = { network: NetworkEdge };
