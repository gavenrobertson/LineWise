// SPDX-License-Identifier: Apache-2.0
/**
 * The diagram canvas (FR-CAN-01..15). The model is the source of truth: nodes
 * and edges are derived from the document; drags are previewed through
 * transient positions and committed as one Move command on release.
 */
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  ViewportPortal,
  type Connection,
  type Edge,
  type Node,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  addOffPageRef,
  updateLinkStyle,
  addDevice,
  batch,
  deviceSummary,
  insertDeviceOnLink,
  moveNodes,
  updateAnnotation,
  updateDevices,
  type Command,
} from '@linewise/core';
import { getTemplate } from '@linewise/device-library';
import { selectPage, useEditor } from '../store/editor.ts';
import { usePrefs } from '../store/prefs.ts';
import { useUi } from '../store/ui.ts';
import {
  deviceAt,
  distanceToPolyline,
  linkPoints,
  nodeCenter,
  nodeTopLeft,
  stabilize,
  type XY,
} from './geometry.ts';
import { assetDataUrl } from './icons.ts';
import { buildPageModel } from './model.ts';
import { anchorOf, edgeTypes, type NetworkEdgeType } from './NetworkEdge.tsx';
import { customIconUrl, nodeTypes } from './nodes.tsx';

export const TEMPLATE_MIME = 'application/x-linewise-template';

const summaryCache = new WeakMap<object, { links: unknown; text: string }>();

/**
 * Fit padding that keeps content clear of the overlays: the zoom controls (bottom left) and,
 * when shown, the minimap (bottom right, about 200 px wide).
 */
export function fitPadding(minimap = usePrefs.getState().showMinimap) {
  return { top: '48px', bottom: '48px', left: '72px', right: minimap ? '240px' : '48px' } as const;
}

/** Imperative canvas API for menus, the command palette and find. */
export const canvasApi: {
  instance: ReactFlowInstance | null;
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  focusOn: (ids: string[]) => void;
  viewportCenter: () => XY;
} = {
  instance: null,
  fit: () => void canvasApi.instance?.fitView({ padding: fitPadding(), duration: 200, maxZoom: 1 }),
  zoomIn: () => void canvasApi.instance?.zoomIn({ duration: 150 }),
  zoomOut: () => void canvasApi.instance?.zoomOut({ duration: 150 }),
  focusOn: (ids) => {
    const inst = canvasApi.instance;
    if (!inst) return;
    const nodes = ids.map((id) => inst.getNode(id)).filter((n): n is Node => !!n);
    if (nodes.length) void inst.fitView({ nodes, padding: 0.6, duration: 250, maxZoom: 1.4 });
  },
  viewportCenter: () => {
    const inst = canvasApi.instance;
    if (!inst) return { x: 0, y: 0 };
    const el = document.querySelector('.react-flow');
    const r = el?.getBoundingClientRect();
    return inst.screenToFlowPosition({
      x: (r?.left ?? 0) + (r?.width ?? 800) / 2,
      y: (r?.top ?? 0) + (r?.height ?? 600) / 2,
    });
  },
};

interface Guide {
  x?: number;
  y?: number;
}

const SNAP_GUIDE = 6;

export function Canvas() {
  const { t } = useTranslation();
  const rf = useReactFlow();
  const doc = useEditor((s) => s.doc);
  const page = useEditor(selectPage);
  const pageId = page?.id ?? '';
  const layer = useEditor((s) => s.layer);
  const highlight = useEditor((s) => s.highlight);
  const allIssues = useEditor((s) => s.issues);
  const showBadges = usePrefs((s) => s.showProblemBadges);
  // Badges can be turned off (FR-VAL-03); the problems panel still lists everything.
  const issues = useMemo(() => (showBadges ? allIssues : []), [showBadges, allIssues]);
  const selection = useEditor((s) => s.selection);
  const drag = useEditor((s) => s.dragPositions);
  const execute = useEditor((s) => s.execute);
  const setSelection = useEditor((s) => s.setSelection);
  const setDrag = useEditor((s) => s.setDragPositions);
  const endGesture = useEditor((s) => s.endGesture);
  const readOnly = useEditor((s) => s.readOnly);
  const prefs = usePrefs();
  const openDialog = useUi((s) => s.open);
  const setUi = useUi((s) => s.set);
  const pathStart = useUi((s) => s.pathStart);
  const setHighlight = useEditor((s) => s.setHighlight);
  const [guides, setGuides] = useState<Guide>({});
  // Controlled flow: keep React Flow's measured sizes so nodes render and cull correctly.
  const dims = useRef(new Map<string, { width: number; height: number }>());
  const [dimsVersion, bumpDims] = useState(0);
  // Previous node and edge objects, reused when unchanged (NFR-PERF-04).
  const prevNodes = useRef<Node[]>([]);
  const prevEdges = useRef<NetworkEdgeType[]>([]);
  const dragCtx = useRef<{ key: string; carried: Map<string, XY>; origin: Map<string, XY> } | null>(null);

  useEffect(() => {
    canvasApi.instance = rf as unknown as ReactFlowInstance;
  }, [rf]);

  const model = useMemo(
    () => (page ? buildPageModel(doc, page, { layer, highlight, issues, overrides: drag }) : null),
    [doc, page, layer, highlight, issues, drag],
  );

  const sel = useMemo(
    () => new Set([...selection.devices, ...selection.zones, ...selection.annotations, ...selection.links]),
    [selection],
  );

  const lockedLayers = useMemo(
    () => new Set((page?.layers ?? []).filter((l) => l.locked).map((l) => l.id)),
    [page],
  );

  const nodes: Node[] = useMemo(() => {
    if (!model || !page) return [];
    const out: Node[] = [];
    for (const z of model.zones) {
      out.push({
        id: z.zone.id,
        type: 'zone',
        position: { x: z.box.x, y: z.box.y },
        width: z.box.w,
        height: z.box.h,
        zIndex: -1,
        draggable: !z.zone.locked,
        selected: sel.has(z.zone.id),
        data: { view: z, pageId },
      });
    }
    for (const a of model.annotations) {
      const o = drag?.[a.id];
      const assetUrl = assetDataUrl(a.assetId ? doc.assets[a.assetId] : undefined);
      out.push({
        id: a.id,
        type: 'annotation',
        position: o ?? { x: a.geometry.x, y: a.geometry.y },
        width: a.geometry.w,
        height: a.geometry.h,
        draggable: !a.locked && !lockedLayers.has(a.layerId ?? ''),
        selected: sel.has(a.id),
        zIndex: 0,
        data: {
          annotation: a,
          pageId,
          assetUrl,
        },
      });
    }
    for (const dv of model.devices) {
      // The hover card text only depends on the device and the links (NFR-PERF-04: cached by object).
      let summary = summaryCache.get(dv.device);
      if (!summary || summary.links !== doc.links) {
        const s = deviceSummary(doc, dv.device);
        summary = {
          links: doc.links,
          text: [
            s.hostname,
            s.role,
            s.model,
            s.mgmtIp && `mgmt ${s.mgmtIp}`,
            `${s.usedCount}/${s.interfaceCount} interfaces used`,
          ]
            .filter(Boolean)
            .join('\n'),
        };
        summaryCache.set(dv.device, summary);
      }
      out.push({
        id: dv.device.id,
        type: 'device',
        position: nodeTopLeft(dv.center),
        draggable: !dv.device.locked,
        selected: sel.has(dv.device.id),
        zIndex: 1,
        ariaLabel: `${dv.device.hostname}`,
        data: {
          view: dv,
          iconStyle: doc.settings.iconStyle,
          iconUrl: customIconUrl(doc, dv.device.iconOverride),
          summary: summary.text,
        },
      });
    }
    for (const n of out) {
      const m = dims.current.get(n.id);
      if (m) n.measured = m;
    }
    for (const o of model.offPage) {
      out.push({
        id: `offpage:${o.deviceId}`,
        type: 'offpage',
        position: drag?.[`offpage:${o.deviceId}`] ?? o.position,
        draggable: !readOnly,
        selectable: false,
        data: { hostname: o.hostname, pageName: o.pageName },
      });
    }
    prevNodes.current = stabilize(prevNodes.current, out, 5);
    return prevNodes.current;
    // dimsVersion re-runs this when the measured-size ref changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, page, pageId, sel, drag, doc, dimsVersion, lockedLayers, readOnly]);

  const edges: NetworkEdgeType[] = useMemo(() => {
    const next: NetworkEdgeType[] = (model?.links ?? []).map((l) => ({
      id: l.link.id,
      type: 'network',
      source: l.sourceId,
      target: l.targetId,
      selected: sel.has(l.link.id),
      data: { view: l },
    }));
    prevEdges.current = stabilize(prevEdges.current, next, 6);
    return prevEdges.current;
  }, [model, sel]);

  // ---------------------------------------------------------------- dragging

  const centersExcept = useCallback(
    (ids: Set<string>) => (model?.devices ?? []).filter((d) => !ids.has(d.device.id)).map((d) => d.center),
    [model],
  );

  const onNodeDragStart = useCallback(
    (_: unknown, node: Node, dragged: Node[]) => {
      if (!page) return;
      const carried = new Map<string, XY>();
      const origin = new Map<string, XY>();
      // Moving a zone carries the devices and annotations inside it (FR-CAN-11).
      for (const n of dragged) {
        origin.set(n.id, { ...n.position });
        if (n.type !== 'zone') continue;
        const box = page.zoneBoxes[n.id];
        if (!box) continue;
        for (const [id, c] of Object.entries(page.nodePositions)) {
          if (
            c.x >= box.x &&
            c.x <= box.x + box.w &&
            c.y >= box.y &&
            c.y <= box.y + box.h &&
            !dragged.some((d) => d.id === id)
          )
            carried.set(id, c);
        }
        for (const a of page.annotations) {
          const g = a.geometry;
          if (g.x >= box.x && g.y >= box.y && g.x + g.w <= box.x + box.w && g.y + g.h <= box.y + box.h)
            carried.set(a.id, { x: g.x, y: g.y });
        }
        // Nested zones move with their parent: children by parentZoneId (at any depth) and zones drawn inside.
        const isDescendant = (zoneId: string): boolean => {
          const seen = new Set<string>();
          let z = doc.zones.find((x) => x.id === zoneId);
          while (z?.parentZoneId && !seen.has(z.id)) {
            if (z.parentZoneId === n.id) return true;
            seen.add(z.id);
            z = doc.zones.find((x) => x.id === z?.parentZoneId);
          }
          return false;
        };
        for (const [id, b] of Object.entries(page.zoneBoxes)) {
          if (id === n.id || dragged.some((d) => d.id === id)) continue;
          const inside =
            b.x >= box.x && b.y >= box.y && b.x + b.w <= box.x + box.w && b.y + b.h <= box.y + box.h;
          if (inside || isDescendant(id)) {
            carried.set(id, { x: b.x, y: b.y });
            // Devices inside a carried zone come too, even where it sticks out of the parent.
            for (const [did, c] of Object.entries(page.nodePositions))
              if (c.x >= b.x && c.x <= b.x + b.w && c.y >= b.y && c.y <= b.y + b.h) carried.set(did, c);
          }
        }
      }
      dragCtx.current = { key: `drag-${Date.now()}-${node.id}`, carried, origin };
    },
    [page, doc.zones],
  );

  const applySelect = useCallback(
    (changes: { id: string; selected: boolean }[], kind: 'nodes' | 'edges') => {
      if (!changes.length) return;
      const cur = useEditor.getState().selection;
      const byId = new Map(nodes.map((n) => [n.id, n.type]));
      const next = {
        devices: new Set(cur.devices),
        zones: new Set(cur.zones),
        annotations: new Set(cur.annotations),
        links: new Set(cur.links),
      };
      for (const c of changes) {
        const bucket =
          kind === 'edges'
            ? next.links
            : byId.get(c.id) === 'zone'
              ? next.zones
              : byId.get(c.id) === 'annotation'
                ? next.annotations
                : byId.get(c.id) === 'device'
                  ? next.devices
                  : null;
        if (!bucket) continue;
        if (c.selected) bucket.add(c.id);
        else bucket.delete(c.id);
      }
      setSelection({
        devices: [...next.devices],
        zones: [...next.zones],
        annotations: [...next.annotations],
        links: [...next.links],
      });
    },
    [nodes, setSelection],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      applySelect(
        changes.filter((c): c is Extract<EdgeChange, { type: 'select' }> => c.type === 'select'),
        'edges',
      ),
    [applySelect],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      let measured = false;
      for (const c of changes) {
        if (c.type === 'dimensions' && c.dimensions) {
          dims.current.set(c.id, c.dimensions);
          measured = true;
        }
      }
      if (measured) bumpDims((n) => n + 1);
      applySelect(
        changes.filter((c): c is Extract<NodeChange, { type: 'select' }> => c.type === 'select'),
        'nodes',
      );
      if (readOnly) return;
      const moves = changes.filter(
        (c): c is Extract<NodeChange, { type: 'position' }> => c.type === 'position' && !!c.position,
      );
      if (!moves.length || !model) return;
      const next: Record<string, XY> = { ...(drag ?? {}) };
      let guide: Guide = {};
      for (const m of moves) {
        const node = nodes.find((n) => n.id === m.id);
        if (!node || !m.position) continue;
        if (node.type === 'device') {
          let c = nodeCenter(m.position);
          // Smart alignment guides against other devices (FR-CAN-02).
          if (moves.length === 1) {
            const others = centersExcept(new Set([m.id]));
            const gx = others.find((o) => Math.abs(o.x - c.x) <= SNAP_GUIDE);
            const gy = others.find((o) => Math.abs(o.y - c.y) <= SNAP_GUIDE);
            if (gx) c = { ...c, x: gx.x };
            if (gy) c = { ...c, y: gy.y };
            guide = { x: gx?.x, y: gy?.y };
          }
          next[m.id] = c;
        } else {
          next[m.id] = m.position;
          if (node.type === 'zone' && dragCtx.current) {
            const start = dragCtx.current.origin.get(m.id);
            if (start) {
              const dx = m.position.x - start.x;
              const dy = m.position.y - start.y;
              for (const [id, p] of dragCtx.current.carried) next[id] = { x: p.x + dx, y: p.y + dy };
            }
          }
        }
      }
      setGuides(guide);
      setDrag(next);
    },
    [readOnly, model, drag, nodes, centersExcept, setDrag, applySelect],
  );

  const onNodeDragStop = useCallback(() => {
    setGuides({});
    const positions = useEditor.getState().dragPositions;
    setDrag(null);
    if (!positions || !page) return;
    const cmds: Command[] = [];
    const moveMap: Record<string, XY> = {};
    for (const [id, p] of Object.entries(positions)) {
      const ann = page.annotations.find((a) => a.id === id);
      if (ann) cmds.push(updateAnnotation(pageId, id, { geometry: { ...ann.geometry, x: p.x, y: p.y } }));
      else if (id.startsWith('offpage:'))
        cmds.push(addOffPageRef(pageId, id.slice(8), { x: Math.round(p.x), y: Math.round(p.y) }));
      else moveMap[id] = p;
    }
    if (Object.keys(moveMap).length) cmds.unshift(moveNodes(pageId, moveMap));
    // Update zone membership for moved devices.
    for (const [id, c] of Object.entries(moveMap)) {
      const dev = doc.devices.find((d) => d.id === id);
      if (!dev) continue;
      const inside = doc.zones
        .flatMap((z) => {
          const box = page.zoneBoxes[z.id];
          if (!box) return [];
          const o = positions[z.id];
          const b = o ? { ...box, x: o.x, y: o.y } : box;
          return c.x >= b.x && c.x <= b.x + b.w && c.y >= b.y && c.y <= b.y + b.h
            ? [{ z, area: b.w * b.h }]
            : [];
        })
        .sort((p, q) => p.area - q.area)[0];
      const zoneId = inside?.z.id;
      if (zoneId !== dev.zoneId) cmds.push(updateDevices([id], zoneId ? { zoneId } : { zoneId: undefined }));
    }
    if (cmds.length) execute(cmds.length === 1 ? (cmds[0] as Command) : { ...batch('Move', cmds) });
    endGesture();
    dragCtx.current = null;
  }, [page, pageId, doc, execute, setDrag, endGesture]);

  // ---------------------------------------------------------------- selection

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      // Path highlight tool: first click picks the start, second the end (FR-NET-33).
      if (pathStart !== null && node.type === 'device') {
        if (pathStart === '') setUi({ pathStart: node.id });
        else {
          setHighlight({ kind: 'path', from: pathStart, to: node.id });
          setUi({ pathStart: null });
        }
      }
    },
    [pathStart, setUi, setHighlight],
  );

  // Off-page reference: double-click jumps to the device's own page (FR-CAN-12).
  const onNodeDoubleClick = useCallback(
    (_: unknown, node: Node) => {
      if (node.type !== 'offpage') return;
      const deviceId = node.id.slice(8);
      const home = doc.pages.find((p) => p.nodePositions[deviceId]);
      if (!home) return;
      useEditor.getState().setPage(home.id);
      useEditor.getState().setSelection({ devices: [deviceId] });
      requestAnimationFrame(() => canvasApi.focusOn([deviceId]));
    },
    [doc],
  );

  // Double-click a link to add a bend point where you clicked (FR-LNK-02).
  const onEdgeDoubleClick = useCallback(
    (e: ReactMouseEvent, edge: Edge) => {
      if (readOnly) return;
      const view = model?.links.find((l) => l.link.id === edge.id);
      const inst = canvasApi.instance;
      if (!view || !inst) return;
      const sNode = inst.getInternalNode(view.sourceId);
      const tNode = inst.getInternalNode(view.targetId);
      if (!sNode || !tNode) return;
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const pts = linkPoints(anchorOf(sNode), anchorOf(tNode), view.routing, view.offset, view.waypoints);
      let best = 0;
      let bestD = Infinity;
      for (let i = 1; i < pts.length; i++) {
        const dd = distanceToPolyline(p, [pts[i - 1] as XY, pts[i] as XY]);
        if (dd < bestD) {
          bestD = dd;
          best = i - 1;
        }
      }
      // With no bends yet, orthogonal and curved links become straight segments through the new point.
      const wps = [...view.waypoints];
      wps.splice(view.waypoints.length ? best : 0, 0, { x: Math.round(p.x), y: Math.round(p.y) });
      execute(updateLinkStyle([view.link.id], { waypoints: wps }));
      setSelection({ links: [view.link.id] });
    },
    [readOnly, model, rf, execute, setSelection],
  );

  // ---------------------------------------------------------------- connect & drop

  const onConnect = useCallback(
    (c: Connection) => {
      if (readOnly || !c.source || !c.target || c.source === c.target) return;
      const isDevice = (id: string) => doc.devices.some((d) => d.id === id);
      if (!isDevice(c.source) || !isDevice(c.target)) return;
      openDialog({ kind: 'connect', sourceId: c.source, targetId: c.target });
    },
    [readOnly, doc, openDialog],
  );

  // Dropping a link on a device body (not just near a handle) also connects (FR-LNK-01).
  const onConnectEnd = useCallback(
    (e: MouseEvent | TouchEvent, state: { isValid: boolean | null; fromNode: { id: string } | null }) => {
      if (readOnly || state.isValid || !state.fromNode) return;
      const p = 'changedTouches' in e ? e.changedTouches[0] : e;
      if (!p) return;
      // Hit-test by geometry: during a connection drag the nodes are not hit-testable in the DOM.
      const f = rf.screenToFlowPosition({ x: p.clientX, y: p.clientY });
      const devices = new Set(doc.devices.map((d) => d.id));
      const positions = Object.fromEntries(
        Object.entries(page?.nodePositions ?? {}).filter(([id]) => devices.has(id)),
      );
      const targetId = deviceAt(positions, f, state.fromNode.id);
      if (!targetId || targetId === state.fromNode.id) return;
      if (!doc.devices.some((d) => d.id === state.fromNode?.id)) return;
      openDialog({ kind: 'connect', sourceId: state.fromNode.id, targetId });
    },
    [readOnly, doc, page, rf, openDialog],
  );

  const onDragOver = useCallback((e: DragEvent) => {
    if (e.dataTransfer.types.includes(TEMPLATE_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      const id = e.dataTransfer.getData(TEMPLATE_MIME);
      if (!id || !page || readOnly) return;
      e.preventDefault();
      const tpl = getTemplate(id) ?? usePrefs.getState().customTemplates.find((x) => x.id === id);
      if (!tpl) return;
      usePrefs.getState().noteTemplateUse(id);
      const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const opts = { role: tpl.role, pageId, position: pos, template: tpl };
      // Dropped onto a link: insert inline, splitting the link (FR-CAN-09).
      const hit = model?.links.find((l) => {
        const a = model.devices.find((d) => d.device.id === l.sourceId)?.center;
        const b = model.devices.find((d) => d.device.id === l.targetId)?.center;
        return a && b && distanceToPolyline(pos, linkPoints(a, b, l.routing, l.offset, l.waypoints)) < 10;
      });
      const cmd = hit ? insertDeviceOnLink(hit.link.id, opts) : addDevice(opts);
      if (execute(cmd)) setSelection({ devices: [cmd.deviceId] });
    },
    [page, pageId, readOnly, rf, model, execute, setSelection],
  );

  const onDelete = useCallback(({ nodes: ns, edges: es }: { nodes: Node[]; edges: Edge[] }) => {
    const ids = [...ns.map((n) => n.id), ...es.map((x) => x.id)].filter((id) => !id.startsWith('offpage:'));
    if (ids.length) window.dispatchEvent(new CustomEvent('linewise:delete', { detail: ids }));
  }, []);

  if (!page) return null;
  return (
    <div className="relative h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        zoomOnDoubleClick={false}
        disableKeyboardA11y
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onDelete={onDelete}
        connectionMode={ConnectionMode.Loose}
        selectionMode={SelectionMode.Partial}
        selectionOnDrag
        // FR-CAN-01: wheel and two-finger scroll pan; Ctrl/Cmd+wheel and pinch zoom (10%–400%);
        // middle- or right-button drag and Space+drag pan.
        panOnScroll
        zoomActivationKeyCode={['Meta', 'Control']}
        zoomOnPinch
        panOnDrag={[1, 2]}
        panActivationKeyCode="Space"
        multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
        deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
        snapToGrid={prefs.snapToGrid}
        snapGrid={[prefs.gridSize / 2, prefs.gridSize / 2]}
        minZoom={0.1}
        maxZoom={4}
        onlyRenderVisibleElements
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elevateEdgesOnSelect
        fitView
        fitViewOptions={{ padding: fitPadding(prefs.showMinimap), maxZoom: 1 }}
        onMoveEnd={(_, vp) => setUi({ zoom: vp.zoom })}
        attributionPosition="bottom-center"
        aria-label={t('canvas.label', 'Diagram canvas')}
      >
        {prefs.showGrid && (
          <Background
            variant={page.background === 'grid' ? BackgroundVariant.Lines : BackgroundVariant.Dots}
            gap={prefs.gridSize}
            size={1.2}
          />
        )}
        {prefs.showMinimap && (
          <MiniMap
            pannable
            zoomable
            ariaLabel={t('canvas.minimap', 'Minimap')}
            nodeColor={(n) => (n.type === 'zone' ? 'transparent' : 'var(--device)')}
            nodeStrokeColor={(n) => (n.type === 'zone' ? 'var(--accent)' : 'transparent')}
          />
        )}
        <Controls showInteractive={false} position="bottom-left" />
        <svg width="0" height="0" aria-hidden="true">
          <defs>
            <marker
              id="lw-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0 0L10 5L0 10z" fill="var(--text)" />
            </marker>
          </defs>
        </svg>
        <ViewportPortal>
          {guides.x !== undefined && (
            <div
              data-lw-guide="x"
              className="pointer-events-none absolute w-px bg-[var(--accent)]"
              style={{ left: guides.x, top: -100000, height: 200000, opacity: 0.6 }}
            />
          )}
          {guides.y !== undefined && (
            <div
              data-lw-guide="y"
              className="pointer-events-none absolute h-px bg-[var(--accent)]"
              style={{ top: guides.y, left: -100000, width: 200000, opacity: 0.6 }}
            />
          )}
        </ViewportPortal>
      </ReactFlow>
      {pathStart !== null && (
        <div
          role="status"
          className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs text-surface shadow"
        >
          {pathStart
            ? t('canvas.pathEnd', 'Click the second device')
            : t('canvas.pathStart', 'Click the first device of the path')}{' '}
          · Esc
        </div>
      )}
      {doc.devices.length === 0 && page.annotations.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-xs text-center text-muted">
            <p className="font-brand text-[15px] font-semibold text-ink">
              {t('canvas.emptyTitle', 'Start your network')}
            </p>
            <p className="mt-1 text-xs">
              {t(
                'canvas.emptyHint',
                'Drag a device from the library, or import Cisco CLI output with File → Import.',
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
