// SPDX-License-Identifier: Apache-2.0
/** Custom React Flow nodes: devices, zones, annotations and off-page references. */
import {
  Handle,
  NodeResizer,
  Position,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { iconMarkup, type IconStyle } from '@linewise/device-library';
import { memo, useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { resizeZone, updateAnnotation, type Annotation, type DeviceRole } from '@linewise/core';
import { iconRole } from './icons.ts';

export { customIconUrl, iconRole } from './icons.ts';
import { Lock, StickyNote } from 'lucide-react';
import { cx } from '../components/ui.tsx';
import { useEditor } from '../store/editor.ts';
import { DEVICE_W, ICON } from './geometry.ts';
import type { DeviceView, ZoneView } from './model.ts';
import { roleLabel } from '../lib/labels.ts';

export function DeviceIcon({
  role,
  style,
  size = ICON,
  url,
}: {
  role: DeviceRole;
  style: IconStyle;
  size?: number;
  url?: string;
}) {
  if (url)
    return (
      <img
        src={url}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ display: 'block', objectFit: 'contain' }}
      />
    );
  // Icon markup is project-authored (not user content), so injecting it is safe.
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ color: style === 'classic' ? 'var(--device)' : 'var(--device-line)', display: 'block' }}
      dangerouslySetInnerHTML={{ __html: iconMarkup(role, style) }}
    />
  );
}

const SEV_COLOR = { error: 'var(--danger)', warning: 'var(--warning)', info: 'var(--info)' } as const;

export type DeviceNodeData = { view: DeviceView; iconStyle: IconStyle; summary: string; iconUrl?: string };
export type DeviceNodeType = Node<DeviceNodeData, 'device'>;

const handleStyle: CSSProperties = { background: 'var(--accent)', border: '2px solid var(--surface)' };

/** Label placement around the icon; the node box stays the icon so link anchors never move. */
const LABEL_POS: Record<string, CSSProperties> = {
  bottom: { top: ICON + 4, left: '50%', transform: 'translateX(-50%)', alignItems: 'center' },
  top: { bottom: ICON + 4, left: '50%', transform: 'translateX(-50%)', alignItems: 'center' },
  left: {
    right: DEVICE_W / 2 + ICON / 2 + 6,
    top: ICON / 2,
    transform: 'translateY(-50%)',
    alignItems: 'flex-end',
  },
  right: {
    left: DEVICE_W / 2 + ICON / 2 + 6,
    top: ICON / 2,
    transform: 'translateY(-50%)',
    alignItems: 'flex-start',
  },
};

/**
 * The always-present link anchor, a zero-size handle at the link end point (anchorOf): React Flow
 * draws a link only between nodes with a handle, and hands the edge this point.
 */
function Anchor({ top }: { top: number | string }) {
  return (
    <Handle
      type="source"
      position={Position.Top}
      id="c"
      className="lw-anchor"
      isConnectable={false}
      style={{ top, width: 0, height: 0, minWidth: 0, minHeight: 0, border: 0 }}
    />
  );
}

export const DeviceNode = memo(function DeviceNode({ id, data, selected }: NodeProps<DeviceNodeType>) {
  const { t } = useTranslation();
  const { view, iconStyle, summary, iconUrl } = data;
  const d = view.device;
  const pos = LABEL_POS[d.labelPosition] ?? LABEL_POS.bottom;
  // The four connection handles exist only on the device under the pointer: each handle is a
  // store subscription that re-runs on every frame of a drag, 2,000 of them with 500 devices
  // (NFR-PERF-04). Links are anchored on the device itself (anchorOf), not on a handle.
  const [showHandles, setHover] = useState(false);
  const updateInternals = useUpdateNodeInternals();
  useEffect(() => {
    // React Flow starts a connection only from a handle it has measured.
    if (showHandles) updateInternals(id);
  }, [showHandles, id, updateInternals]);
  return (
    <div
      className={cx('group relative flex flex-col items-center', view.dimmed && 'lw-dim')}
      style={{ width: DEVICE_W, height: ICON }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={(e) => {
        // Keep the handle under a connection being drawn from this device until the button is up.
        if (e.buttons === 0) setHover(false);
        else window.addEventListener('mouseup', () => setHover(false), { once: true });
      }}
      aria-label={`${roleLabel(d.role)} ${d.hostname}${view.issueCount ? `, ${t('node.problems', '{{n}} problems', { n: view.issueCount })}` : ''}${d.locked ? `, ${t('node.locked', 'locked')}` : ''}`}
      title={summary}
    >
      <div
        className={cx(
          'relative rounded-lg p-0',
          selected && 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--canvas)]',
        )}
      >
        <DeviceIcon role={iconRole(d.role, d.iconOverride)} style={iconStyle} url={iconUrl} />
        {view.severity && (
          <span
            className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
            style={{ background: SEV_COLOR[view.severity] }}
            aria-hidden="true"
            data-lw-badge={view.severity}
          >
            {view.issueCount}
          </span>
        )}
        <div className="absolute -bottom-1.5 -right-2 flex gap-0.5" aria-hidden="true">
          {d.colorTag && (
            <span
              className="h-3 w-3 rounded-full border-2 border-[var(--canvas)]"
              style={{ background: d.colorTag }}
            />
          )}
          {d.notes && (
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] shadow-sm">
              <StickyNote size={9} />
            </span>
          )}
          {d.locked && (
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] shadow-sm">
              <Lock size={9} />
            </span>
          )}
        </div>
      </div>
      <div className="lw-device-label pointer-events-none absolute flex flex-col" style={pos}>
        <div className="max-w-[140px] whitespace-pre-line rounded bg-[color-mix(in_srgb,var(--canvas)_85%,transparent)] px-1 text-center text-[12px] font-medium leading-tight text-ink">
          {view.label}
        </div>
        {view.badges.length > 0 && (
          <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
            {view.badges.map((b) => (
              <span key={b} className="rounded bg-accent-soft px-1 font-mono text-[9px] text-accent-ink">
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
      <Anchor top={ICON / 2} />
      {showHandles && (
        <>
          <Handle type="source" position={Position.Top} id="t" style={{ ...handleStyle, top: -4 }} />
          <Handle
            type="source"
            position={Position.Right}
            id="r"
            style={{ ...handleStyle, top: ICON / 2, right: 12 }}
          />
          <Handle type="source" position={Position.Bottom} id="b" style={{ ...handleStyle, top: ICON + 2 }} />
          <Handle
            type="source"
            position={Position.Left}
            id="l"
            style={{ ...handleStyle, top: ICON / 2, left: 12 }}
          />
        </>
      )}
    </div>
  );
});

export type ZoneNodeData = { view: ZoneView; pageId: string };
export type ZoneNodeType = Node<ZoneNodeData, 'zone'>;

export const ZoneNode = memo(function ZoneNode({ data, selected }: NodeProps<ZoneNodeType>) {
  const { zone, box } = data.view;
  const execute = useEditor((s) => s.execute);
  return (
    <>
      <NodeResizer
        isVisible={selected && !zone.locked}
        minWidth={80}
        minHeight={60}
        color="var(--accent)"
        onResizeEnd={(_, p) =>
          execute(resizeZone(data.pageId, zone.id, { x: p.x, y: p.y, w: p.width, h: p.height }))
        }
      />
      <div
        className="h-full w-full rounded-xl border-2 border-dashed"
        style={{
          borderColor: zone.color,
          background: `color-mix(in srgb, ${zone.color} 6%, transparent)`,
          width: box.w,
          height: box.h,
        }}
        aria-label={`Zone ${zone.name}`}
      >
        <div className="px-2 py-1 text-[12px] font-semibold" style={{ color: zone.color }}>
          {zone.name}
        </div>
      </div>
    </>
  );
});

export type AnnotationNodeData = { annotation: Annotation; pageId: string; assetUrl?: string };
export type AnnotationNodeType = Node<AnnotationNodeData, 'annotation'>;

export const AnnotationNode = memo(function AnnotationNode({
  data,
  selected,
}: NodeProps<AnnotationNodeType>) {
  const { annotation: a, pageId, assetUrl } = data;
  const execute = useEditor((s) => s.execute);
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(a.text);
  const commit = () => {
    setEditing(false);
    if (draft !== a.text) execute(updateAnnotation(pageId, a.id, { text: draft }));
  };
  const base: CSSProperties = {
    width: a.geometry.w,
    height: a.geometry.h,
    transform: a.geometry.rotation ? `rotate(${a.geometry.rotation}deg)` : undefined,
  };
  let body;
  if (a.kind === 'image' && assetUrl)
    body = (
      <img
        src={assetUrl}
        alt={a.text || t('annotation.image', 'Image')}
        className="h-full w-full object-contain"
        draggable={false}
      />
    );
  else if (a.kind === 'line') {
    body = (
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${a.geometry.w} ${a.geometry.h}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          x1="0"
          y1={a.geometry.h / 2}
          x2={a.geometry.w}
          y2={a.geometry.h / 2}
          stroke={a.style.stroke ?? 'var(--text)'}
          strokeWidth="2"
          markerEnd={a.style.arrowEnd ? 'url(#lw-arrow)' : undefined}
        />
      </svg>
    );
  } else {
    const shape =
      a.kind === 'ellipse'
        ? 'rounded-[50%]'
        : a.kind === 'rect'
          ? 'rounded-md'
          : a.kind === 'note'
            ? 'rounded-sm shadow-sm'
            : '';
    const bg =
      a.kind === 'note'
        ? (a.style.fill ?? '#FEF3C7')
        : a.kind === 'text'
          ? 'transparent'
          : (a.style.fill ?? 'transparent');
    const border =
      a.kind === 'rect' || a.kind === 'ellipse'
        ? `1.5px solid ${a.style.stroke ?? 'var(--border-strong)'}`
        : 'none';
    body = (
      <div
        className={cx('flex h-full w-full items-center justify-center overflow-hidden p-2', shape)}
        style={{
          background: bg,
          border,
          color: a.kind === 'note' ? '#0E1726' : 'var(--text)',
          fontSize: a.style.fontSize ?? 13,
        }}
      >
        {editing ? (
          <textarea
            autoFocus
            aria-label={t('annotation.editText', 'Annotation text')}
            className="nodrag h-full w-full resize-none bg-transparent outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setDraft(a.text);
                setEditing(false);
              }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
              e.stopPropagation();
            }}
          />
        ) : (
          <span className="whitespace-pre-wrap text-center">{a.text}</span>
        )}
      </div>
    );
  }
  return (
    <>
      <NodeResizer
        isVisible={selected && !a.locked}
        minWidth={20}
        minHeight={10}
        color="var(--accent)"
        onResizeEnd={(_, p) =>
          execute(
            updateAnnotation(pageId, a.id, {
              geometry: { ...a.geometry, x: p.x, y: p.y, w: p.width, h: p.height },
            }),
          )
        }
      />
      <div
        style={base}
        onDoubleClick={() =>
          !a.locked && a.kind !== 'image' && a.kind !== 'line' && (setDraft(a.text), setEditing(true))
        }
      >
        {body}
      </div>
    </>
  );
});

export type OffPageNodeData = { hostname: string; pageName: string };
export type OffPageNodeType = Node<OffPageNodeData, 'offpage'>;

export const OffPageNode = memo(function OffPageNode({ data }: NodeProps<OffPageNodeType>) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-1 text-[11px] text-muted shadow-sm">
      <span aria-hidden="true">↗</span>
      <span className="font-medium text-ink">{data.hostname}</span>
      <span>· {data.pageName}</span>
      <Anchor top="50%" />
    </div>
  );
});

export const nodeTypes = {
  device: DeviceNode,
  zone: ZoneNode,
  annotation: AnnotationNode,
  offpage: OffPageNode,
};
