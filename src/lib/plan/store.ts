import { create } from "zustand";
import { uid, wallDir } from "./geometry";
import { upsertProject } from "./storage";
import type { PlanData, Project, Selection, Tool } from "./types";

const HISTORY_LIMIT = 100;

function pick(p: Project): PlanData {
  return { walls: p.walls, rooms: p.rooms, doors: p.doors, windows: p.windows, dimensions: p.dimensions };
}

interface EditorState {
  project: Project | null;
  past: PlanData[];
  future: PlanData[];
  tool: Tool;
  selection: Selection;
  pending: PlanData | null;

  load: (p: Project) => void;
  setTool: (t: Tool) => void;
  select: (s: Selection) => void;
  /** Applies a change and records it in history. */
  commit: (fn: (d: PlanData) => PlanData) => void;
  /** Transient change during a drag — no history entry until endDrag(). */
  beginDrag: () => void;
  setTransient: (fn: (d: PlanData) => PlanData) => void;
  endDrag: () => void;
  updateSettings: (patch: Partial<Pick<Project, "name" | "default_scale" | "units">>) => void;
  undo: () => void;
  redo: () => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
}

function persist(project: Project) {
  upsertProject(project);
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  past: [],
  future: [],
  tool: "select",
  selection: null,
  pending: null,

  load: (p) => set({ project: p, past: [], future: [], selection: null, tool: "select", pending: null }),
  setTool: (tool) => set({ tool, selection: null }),
  select: (selection) => set({ selection }),

  commit: (fn) => {
    const { project, past } = get();
    if (!project) return;
    const prev = pick(project);
    const next = fn(prev);
    const updated: Project = { ...project, ...next, updated_at: new Date().toISOString() };
    persist(updated);
    set({ project: updated, past: [...past.slice(-HISTORY_LIMIT + 1), prev], future: [] });
  },

  beginDrag: () => {
    const { project } = get();
    if (project) set({ pending: pick(project) });
  },
  setTransient: (fn) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, ...fn(pick(project)) } });
  },
  endDrag: () => {
    const { project, pending, past } = get();
    if (!project || !pending) return;
    const changed = JSON.stringify(pending) !== JSON.stringify(pick(project));
    const updated = { ...project, updated_at: new Date().toISOString() };
    if (changed) {
      persist(updated);
      set({ project: updated, past: [...past.slice(-HISTORY_LIMIT + 1), pending], future: [], pending: null });
    } else {
      set({ pending: null });
    }
  },

  updateSettings: (patch) => {
    const { project } = get();
    if (!project) return;
    const updated = { ...project, ...patch, updated_at: new Date().toISOString() };
    persist(updated);
    set({ project: updated });
  },

  undo: () => {
    const { project, past, future } = get();
    if (!project || !past.length) return;
    const prev = past[past.length - 1];
    const updated = { ...project, ...prev, updated_at: new Date().toISOString() };
    persist(updated);
    set({ project: updated, past: past.slice(0, -1), future: [pick(project), ...future], selection: null });
  },
  redo: () => {
    const { project, past, future } = get();
    if (!project || !future.length) return;
    const next = future[0];
    const updated = { ...project, ...next, updated_at: new Date().toISOString() };
    persist(updated);
    set({ project: updated, past: [...past, pick(project)], future: future.slice(1), selection: null });
  },

  deleteSelected: () => {
    const { selection, commit } = get();
    if (!selection) return;
    const { kind, id } = selection;
    commit((d) => {
      switch (kind) {
        case "wall":
          return {
            ...d,
            walls: d.walls.filter((w) => w.id !== id),
            doors: d.doors.filter((x) => x.wall_id !== id),
            windows: d.windows.filter((x) => x.wall_id !== id),
          };
        case "room":
          return { ...d, rooms: d.rooms.filter((r) => r.id !== id) };
        case "door":
          return { ...d, doors: d.doors.filter((r) => r.id !== id) };
        case "window":
          return { ...d, windows: d.windows.filter((r) => r.id !== id) };
        case "dimension":
          return { ...d, dimensions: d.dimensions.filter((r) => r.id !== id) };
      }
    });
    set({ selection: null });
  },

  duplicateSelected: () => {
    const { selection, commit } = get();
    if (!selection) return;
    const { kind, id } = selection;
    let newSel: Selection = null;
    commit((d) => {
      const off = 50;
      switch (kind) {
        case "wall": {
          const w = d.walls.find((x) => x.id === id);
          if (!w) return d;
          const n = { x: -wallDir(w).y, y: wallDir(w).x };
          const copy = {
            ...w,
            id: uid(),
            start_x: w.start_x + n.x * off,
            start_y: w.start_y + n.y * off,
            end_x: w.end_x + n.x * off,
            end_y: w.end_y + n.y * off,
          };
          newSel = { kind, id: copy.id };
          return { ...d, walls: [...d.walls, copy] };
        }
        case "room": {
          const r = d.rooms.find((x) => x.id === id);
          if (!r) return d;
          const copy = { ...r, id: uid(), center_x: r.center_x + off, center_y: r.center_y + off };
          newSel = { kind, id: copy.id };
          return { ...d, rooms: [...d.rooms, copy] };
        }
        case "door": {
          const x = d.doors.find((y) => y.id === id);
          if (!x) return d;
          const copy = { ...x, id: uid(), position_along_wall: x.position_along_wall + x.width + 10 };
          newSel = { kind, id: copy.id };
          return { ...d, doors: [...d.doors, copy] };
        }
        case "window": {
          const x = d.windows.find((y) => y.id === id);
          if (!x) return d;
          const copy = { ...x, id: uid(), position_along_wall: x.position_along_wall + x.width + 10 };
          newSel = { kind, id: copy.id };
          return { ...d, windows: [...d.windows, copy] };
        }
        case "dimension": {
          const x = d.dimensions.find((y) => y.id === id);
          if (!x) return d;
          const copy = {
            ...x,
            id: uid(),
            start_x: x.start_x + off,
            start_y: x.start_y + off,
            end_x: x.end_x + off,
            end_y: x.end_y + off,
          };
          newSel = { kind, id: copy.id };
          return { ...d, dimensions: [...d.dimensions, copy] };
        }
      }
    });
    if (newSel) set({ selection: newSel });
  },
}));
