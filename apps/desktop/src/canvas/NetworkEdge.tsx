// SPDX-License-Identifier: Apache-2.0
/**
 * Link rendering (FR-LNK-02..06): floating ends that stop at the icon,
 * straight/orthogonal/curved routing, parallel fan-out, medium styles
 * (fiber, serial zigzag, wireless, tunnel, console), trunk weight, interface
 * labels at each end, a mid label, and a bundle mark for port-channels.
 */
import { BaseEdge, EdgeLabelRenderer, useInternalNode, type Edge, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import { edgeGeometryPure as edgeGeometry } from './edgeGeometry.ts';
import { midDirection, nodeCenter } from './geometry.ts';
import type { LinkView } from './model.ts';

export type NetworkEdgeData = { view: LinkView };
export type NetworkEdgeType = Edge<NetworkEdgeData, 'network'>;

const SEV = { error: 'var(--danger)', warning: 'var(--warning)', info: 'var(--info)' } as const;

export const NetworkEdge = memo(function NetworkEdge({
  id,
  source,
  target,
  data,
  selected,
}: EdgeProps<NetworkEdgeType>) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s || !t || !data) return null;
  const view = data.view;
  const a = nodeCenter(s.internals.positionAbsolute);
  const b = nodeCenter(t.internals.positionAbsolute);
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
      <EdgeLabelRenderer>
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
      </EdgeLabelRenderer>
    </g>
  );
});

export const edgeTypes = { network: NetworkEdge };
