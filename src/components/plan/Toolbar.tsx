import { Link } from "@tanstack/react-router";
import {
  Blinds,
  BrickWall,
  DoorOpen,
  Home,
  MousePointer2,
  Redo2,
  Ruler,
  SquareDashed,
  Undo2,
} from "lucide-react";
import { useEditor } from "@/lib/plan/store";
import type { Tool } from "@/lib/plan/types";

const TOOLS: { id: Tool; label: string; key: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Select / move", key: "V", icon: MousePointer2 },
  { id: "wall", label: "Wall", key: "W", icon: BrickWall },
  { id: "room", label: "Room", key: "R", icon: SquareDashed },
  { id: "door", label: "Door", key: "D", icon: DoorOpen },
  { id: "window", label: "Window", key: "N", icon: Blinds },
  { id: "dimension", label: "Dimension", key: "M", icon: Ruler },
];

export function Toolbar() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-2">
      <Link to="/" className="tool-btn mb-1" title="All projects">
        <Home className="h-5 w-5" />
      </Link>
      <div className="my-1 h-px w-8 bg-sidebar-border" />
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          title={`${t.label} (${t.key})`}
          aria-label={t.label}
          aria-pressed={tool === t.id}
          onClick={() => setTool(t.id)}
          className={`tool-btn ${tool === t.id ? "tool-btn-active" : ""}`}
        >
          <t.icon className="h-5 w-5" />
        </button>
      ))}
      <div className="my-1 h-px w-8 bg-sidebar-border" />
      <button type="button" className="tool-btn disabled:opacity-30" title="Undo (Ctrl+Z)" aria-label="Undo" onClick={undo} disabled={!canUndo}>
        <Undo2 className="h-5 w-5" />
      </button>
      <button type="button" className="tool-btn disabled:opacity-30" title="Redo (Ctrl+Y)" aria-label="Redo" onClick={redo} disabled={!canRedo}>
        <Redo2 className="h-5 w-5" />
      </button>
    </aside>
  );
}

export const TOOL_KEYS: Record<string, Tool> = {
  v: "select",
  w: "wall",
  r: "room",
  d: "door",
  n: "window",
  m: "dimension",
};
