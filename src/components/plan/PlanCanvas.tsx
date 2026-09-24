import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import {
  clampOpening,
  dist,
  doorGeometry,
  formatArea,
  formatLength,
  furnitureTransform,
  wallDimensionGeometry,
  gridConfig,
  planBounds,
  pointOnWall,
  pointsToPath,
  projectToWall,
  snapPoint,
  uid,
  wallDir,
  wallLength,
  wallSegmentRect,
} from "@/lib/plan/geometry";
import { useEditor } from "@/lib/plan/store";
import { loadFurnitureLibrary } from "@/lib/plan/storage";
import { Primitive } from "./FurnitureLibrary";
import type { Dimension, Door, FurniturePlacement, ElementKind, PlanData, Point, Room, Wall, WindowEl } from "@/lib/plan/types";

interface ViewState {
  zoom: number; // px per cm
  pan: Point; // px
}

type Drag =
  | { kind: "pan"; startClient: Point; startPan: Point }
  | { kind: "move"; elKind: ElementKind; id: string; startWorld: Point; snapshot: PlanData }
  | { kind: "endpoint"; id: string; end: "start" | "end" }
  | { kind: "room-draw"; start: Point }
  | null;

interface ContextMenuState {
  x: number;
  y: number;
}

interface Props {
  readOnly?: boolean;
  onContextMenu?: (state: ContextMenuState | null) => void;
  viewRef?: React.MutableRefObject<{ zoomBy: (f: number) => void; fit: () => void } | null>;
}

const HANDLE_PX = 6;
const HIT_PX = 14;

export function PlanCanvas({ readOnly = false, onContextMenu, viewRef }: Props) {
  const project = useEditor((s) => s.project);
  const tool = useEditor((s) => s.tool);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const commit = useEditor((s) => s.commit);
  const beginDrag = useEditor((s) => s.beginDrag);
  const setTransient = useEditor((s) => s.setTransient);
  const endDrag = useEditor((s) => s.endDrag);
  const setTool = useEditor((s) => s.setTool);

  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<ViewState>({ zoom: 0.6, pan: { x: 80, y: 80 } });
  const [mouse, setMouse] = useState<Point | null>(null);
  const [wallStart, setWallStart] = useState<Point | null>(null);
  const [dimStart, setDimStart] = useState<Point | null>(null);
  const [hoverWallId, setHoverWallId] = useState<string | null>(null);
  const [roomDraft, setRoomDraft] = useState<{ a: Point; b: Point } | null>(null);
  const [wallType, setWallType] = useState<Wall["wall_type"]>("structural");
  const dragRef = useRef<Drag>(null);
  const spaceRef = useRef(false);

  const units = project?.units ?? "metric";
  const grid = gridConfig(units);

  /* ---------- sizing ---------- */
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /* ---------- view helpers ---------- */
  const toWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = svgRef.current!.getBoundingClientRect();
      return {
        x: (clientX - rect.left - view.pan.x) / view.zoom,
        y: (clientY - rect.top - view.pan.y) / view.zoom,
      };
    },
    [view],
  );

  const fit = useCallback(() => {
    if (!project) return;
    const b = planBounds(project);
    const pad = 120;
    const w = b.maxX - b.minX + pad * 2;
    const h = b.maxY - b.minY + pad * 2;
    const zoom = Math.max(0.1, Math.min(size.w / w, size.h / h, 3));
    setView({
      zoom,
      pan: {
        x: (size.w - (b.maxX - b.minX) * zoom) / 2 - b.minX * zoom,
        y: (size.h - (b.maxY - b.minY) * zoom) / 2 - b.minY * zoom,
      },
    });
  }, [project, size]);

  const zoomBy = useCallback(
    (factor: number, center?: Point) => {
      setView((v) => {
        const c = center ?? { x: size.w / 2, y: size.h / 2 };
        const zoom = Math.max(0.08, Math.min(6, v.zoom * factor));
        const wx = (c.x - v.pan.x) / v.zoom;
        const wy = (c.y - v.pan.y) / v.zoom;
        return { zoom, pan: { x: c.x - wx * zoom, y: c.y - wy * zoom } };
      });
    },
    [size],
  );

  useEffect(() => {
    if (viewRef) viewRef.current = { zoomBy: (f) => zoomBy(f), fit };
  }, [viewRef, zoomBy, fit]);

  // Fit once when a project loads / size is known
  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (project && fittedFor.current !== project.id && size.w > 0) {
      fittedFor.current = project.id;
      fit();
    }
  }, [project, size, fit]);

  /* ---------- keyboard: space to pan, Esc handled by parent ---------- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) spaceRef.current = true;
      if (e.key === "Escape") {
        setWallStart(null);
        setDimStart(null);
        setRoomDraft(null);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    setWallStart(null);
    setDimStart(null);
    setRoomDraft(null);
  }, [tool]);

  /* ---------- snapping ---------- */
  const snapWorld = useCallback(
    (p: Point): Point => {
      if (!project) return p;
      const tol = HIT_PX / view.zoom;
      for (const w of project.walls) {
        const s = { x: w.start_x, y: w.start_y };
        const e = { x: w.end_x, y: w.end_y };
        if (dist(p, s) < tol) return s;
        if (dist(p, e) < tol) return e;
      }
      return snapPoint(p, grid.snap);
    },
    [project, view.zoom, grid.snap],
  );

  const nearestWall = useCallback(
    (p: Point): Wall | null => {
      if (!project) return null;
      let best: Wall | null = null;
      let bestD = Infinity;
      for (const w of project.walls) {
        const { distance } = projectToWall(p, w);
        if (distance < w.thickness / 2 + HIT_PX / view.zoom && distance < bestD) {
          best = w;
          bestD = distance;
        }
      }
      return best;
    },
    [project, view.zoom],
  );

  /* ---------- pointer handlers ---------- */
  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (!project) return;
    if (e.button === 2) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    onContextMenu?.(null);

    const isPan = e.button === 1 || spaceRef.current || readOnly || (tool === "select" && e.target === e.currentTarget);
    if (isPan) {
      dragRef.current = { kind: "pan", startClient: { x: e.clientX, y: e.clientY }, startPan: view.pan };
      if (tool === "select" && e.target === e.currentTarget && !spaceRef.current) select(null);
      return;
    }
    if (readOnly) return;

    const raw = toWorld(e.clientX, e.clientY);
    const p = snapWorld(raw);

    switch (tool) {
      case "wall": {
        if (!wallStart) {
          setWallStart(p);
        } else if (dist(wallStart, p) >= grid.snap) {
          const w: Wall = {
            id: uid(),
            project_id: project.id,
            start_x: wallStart.x,
            start_y: wallStart.y,
            end_x: p.x,
            end_y: p.y,
            thickness: wallType === "structural" ? 20 : 10,
            wall_type: wallType,
          };
          commit((d) => ({ ...d, walls: [...d.walls, w] }));
          setWallStart(p);
        }
        break;
      }
      case "room": {
        dragRef.current = { kind: "room-draw", start: p };
        setRoomDraft({ a: p, b: p });
        break;
      }
      case "door":
      case "window": {
        const w = nearestWall(raw);
        if (!w) break;
        const width = tool === "door" ? 80 : 120;
        const t = clampOpening(projectToWall(raw, w).t, width, w);
        if (tool === "door") {
          const door: Door = {
            id: uid(),
            project_id: project.id,
            wall_id: w.id,
            position_along_wall: Math.round(t),
            width,
            swing_direction: "left-in",
          };
          commit((d) => ({ ...d, doors: [...d.doors, door] }));
          select({ kind: "door", id: door.id });
        } else {
          const win: WindowEl = {
            id: uid(),
            project_id: project.id,
            wall_id: w.id,
            position_along_wall: Math.round(t),
            width,
          };
          commit((d) => ({ ...d, windows: [...d.windows, win] }));
          select({ kind: "window", id: win.id });
        }
        break;
      }
      case "furniture": {
        const id = window.sessionStorage.getItem("planche.activeFurniture");
        const def = loadFurnitureLibrary().find((x) => x.id === id);
        if (!def) break;
        const item: FurniturePlacement = {
          id: uid(),
          project_id: project.id,
          definition_id: def.id,
          name: def.name,
          center_x: p.x,
          center_y: p.y,
          rotation: 0,
          width: def.width,
          height: def.height,
          primitives: def.primitives,
        };
        commit((d) => ({ ...d, furniture: [...d.furniture, item] }));
        setTool("select");
        select({ kind: "furniture", id: item.id });
        break;
      }
      case "dimension": {
        if (!dimStart) setDimStart(p);
        else if (dist(dimStart, p) > 1) {
          const dim: Dimension = {
            id: uid(),
            project_id: project.id,
            start_x: dimStart.x,
            start_y: dimStart.y,
            end_x: p.x,
            end_y: p.y,
          };
          commit((d) => ({ ...d, dimensions: [...d.dimensions, dim] }));
          setDimStart(null);
        }
        break;
      }
    }
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!project) return;
    const raw = toWorld(e.clientX, e.clientY);
    const drag = dragRef.current;

    if (drag?.kind === "pan") {
      setView((v) => ({
        ...v,
        pan: {
          x: drag.startPan.x + (e.clientX - drag.startClient.x),
          y: drag.startPan.y + (e.clientY - drag.startClient.y),
        },
      }));
      return;
    }

    if (tool === "door" || tool === "window") {
      setHoverWallId(nearestWall(raw)?.id ?? null);
    } else if (hoverWallId) setHoverWallId(null);

    const snapped = snapWorld(raw);
    setMouse(snapped);

    if (!drag) return;

    if (drag.kind === "room-draw") {
      setRoomDraft({ a: drag.start, b: snapped });
      return;
    }

    if (drag.kind === "endpoint") {
      setTransient((d) => ({
        ...d,
        walls: d.walls.map((w) =>
          w.id === drag.id
            ? drag.end === "start"
              ? { ...w, start_x: snapped.x, start_y: snapped.y }
              : { ...w, end_x: snapped.x, end_y: snapped.y }
            : w,
        ),
      }));
      return;
    }

    if (drag.kind === "move") {
      const dx = snapPoint({ x: raw.x - drag.startWorld.x, y: raw.y - drag.startWorld.y }, grid.snap);
      const snap = drag.snapshot;
      switch (drag.elKind) {
        case "wall":
          setTransient((d) => ({
            ...d,
            walls: d.walls.map((w) => {
              if (w.id !== drag.id) return w;
              const o = snap.walls.find((x) => x.id === w.id)!;
              return {
                ...w,
                start_x: o.start_x + dx.x,
                start_y: o.start_y + dx.y,
                end_x: o.end_x + dx.x,
                end_y: o.end_y + dx.y,
              };
            }),
          }));
          break;
        case "room":
          setTransient((d) => ({
            ...d,
            rooms: d.rooms.map((r) => {
              if (r.id !== drag.id) return r;
              const o = snap.rooms.find((x) => x.id === r.id)!;
              return { ...r, center_x: o.center_x + dx.x, center_y: o.center_y + dx.y };
            }),
          }));
          break;
        case "dimension":
          setTransient((d) => ({
            ...d,
            dimensions: d.dimensions.map((r) => {
              if (r.id !== drag.id) return r;
              const o = snap.dimensions.find((x) => x.id === r.id)!;
              return {
                ...r,
                start_x: o.start_x + dx.x,
                start_y: o.start_y + dx.y,
                end_x: o.end_x + dx.x,
                end_y: o.end_y + dx.y,
              };
            }),
          }));
          break;
        case "furniture":
          setTransient((d) => ({
            ...d,
            furniture: d.furniture.map((f) => {
              if (f.id !== drag.id) return f;
              const o = snap.furniture.find((x) => x.id === f.id)!;
              return { ...f, center_x: o.center_x + dx.x, center_y: o.center_y + dx.y };
            }),
          }));
          break;
        case "door":
          setTransient((d) => ({
            ...d,
            doors: d.doors.map((x) => {
              if (x.id !== drag.id) return x;
              const w = d.walls.find((y) => y.id === x.wall_id);
              if (!w) return x;
              const t = clampOpening(projectToWall(raw, w).t, x.width, w);
              return { ...x, position_along_wall: Math.round(t) };
            }),
          }));
          break;
        case "window":
          setTransient((d) => ({
            ...d,
            windows: d.windows.map((x) => {
              if (x.id !== drag.id) return x;
              const w = d.walls.find((y) => y.id === x.wall_id);
              if (!w) return x;
              const t = clampOpening(projectToWall(raw, w).t, x.width, w);
              return { ...x, position_along_wall: Math.round(t) };
            }),
          }));
          break;
      }
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || !project) return;
    if (drag.kind === "room-draw") {
      const draft = roomDraft;
      setRoomDraft(null);
      if (!draft) return;
      const width = Math.abs(draft.b.x - draft.a.x);
      const height = Math.abs(draft.b.y - draft.a.y);
      if (width < 30 || height < 30) return;
      const room: Room = {
        id: uid(),
        project_id: project.id,
        name: `Room ${project.rooms.length + 1}`,
        area: Math.round((width * height) / 100) / 100,
        center_x: (draft.a.x + draft.b.x) / 2,
        center_y: (draft.a.y + draft.b.y) / 2,
        width,
        height,
      };
      commit((d) => ({ ...d, rooms: [...d.rooms, room] }));
      select({ kind: "room", id: room.id });
      setTool("select");
      return;
    }
    if (drag.kind === "move" || drag.kind === "endpoint") {
      // Drop zero-length walls
      setTransient((d) => ({ ...d, walls: d.walls.filter((w) => wallLength(w) >= 1) }));
      endDrag();
    }
  };

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const c = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, c);
  };

  const startMove = (e: RPointerEvent, kind: ElementKind, id: string) => {
    if (readOnly || tool !== "select" || e.button !== 0 || spaceRef.current) return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    select({ kind, id });
    if (!project) return;
    beginDrag();
    dragRef.current = {
      kind: "move",
      elKind: kind,
      id,
      startWorld: toWorld(e.clientX, e.clientY),
      snapshot: {
        walls: project.walls,
        rooms: project.rooms,
        doors: project.doors,
        windows: project.windows,
        dimensions: project.dimensions,
        furniture: project.furniture,
      },
    };
  };

  const startEndpoint = (e: RPointerEvent, id: string, end: "start" | "end") => {
    if (readOnly || e.button !== 0) return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    beginDrag();
    dragRef.current = { kind: "endpoint", id, end };
  };

  const handleContext = (e: React.MouseEvent, kind: ElementKind, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (readOnly) return;
    select({ kind, id });
    onContextMenu?.({ x: e.clientX, y: e.clientY });
  };

  /* ---------- grid ---------- */
  const gridLines = useMemo(() => {
    const x0 = -view.pan.x / view.zoom;
    const y0 = -view.pan.y / view.zoom;
    const x1 = x0 + size.w / view.zoom;
    const y1 = y0 + size.h / view.zoom;
    const minor: string[] = [];
    const major: string[] = [];
    const step = view.zoom < 0.25 ? grid.major : grid.minor;
    const startX = Math.floor(x0 / step) * step;
    const startY = Math.floor(y0 / step) * step;
    for (let x = startX; x <= x1; x += step) {
      const isMajor = Math.abs(x / grid.major - Math.round(x / grid.major)) < 1e-6;
      (isMajor ? major : minor).push(`M${x} ${y0}V${y1}`);
    }
    for (let y = startY; y <= y1; y += step) {
      const isMajor = Math.abs(y / grid.major - Math.round(y / grid.major)) < 1e-6;
      (isMajor ? major : minor).push(`M${x0} ${y}H${x1}`);
    }
    return { minor: minor.join(""), major: major.join("") };
  }, [view, size, grid]);

  if (!project) return null;

  const z = view.zoom;
  const px = (n: number) => n / z; // px → world
  const isSel = (kind: ElementKind, id: string) => selection?.kind === kind && selection.id === id;
  const cursor =
    readOnly ? "grab" : tool === "select" ? "default" : tool === "door" || tool === "window" ? "pointer" : "crosshair";

  return (
    <>
    {tool === "wall" && !readOnly && (
      <div className="panel absolute top-3 left-1/2 z-20 flex -translate-x-1/2 gap-1 p-1 shadow-float">
        {(["structural", "drywall"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setWallType(t)} className={`h-7 rounded px-3 text-xs font-medium capitalize ${wallType === t ? "bg-ink text-paper" : "text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>
    )}
    <svg
      ref={svgRef}
      className="paper-texture h-full w-full touch-none select-none"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setMouse(null)}
      onWheel={onWheel}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(null);
      }}
    >
      <g transform={`translate(${view.pan.x} ${view.pan.y}) scale(${z})`}>
        {/* grid */}
        <path d={gridLines.minor} className="stroke-grid-minor" fill="none" vectorEffect="non-scaling-stroke" />
        <path d={gridLines.major} className="stroke-grid-major" fill="none" vectorEffect="non-scaling-stroke" />
        <path d={`M${-px(size.w)} 0H${px(size.w * 2)}M0 ${-px(size.h)}V${px(size.h * 2)}`} className="stroke-grid-major" strokeWidth={px(1.5)} />

        {/* rooms */}
        {project.rooms.map((r) => {
          const sel = isSel("room", r.id);
          return (
            <g
              key={r.id}
              onPointerDown={(e) => startMove(e, "room", r.id)}
              onContextMenu={(e) => handleContext(e, "room", r.id)}
              style={{ cursor: tool === "select" && !readOnly ? "move" : undefined }}
            >
              <rect
                x={r.center_x - r.width / 2}
                y={r.center_y - r.height / 2}
                width={r.width}
                height={r.height}
                className={sel ? "fill-selection-soft stroke-selection" : "fill-room-fill stroke-blueprint/50"}
                strokeDasharray={`${px(4)} ${px(4)}`}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={r.center_x}
                y={r.center_y - px(4)}
                textAnchor="middle"
                className="fill-ink font-sans font-semibold"
                fontSize={px(14)}
              >
                {r.name}
              </text>
              <text
                x={r.center_x}
                y={r.center_y + px(12)}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={px(11)}
              >
                {formatArea(r.area, units)}
              </text>
            </g>
          );
        })}

        {/* walls */}
        {project.walls.map((w) => {
          const sel = isSel("wall", w.id);
          const hovered = hoverWallId === w.id;
          return (
            <g
              key={w.id}
              onPointerDown={(e) => startMove(e, "wall", w.id)}
              onContextMenu={(e) => handleContext(e, "wall", w.id)}
              style={{ cursor: tool === "select" && !readOnly ? "move" : undefined }}
            >
              <line
                x1={w.start_x}
                y1={w.start_y}
                x2={w.end_x}
                y2={w.end_y}
                strokeWidth={Math.max(w.thickness, px(HIT_PX))}
                stroke="transparent"
                strokeLinecap="square"
              />
              <WallGraphic wall={w} px={px} tone={sel ? "selection" : hovered ? "blueprint" : "ink"} />
              <WallLength wall={w} px={px} units={units} selected={sel} />
            </g>
          );
        })}

        {/* openings */}
        {project.doors.map((d) => {
          const w = project.walls.find((x) => x.id === d.wall_id);
          if (!w) return null;
          const g = doorGeometry(d, w);
          const sel = isSel("door", d.id);
          const cls = sel ? "stroke-selection" : "stroke-ink";
          return (
            <g
              key={d.id}
              onPointerDown={(e) => startMove(e, "door", d.id)}
              onContextMenu={(e) => handleContext(e, "door", d.id)}
              style={{ cursor: tool === "select" && !readOnly ? "ew-resize" : undefined }}
            >
              <path d={pointsToPath(wallSegmentRect(w, d.position_along_wall, d.width, w.thickness + 1), true)} className="fill-paper" />
              <path d={pointsToPath([g.jambA, g.leafEnd, ...g.arc, g.jambA], false)} fill="transparent" />
              <line x1={g.jambA.x} y1={g.jambA.y} x2={g.leafEnd.x} y2={g.leafEnd.y} className={cls} strokeWidth={px(2)} />
              <path d={pointsToPath(g.arc)} className={cls} fill="none" strokeWidth={px(1)} strokeDasharray={`${px(3)} ${px(2)}`} />
            </g>
          );
        })}
        {project.windows.map((win) => {
          const w = project.walls.find((x) => x.id === win.wall_id);
          if (!w) return null;
          const sel = isSel("window", win.id);
          const d = wallDir(w);
          const c = pointOnWall(w, win.position_along_wall);
          const a = { x: c.x - d.x * (win.width / 2), y: c.y - d.y * (win.width / 2) };
          const e = { x: c.x + d.x * (win.width / 2), y: c.y + d.y * (win.width / 2) };
          const cls = sel ? "stroke-selection" : "stroke-ink";
          return (
            <g
              key={win.id}
              onPointerDown={(ev) => startMove(ev, "window", win.id)}
              onContextMenu={(ev) => handleContext(ev, "window", win.id)}
              style={{ cursor: tool === "select" && !readOnly ? "ew-resize" : undefined }}
            >
              <path d={pointsToPath(wallSegmentRect(w, win.position_along_wall, win.width, w.thickness + 1), true)} className="fill-paper" />
              <path
                d={pointsToPath(wallSegmentRect(w, win.position_along_wall, win.width, w.thickness), true)}
                className={`${cls} fill-blueprint-soft`}
                strokeWidth={px(1.5)}
              />
              <line x1={a.x} y1={a.y} x2={e.x} y2={e.y} className={cls} strokeWidth={px(1)} />
            </g>
          );
        })}

        {/* furniture */}
        {project.furniture.map((f) => {
          const sel = isSel("furniture", f.id);
          return (
            <g
              key={f.id}
              transform={furnitureTransform(f)}
              onPointerDown={(e) => startMove(e, "furniture", f.id)}
              onContextMenu={(e) => handleContext(e, "furniture", f.id)}
              style={{ cursor: tool === "select" && !readOnly ? "move" : undefined }}
              className={sel ? "[&_*]:stroke-selection" : undefined}
            >
              <rect x={0} y={0} width={f.width} height={f.height} className={sel ? "fill-selection-soft" : "fill-transparent"} stroke={sel ? undefined : "none"} strokeDasharray={`${px(3)} ${px(3)}`} vectorEffect="non-scaling-stroke" />
              <g vectorEffect="non-scaling-stroke">
                {f.primitives.map((shape) => (
                  <Primitive key={shape.id} shape={shape} strokeWidth={px(1.5)} />
                ))}
              </g>
            </g>
          );
        })}

        {/* dimensions */}
        {project.dimensions.map((dim) => (
          <DimensionLine
            key={dim.id}
            a={{ x: dim.start_x, y: dim.start_y }}
            b={{ x: dim.end_x, y: dim.end_y }}
            px={px}
            units={units}
            selected={isSel("dimension", dim.id)}
            onPointerDown={(e) => startMove(e, "dimension", dim.id)}
            onContextMenu={(e) => handleContext(e, "dimension", dim.id)}
          />
        ))}

        {/* wall endpoint handles */}
        {selection?.kind === "wall" &&
          !readOnly &&
          (() => {
            const w = project.walls.find((x) => x.id === selection.id);
            if (!w) return null;
            return (
              <g>
                {(["start", "end"] as const).map((end) => (
                  <circle
                    key={end}
                    cx={end === "start" ? w.start_x : w.end_x}
                    cy={end === "start" ? w.start_y : w.end_y}
                    r={px(HANDLE_PX)}
                    className="fill-paper stroke-selection"
                    strokeWidth={px(2)}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => startEndpoint(e, w.id, end)}
                  />
                ))}

              </g>
            );
          })()}

        {/* in-progress wall */}
        {wallStart && mouse && (
          <g pointerEvents="none">
{(() => {
              const draft: Wall = { id: "draft", project_id: "", start_x: wallStart.x, start_y: wallStart.y, end_x: mouse.x, end_y: mouse.y, thickness: wallType === "structural" ? 20 : 10, wall_type: wallType };
              if (wallLength(draft) < 1) return null;
              return (
                <g opacity={0.7}>
                  <WallGraphic wall={draft} px={px} tone="blueprint" />
                  <WallLength wall={draft} px={px} units={units} selected />
                </g>
              );
            })()}
          </g>
        )}
        {dimStart && mouse && <DimensionLine a={dimStart} b={mouse} px={px} units={units} selected preview />}
        {roomDraft && (
          <rect
            pointerEvents="none"
            x={Math.min(roomDraft.a.x, roomDraft.b.x)}
            y={Math.min(roomDraft.a.y, roomDraft.b.y)}
            width={Math.abs(roomDraft.b.x - roomDraft.a.x)}
            height={Math.abs(roomDraft.b.y - roomDraft.a.y)}
            className="fill-blueprint-soft stroke-blueprint"
            strokeDasharray={`${px(4)} ${px(4)}`}
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* cursor crosshair */}
        {mouse && !readOnly && (tool === "wall" || tool === "dimension" || tool === "room") && (
          <g pointerEvents="none">
            <circle cx={mouse.x} cy={mouse.y} r={px(4)} className="fill-none stroke-blueprint" strokeWidth={px(1.5)} />
          </g>
        )}
      </g>
    </svg>
    </>
  );
}

function WallGraphic({ wall, px, tone }: { wall: Wall; px: (n: number) => number; tone: "ink" | "selection" | "blueprint" }) {
  const stroke = tone === "selection" ? "stroke-selection" : tone === "blueprint" ? "stroke-blueprint" : "stroke-wall";
  const fill = tone === "selection" ? "fill-selection" : tone === "blueprint" ? "fill-blueprint" : "fill-wall";
  const n = { x: -wallDir(wall).y, y: wallDir(wall).x };
  const h = wall.thickness / 2;
  const pts: [Point, Point, Point, Point] = [
    { x: wall.start_x + n.x * h, y: wall.start_y + n.y * h },
    { x: wall.end_x + n.x * h, y: wall.end_y + n.y * h },
    { x: wall.end_x - n.x * h, y: wall.end_y - n.y * h },
    { x: wall.start_x - n.x * h, y: wall.start_y - n.y * h },
  ];
  if (wall.wall_type === "structural") {
    // Conventional load-bearing wall: solid poché fill
    return <path d={pointsToPath(pts, true)} className={`${fill} ${stroke}`} strokeWidth={px(1)} />;
  }
  // Drywall / partition: two light faces with an open core and closed ends
  return (
    <g>
      <path d={pointsToPath(pts, true)} className="fill-paper" />
      <path d={pointsToPath([pts[0], pts[1]])} className={stroke} fill="none" strokeWidth={px(1.2)} />
      <path d={pointsToPath([pts[3], pts[2]])} className={stroke} fill="none" strokeWidth={px(1.2)} />
      <path d={pointsToPath([pts[0], pts[3]])} className={stroke} fill="none" strokeWidth={px(0.8)} />
      <path d={pointsToPath([pts[1], pts[2]])} className={stroke} fill="none" strokeWidth={px(0.8)} />
      <path d={pointsToPath([pts[0], pts[2]])} className={stroke} fill="none" strokeWidth={px(0.5)} strokeOpacity={0.45} />
    </g>
  );
}

/** AutoCAD-style aligned dimension, always offset on the same (left-hand) side of the wall. */
function WallLength({ wall, px, units, selected }: { wall: Wall; px: (n: number) => number; units: "metric" | "imperial"; selected?: boolean }) {
  const g = wallDimensionGeometry(wall, wall.thickness / 2 + px(18));
  const ext = px(4);
  const n = g.normal;
  const mid = { x: (g.a.x + g.b.x) / 2, y: (g.a.y + g.b.y) / 2 };
  const s = { x: wall.start_x + n.x * (wall.thickness / 2 + px(3)), y: wall.start_y + n.y * (wall.thickness / 2 + px(3)) };
  const e = { x: wall.end_x + n.x * (wall.thickness / 2 + px(3)), y: wall.end_y + n.y * (wall.thickness / 2 + px(3)) };
  const cls = selected ? "stroke-selection" : "stroke-muted-foreground";
  const d = wallDir(wall);
  const tick = px(4);
  return (
    <g pointerEvents="none">
      <line x1={s.x} y1={s.y} x2={g.a.x + n.x * ext} y2={g.a.y + n.y * ext} className={cls} strokeWidth={px(0.7)} />
      <line x1={e.x} y1={e.y} x2={g.b.x + n.x * ext} y2={g.b.y + n.y * ext} className={cls} strokeWidth={px(0.7)} />
      <line x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} className={cls} strokeWidth={px(0.8)} />
      {[g.a, g.b].map((p, i) => (
        <line key={i} x1={p.x - (d.x - n.x) * tick} y1={p.y - (d.y - n.y) * tick} x2={p.x + (d.x - n.x) * tick} y2={p.y + (d.y - n.y) * tick} className={cls} strokeWidth={px(1.2)} />
      ))}
      <text
        x={mid.x}
        y={mid.y}
        transform={`rotate(${g.angle} ${mid.x} ${mid.y}) translate(0 ${-px(4)})`}
        textAnchor="middle"
        className={`${selected ? "fill-selection" : "fill-muted-foreground"} font-mono`}
        fontSize={px(10.5)}
      >
        {formatLength(wallLength(wall), units)}
      </text>
    </g>
  );
}

function DimensionLine({
  a,
  b,
  px,
  units,
  selected,
  preview,
  onPointerDown,
  onContextMenu,
}: {
  a: Point;
  b: Point;
  px: (n: number) => number;
  units: "metric" | "imperial";
  selected?: boolean;
  preview?: boolean;
  onPointerDown?: (e: RPointerEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const len = dist(a, b);
  if (len === 0) return null;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const nx = -uy;
  const ny = ux;
  const tick = px(6);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  let angle = (Math.atan2(uy, ux) * 180) / Math.PI;
  if (angle > 90 || angle < -90) angle += 180;
  const cls = selected ? "stroke-selection" : "stroke-blueprint";
  return (
    <g
      pointerEvents={preview ? "none" : undefined}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      style={{ cursor: onPointerDown ? "move" : undefined }}
    >
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={px(12)} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={cls} strokeWidth={px(1)} />
      <line x1={a.x - nx * tick} y1={a.y - ny * tick} x2={a.x + nx * tick} y2={a.y + ny * tick} className={cls} strokeWidth={px(1)} />
      <line x1={b.x - nx * tick} y1={b.y - ny * tick} x2={b.x + nx * tick} y2={b.y + ny * tick} className={cls} strokeWidth={px(1)} />
      <text
        x={mid.x}
        y={mid.y}
        transform={`rotate(${angle} ${mid.x} ${mid.y}) translate(0 ${-px(5)})`}
        textAnchor="middle"
        className={`${selected ? "fill-selection" : "fill-blueprint"} font-mono`}
        fontSize={px(11)}
      >
        {formatLength(len, units)}
      </text>
    </g>
  );
}
