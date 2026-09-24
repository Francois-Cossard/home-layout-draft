import { Circle, Minus, Plus, RectangleHorizontal, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { deleteFurnitureDefinition, loadFurnitureLibrary, saveFurnitureDefinition } from "@/lib/plan/storage";
import { useEditor } from "@/lib/plan/store";
import { uid } from "@/lib/plan/geometry";
import type { FurnitureDefinition, FurniturePrimitive, Point } from "@/lib/plan/types";

type ShapeTool = "line" | "rect" | "circle";

export function FurnitureLibrary({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState(loadFurnitureLibrary);
  const [building, setBuilding] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const setTool = useEditor((s) => s.setTool);

  const place = (id: string) => {
    setActiveId(id);
    window.sessionStorage.setItem("planche.activeFurniture", id);
    setTool("furniture");
  };

  if (building) {
    return <FurnitureBuilder onCancel={() => setBuilding(false)} onSaved={(item) => { setItems(loadFurnitureLibrary()); setBuilding(false); place(item.id); }} />;
  }

  return (
    <section className="absolute top-3 left-3 z-30 flex max-h-[calc(100%-1.5rem)] w-72 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-float" aria-label="Furniture library">
      <header className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div><p className="label-caps">Library</p><h2 className="text-sm font-semibold">Furniture</h2></div>
        <button type="button" className="tool-btn h-8 w-8" onClick={onClose} aria-label="Close furniture library"><X className="h-4 w-4" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <button type="button" className="btn-outline w-full" onClick={() => setBuilding(true)}><Plus className="h-4 w-4" /> Create furniture</button>
        <div className="mt-3 space-y-2">
          {items.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No saved furniture yet.</p>}
          {items.map((item) => (
            <div key={item.id} className={`flex items-center gap-2 rounded-md border p-2 ${activeId === item.id ? "border-selection bg-selection-soft" : "border-border"}`}>
              <FurniturePreview item={item} />
              <button type="button" className="min-w-0 flex-1 text-left text-sm font-medium" onClick={() => place(item.id)}>{item.name}</button>
              <button type="button" className="tool-btn h-7 w-7" aria-label={`Delete ${item.name}`} onClick={() => { deleteFurnitureDefinition(item.id); setItems(loadFurnitureLibrary()); }}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FurnitureBuilder({ onCancel, onSaved }: { onCancel: () => void; onSaved: (item: FurnitureDefinition) => void }) {
  const [name, setName] = useState("New furniture");
  const [tool, setTool] = useState<ShapeTool>("rect");
  const [shapes, setShapes] = useState<FurniturePrimitive[]>([]);
  const [draft, setDraft] = useState<{ start: Point; end: Point } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const point = (e: RPointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: Math.round((e.clientX - rect.left) / 5) * 5, y: Math.round((e.clientY - rect.top) / 5) * 5 };
  };
  const finish = () => {
    if (!draft) return;
    const { start: a, end: b } = draft;
    const width = Math.abs(b.x - a.x), height = Math.abs(b.y - a.y);
    let shape: FurniturePrimitive | null = null;
    if (tool === "line" && Math.hypot(width, height) > 4) shape = { id: uid(), kind: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    if (tool === "rect" && width > 4 && height > 4) shape = { id: uid(), kind: "rect", x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width, height };
    if (tool === "circle" && Math.hypot(width, height) > 4) shape = { id: uid(), kind: "circle", cx: a.x, cy: a.y, radius: Math.hypot(b.x - a.x, b.y - a.y) };
    if (shape) setShapes((all) => [...all, shape]);
    setDraft(null);
  };
  const bounds = useMemo(() => primitiveBounds(shapes), [shapes]);
  const save = () => {
    if (!shapes.length) return;
    const normalized = shapes.map((shape) => normalizePrimitive(shape, bounds.minX, bounds.minY));
    const item: FurnitureDefinition = { id: uid(), name: name.trim() || "Furniture", width: Math.max(10, bounds.maxX - bounds.minX), height: Math.max(10, bounds.maxY - bounds.minY), primitives: normalized, created_at: new Date().toISOString() };
    saveFurnitureDefinition(item); onSaved(item);
  };
  return (
    <section className="absolute top-3 left-3 z-30 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-float">
      <header className="flex items-center justify-between border-b border-border px-3 py-2.5"><div><p className="label-caps">Symbol builder</p><h2 className="text-sm font-semibold">Create furniture</h2></div><button type="button" className="tool-btn h-8 w-8" onClick={onCancel} aria-label="Close"><X className="h-4 w-4" /></button></header>
      <div className="p-3">
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} aria-label="Furniture name" />
        <div className="my-3 flex gap-1">{([ ["line", Minus], ["rect", RectangleHorizontal], ["circle", Circle] ] as const).map(([id, Icon]) => <button key={id} type="button" className={`tool-btn border border-border ${tool === id ? "tool-btn-active" : ""}`} onClick={() => setTool(id)} title={`Draw ${id}`}><Icon className="h-4 w-4" /></button>)}</div>
        <svg ref={svgRef} className="h-56 w-full touch-none rounded-md border border-border bg-paper" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const p = point(e); setDraft({ start: p, end: p }); }} onPointerMove={(e) => draft && setDraft({ ...draft, end: point(e) })} onPointerUp={finish}>
          <defs><pattern id="builder-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" className="stroke-grid-minor" fill="none" /></pattern></defs><rect width="100%" height="100%" fill="url(#builder-grid)" />
          {shapes.map((shape) => <Primitive key={shape.id} shape={shape} />)}{draft && <Primitive shape={draftPrimitive(tool, draft.start, draft.end)} preview />}
        </svg>
        <div className="mt-3 flex justify-between"><button type="button" className="btn-ghost" disabled={!shapes.length} onClick={() => setShapes((all) => all.slice(0, -1))}>Undo</button><button type="button" className="btn-primary" disabled={!shapes.length} onClick={save}>Save furniture</button></div>
      </div>
    </section>
  );
}

export function Primitive({ shape, preview = false, strokeWidth = 2 }: { shape: FurniturePrimitive; preview?: boolean; strokeWidth?: number }) {
  const cls = preview ? "stroke-blueprint" : "stroke-ink";
  if (shape.kind === "line") return <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} className={cls} strokeWidth={strokeWidth} />;
  if (shape.kind === "rect") return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} className={`${cls} fill-none`} strokeWidth={strokeWidth} />;
  return <circle cx={shape.cx} cy={shape.cy} r={shape.radius} className={`${cls} fill-none`} strokeWidth={strokeWidth} />;
}

function FurniturePreview({ item }: { item: FurnitureDefinition }) { return <svg viewBox={`-5 -5 ${item.width + 10} ${item.height + 10}`} className="h-10 w-12 shrink-0 bg-paper">{item.primitives.map((shape) => <Primitive key={shape.id} shape={shape} />)}</svg>; }
function draftPrimitive(tool: ShapeTool, a: Point, b: Point): FurniturePrimitive { if (tool === "line") return { id: "draft", kind: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y }; if (tool === "rect") return { id: "draft", kind: "rect", x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x-a.x), height: Math.abs(b.y-a.y) }; return { id: "draft", kind: "circle", cx: a.x, cy: a.y, radius: Math.hypot(b.x-a.x,b.y-a.y) }; }
function primitiveBounds(shapes: FurniturePrimitive[]) { let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity; for(const s of shapes){ if(s.kind==="line"){minX=Math.min(minX,s.x1,s.x2);minY=Math.min(minY,s.y1,s.y2);maxX=Math.max(maxX,s.x1,s.x2);maxY=Math.max(maxY,s.y1,s.y2);} else if(s.kind==="rect"){minX=Math.min(minX,s.x);minY=Math.min(minY,s.y);maxX=Math.max(maxX,s.x+s.width);maxY=Math.max(maxY,s.y+s.height);} else {minX=Math.min(minX,s.cx-s.radius);minY=Math.min(minY,s.cy-s.radius);maxX=Math.max(maxX,s.cx+s.radius);maxY=Math.max(maxY,s.cy+s.radius);} } return {minX,minY,maxX,maxY}; }
function normalizePrimitive(s: FurniturePrimitive, x: number, y: number): FurniturePrimitive { if(s.kind==="line") return {...s,x1:s.x1-x,y1:s.y1-y,x2:s.x2-x,y2:s.y2-y}; if(s.kind==="rect") return {...s,x:s.x-x,y:s.y-y}; return {...s,cx:s.cx-x,cy:s.cy-y}; }
