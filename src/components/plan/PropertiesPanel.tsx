import { Copy, Trash2 } from "lucide-react";
import { formatArea, formatLength, wallDir, wallLength } from "@/lib/plan/geometry";
import { useEditor } from "@/lib/plan/store";
import type { SwingDirection, WallType } from "@/lib/plan/types";

const SWINGS: { value: SwingDirection; label: string }[] = [
  { value: "left-in", label: "Hinge left, opens in" },
  { value: "left-out", label: "Hinge left, opens out" },
  { value: "right-in", label: "Hinge right, opens in" },
  { value: "right-out", label: "Hinge right, opens out" },
];

export function PropertiesPanel() {
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const commit = useEditor((s) => s.commit);
  const deleteSelected = useEditor((s) => s.deleteSelected);
  const duplicateSelected = useEditor((s) => s.duplicateSelected);
  const tool = useEditor((s) => s.tool);

  if (!project) return null;
  const units = project.units;

  let body: React.ReactNode = null;
  let title = "Nothing selected";

  if (selection?.kind === "wall") {
    const w = project.walls.find((x) => x.id === selection.id);
    if (w) {
      title = "Wall";
      const len = wallLength(w);
      body = (
        <>
          <Field label={`Length (${units === "metric" ? "cm" : "in"})`}>
            <input
              type="number"
              className="field font-mono"
              value={units === "metric" ? Math.round(len) : Math.round(len / 2.54)}
              min={1}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!v || v <= 0) return;
                const cm = units === "metric" ? v : v * 2.54;
                const d = wallDir(w);
                commit((data) => ({
                  ...data,
                  walls: data.walls.map((x) =>
                    x.id === w.id ? { ...x, end_x: x.start_x + d.x * cm, end_y: x.start_y + d.y * cm } : x,
                  ),
                }));
              }}
            />
          </Field>
          <Field label="Thickness (cm)">
            <input
              type="number"
              className="field font-mono"
              value={w.thickness}
              min={5}
              max={60}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!v) return;
                commit((data) => ({
                  ...data,
                  walls: data.walls.map((x) => (x.id === w.id ? { ...x, thickness: v } : x)),
                }));
              }}
            />
          </Field>
          <Field label="Type">
            <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
              {(["structural", "drywall"] as WallType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`h-7 rounded text-xs font-medium capitalize transition-colors ${
                    w.wall_type === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() =>
                    commit((data) => ({
                      ...data,
                      walls: data.walls.map((x) =>
                        x.id === w.id
                          ? { ...x, wall_type: t, thickness: t === "structural" ? Math.max(x.thickness, 20) : Math.min(x.thickness, 12) }
                          : x,
                      ),
                    }))
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <ReadOnly label="Start" value={`${Math.round(w.start_x)}, ${Math.round(w.start_y)}`} />
          <ReadOnly label="End" value={`${Math.round(w.end_x)}, ${Math.round(w.end_y)}`} />
        </>
      );
    }
  } else if (selection?.kind === "door") {
    const d = project.doors.find((x) => x.id === selection.id);
    if (d) {
      title = "Door";
      body = (
        <>
          <Field label="Width (cm)">
            <input
              type="number"
              className="field font-mono"
              value={d.width}
              min={40}
              max={300}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!v) return;
                commit((data) => ({ ...data, doors: data.doors.map((x) => (x.id === d.id ? { ...x, width: v } : x)) }));
              }}
            />
          </Field>
          <Field label="Swing">
            <select
              className="field"
              value={d.swing_direction}
              onChange={(e) =>
                commit((data) => ({
                  ...data,
                  doors: data.doors.map((x) =>
                    x.id === d.id ? { ...x, swing_direction: e.target.value as SwingDirection } : x,
                  ),
                }))
              }
            >
              {SWINGS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Position from wall start (cm)">
            <input
              type="number"
              className="field font-mono"
              value={d.position_along_wall}
              onChange={(e) =>
                commit((data) => ({
                  ...data,
                  doors: data.doors.map((x) => (x.id === d.id ? { ...x, position_along_wall: Number(e.target.value) } : x)),
                }))
              }
            />
          </Field>
        </>
      );
    }
  } else if (selection?.kind === "window") {
    const win = project.windows.find((x) => x.id === selection.id);
    if (win) {
      title = "Window";
      body = (
        <>
          <Field label="Width (cm)">
            <input
              type="number"
              className="field font-mono"
              value={win.width}
              min={30}
              max={400}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!v) return;
                commit((data) => ({ ...data, windows: data.windows.map((x) => (x.id === win.id ? { ...x, width: v } : x)) }));
              }}
            />
          </Field>
          <Field label="Position from wall start (cm)">
            <input
              type="number"
              className="field font-mono"
              value={win.position_along_wall}
              onChange={(e) =>
                commit((data) => ({
                  ...data,
                  windows: data.windows.map((x) =>
                    x.id === win.id ? { ...x, position_along_wall: Number(e.target.value) } : x,
                  ),
                }))
              }
            />
          </Field>
        </>
      );
    }
  } else if (selection?.kind === "room") {
    const r = project.rooms.find((x) => x.id === selection.id);
    if (r) {
      title = "Room";
      const setSize = (width: number, height: number) =>
        commit((data) => ({
          ...data,
          rooms: data.rooms.map((x) =>
            x.id === r.id ? { ...x, width, height, area: Math.round(width * height) / 10000 } : x,
          ),
        }));
      body = (
        <>
          <Field label="Name">
            <input
              className="field"
              value={r.name}
              onChange={(e) =>
                commit((data) => ({ ...data, rooms: data.rooms.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)) }))
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Width (cm)">
              <input type="number" className="field font-mono" value={Math.round(r.width)} onChange={(e) => setSize(Number(e.target.value) || r.width, r.height)} />
            </Field>
            <Field label="Depth (cm)">
              <input type="number" className="field font-mono" value={Math.round(r.height)} onChange={(e) => setSize(r.width, Number(e.target.value) || r.height)} />
            </Field>
          </div>
          <ReadOnly label="Area" value={formatArea(r.area, units)} />
          <ReadOnly label="Centre" value={`${Math.round(r.center_x)}, ${Math.round(r.center_y)}`} />
        </>
      );
    }
  } else if (selection?.kind === "furniture") {
    const f = project.furniture.find((x) => x.id === selection.id);
    if (f) {
      title = f.name;
      body = (
        <>
          <Field label="Rotation (°)">
            <input
              type="number"
              className="field font-mono"
              value={Math.round(f.rotation)}
              step={15}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isNaN(v)) return;
                commit((data) => ({ ...data, furniture: data.furniture.map((x) => (x.id === f.id ? { ...x, rotation: ((v % 360) + 360) % 360 } : x)) }));
              }}
            />
          </Field>
          <div className="grid grid-cols-2 gap-1">
            {[-90, 90].map((delta) => (
              <button key={delta} type="button" className="btn-ghost h-8 text-xs" onClick={() => commit((data) => ({ ...data, furniture: data.furniture.map((x) => (x.id === f.id ? { ...x, rotation: (((x.rotation + delta) % 360) + 360) % 360 } : x)) }))}>
                Rotate {delta > 0 ? "+" : ""}{delta}°
              </button>
            ))}
          </div>
          <ReadOnly label="Size" value={`${Math.round(f.width)} × ${Math.round(f.height)} cm`} />
        </>
      );
    }
  } else if (selection?.kind === "dimension") {
    const dim = project.dimensions.find((x) => x.id === selection.id);
    if (dim) {
      title = "Dimension";
      body = (
        <ReadOnly
          label="Measured length"
          value={formatLength(Math.hypot(dim.end_x - dim.start_x, dim.end_y - dim.start_y), units)}
        />
      );
    }
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-sidebar-border bg-sidebar">
      <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
        <div>
          <p className="label-caps">Properties</p>
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {selection && (
          <div className="flex gap-1">
            <button type="button" className="tool-btn h-8 w-8" title="Duplicate" onClick={duplicateSelected}>
              <Copy className="h-4 w-4" />
            </button>
            <button type="button" className="tool-btn h-8 w-8 hover:text-destructive" title="Delete" onClick={deleteSelected}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {body ?? <Hints tool={tool} />}
      </div>
      <div className="border-t border-sidebar-border px-4 py-3 text-xs text-muted-foreground">
        <div className="flex justify-between font-mono">
          <span>{project.walls.length} walls</span>
          <span>{project.rooms.length} rooms</span>
          <span>{project.doors.length + project.windows.length} openings</span>
        </div>
      </div>
    </aside>
  );
}

function Hints({ tool }: { tool: string }) {
  const hint: Record<string, string> = {
    select: "Click an element to select it. Drag to move, drag wall endpoints to resize. Drag empty space or hold Space to pan, scroll to zoom.",
    wall: "Click to start a wall, click again to finish. Walls chain — press Esc to stop. Endpoints snap to the grid and existing corners.",
    room: "Drag a rectangle to define a room. The area is computed automatically; rename it in this panel.",
    door: "Hover a wall and click to place a door. Adjust width and swing here afterwards.",
    window: "Hover a wall and click to embed a window.",
    dimension: "Click two points to measure between them.",
  };
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">{hint[tool]}</p>
      <div>
        <p className="label-caps mb-2">Shortcuts</p>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {[
            ["V W R D N M", "Tools"],
            ["Delete", "Remove selection"],
            ["Ctrl+Z / Ctrl+Y", "Undo / redo"],
            ["Esc", "Deselect / cancel"],
            ["Right-click", "Delete / duplicate"],
          ].map(([k, v]) => (
            <li key={k} className="flex justify-between gap-3">
              <span className="font-mono text-foreground">{k}</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-caps mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-border pb-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
