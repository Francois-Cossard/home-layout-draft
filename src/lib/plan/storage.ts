import { uid } from "./geometry";
import type { Door, PlanData, Project, Room, Wall, WindowEl } from "./types";

const KEY = "planche.projects.v1";

export function emptyPlan(): PlanData {
  return { walls: [], rooms: [], doors: [], windows: [], dimensions: [] };
}

export function loadProjects(): Project[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(KEY);
  if (!raw) {
    const demos = demoProjects();
    saveProjects(demos);
    return demos;
  }
  try {
    const parsed = JSON.parse(raw) as Project[];
    return parsed.map((p) => ({ ...emptyPlan(), ...p }));
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(projects));
}

export function getProject(id: string): Project | undefined {
  return loadProjects().find((p) => p.id === id);
}

export function upsertProject(project: Project) {
  const all = loadProjects();
  const idx = all.findIndex((p) => p.id === project.id);
  if (idx >= 0) all[idx] = project;
  else all.unshift(project);
  saveProjects(all);
}

export function deleteProject(id: string) {
  saveProjects(loadProjects().filter((p) => p.id !== id));
}

export function createProject(name: string): Project {
  const now = new Date().toISOString();
  const project: Project = {
    id: uid(),
    name,
    created_at: now,
    updated_at: now,
    default_scale: 50,
    units: "metric",
    ...emptyPlan(),
  };
  upsertProject(project);
  return project;
}

/* ------------------------------------------------------------------ */
/* Demo data                                                           */
/* ------------------------------------------------------------------ */

function wall(
  project_id: string,
  id: string,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  wall_type: Wall["wall_type"] = "exterior",
): Wall {
  return {
    id,
    project_id,
    start_x: sx,
    start_y: sy,
    end_x: ex,
    end_y: ey,
    thickness: wall_type === "exterior" ? 25 : 12,
    wall_type,
  };
}

function room(project_id: string, name: string, x1: number, y1: number, x2: number, y2: number): Room {
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);
  return {
    id: uid(),
    project_id,
    name,
    area: (width * height) / 10000,
    center_x: (x1 + x2) / 2,
    center_y: (y1 + y2) / 2,
    width,
    height,
  };
}

function door(project_id: string, wall_id: string, pos: number, swing: Door["swing_direction"], width = 80): Door {
  return { id: uid(), project_id, wall_id, position_along_wall: pos, width, swing_direction: swing };
}

function win(project_id: string, wall_id: string, pos: number, width = 120): WindowEl {
  return { id: uid(), project_id, wall_id, position_along_wall: pos, width };
}

function demoProjects(): Project[] {
  const t = new Date();
  const studioId = "demo-studio";
  const t3Id = "demo-t3";

  const studio: Project = {
    id: studioId,
    name: "Studio 25m²",
    created_at: new Date(t.getTime() - 5 * 864e5).toISOString(),
    updated_at: new Date(t.getTime() - 2 * 864e5).toISOString(),
    default_scale: 50,
    units: "metric",
    walls: [
      wall(studioId, "s-top", 0, 0, 500, 0),
      wall(studioId, "s-right", 500, 0, 500, 500),
      wall(studioId, "s-bottom", 500, 500, 0, 500),
      wall(studioId, "s-left", 0, 500, 0, 0),
    ],
    rooms: [room(studioId, "Studio", 0, 0, 500, 500)],
    doors: [door(studioId, "s-bottom", 400, "left-out", 90)],
    windows: [win(studioId, "s-top", 250, 160), win(studioId, "s-right", 250, 120)],
    dimensions: [
      { id: uid(), project_id: studioId, start_x: 0, start_y: -80, end_x: 500, end_y: -80 },
      { id: uid(), project_id: studioId, start_x: 580, start_y: 0, end_x: 580, end_y: 500 },
    ],
  };

  const t3: Project = {
    id: t3Id,
    name: "T3 Apartment",
    created_at: new Date(t.getTime() - 12 * 864e5).toISOString(),
    updated_at: new Date(t.getTime() - 1 * 864e5).toISOString(),
    default_scale: 100,
    units: "metric",
    walls: [
      wall(t3Id, "t-top", 0, 0, 1000, 0),
      wall(t3Id, "t-right", 1000, 0, 1000, 800),
      wall(t3Id, "t-bottom", 1000, 800, 0, 800),
      wall(t3Id, "t-left", 0, 800, 0, 0),
      wall(t3Id, "t-mid-v", 550, 0, 550, 800, "interior"),
      wall(t3Id, "t-bed-split", 550, 400, 1000, 400, "interior"),
      wall(t3Id, "t-living-split", 0, 500, 550, 500, "interior"),
      wall(t3Id, "t-kitchen-bath", 300, 500, 300, 800, "interior"),
    ],
    rooms: [
      room(t3Id, "Living room", 0, 0, 550, 500),
      room(t3Id, "Bedroom 1", 550, 0, 1000, 400),
      room(t3Id, "Bedroom 2", 550, 400, 1000, 800),
      room(t3Id, "Kitchen", 0, 500, 300, 800),
      room(t3Id, "Bathroom", 300, 500, 550, 800),
    ],
    doors: [
      door(t3Id, "t-left", 400, "right-in", 90),
      door(t3Id, "t-mid-v", 200, "right-out"),
      door(t3Id, "t-mid-v", 600, "left-out"),
      door(t3Id, "t-living-split", 150, "right-in"),
      door(t3Id, "t-living-split", 420, "left-in", 70),
    ],
    windows: [
      win(t3Id, "t-top", 275, 200),
      win(t3Id, "t-top", 775, 160),
      win(t3Id, "t-right", 200, 140),
      win(t3Id, "t-right", 600, 140),
      win(t3Id, "t-bottom", 850, 100),
      win(t3Id, "t-bottom", 400, 90),
    ],
    dimensions: [
      { id: uid(), project_id: t3Id, start_x: 0, start_y: -90, end_x: 1000, end_y: -90 },
      { id: uid(), project_id: t3Id, start_x: -90, start_y: 0, end_x: -90, end_y: 800 },
    ],
  };

  return [t3, studio];
}
