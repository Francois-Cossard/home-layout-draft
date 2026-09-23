import type { Door, PlanData, Point, Units, Wall } from "./types";

export const CM_PER_FOOT = 30.48;

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function wallLength(w: Wall): number {
  return Math.hypot(w.end_x - w.start_x, w.end_y - w.start_y);
}

export function wallDir(w: Wall): Point {
  const len = wallLength(w) || 1;
  return { x: (w.end_x - w.start_x) / len, y: (w.end_y - w.start_y) / len };
}

export function wallNormal(w: Wall): Point {
  const d = wallDir(w);
  return { x: -d.y, y: d.x };
}

export function readableAngleDegrees(a: Point, b: Point): number {
  let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  if (angle > 90 || angle < -90) angle += 180;
  return angle;
}

export function wallDimensionGeometry(wall: Wall, offset = 34) {
  const n = wallNormal(wall);
  const a = { x: wall.start_x + n.x * offset, y: wall.start_y + n.y * offset };
  const b = { x: wall.end_x + n.x * offset, y: wall.end_y + n.y * offset };
  return { a, b, normal: n, angle: readableAngleDegrees(a, b) };
}

export function pointOnWall(w: Wall, t: number): Point {
  const d = wallDir(w);
  return { x: w.start_x + d.x * t, y: w.start_y + d.y * t };
}

/** Projects p onto the wall; returns distance along the wall (clamped) and perpendicular distance. */
export function projectToWall(p: Point, w: Wall): { t: number; distance: number } {
  const len = wallLength(w);
  if (len === 0) return { t: 0, distance: dist(p, { x: w.start_x, y: w.start_y }) };
  const d = wallDir(w);
  const rel = { x: p.x - w.start_x, y: p.y - w.start_y };
  const t = Math.max(0, Math.min(len, rel.x * d.x + rel.y * d.y));
  const q = pointOnWall(w, t);
  return { t, distance: dist(p, q) };
}

export function snapValue(v: number, step: number): number {
  return Math.round(v / step) * step;
}

export function snapPoint(p: Point, step: number): Point {
  return { x: snapValue(p.x, step), y: snapValue(p.y, step) };
}

/** Grid configuration in cm, per unit system. */
export function gridConfig(units: Units) {
  if (units === "imperial") {
    return { minor: CM_PER_FOOT, major: CM_PER_FOOT * 5, snap: CM_PER_FOOT / 4 };
  }
  return { minor: 50, major: 100, snap: 10 };
}

export function formatLength(cm: number, units: Units): string {
  if (units === "imperial") {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches - feet * 12);
    if (inches === 12) return `${feet + 1}'0"`;
    return `${feet}'${inches}"`;
  }
  if (cm >= 100) return `${(cm / 100).toFixed(2)} m`;
  return `${Math.round(cm)} cm`;
}

export function formatArea(m2: number, units: Units): string {
  if (units === "imperial") return `${Math.round(m2 * 10.7639)} sq ft`;
  return `${m2.toFixed(1)} m²`;
}

export function planBounds(data: PlanData) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const add = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const w of data.walls) {
    add(w.start_x, w.start_y);
    add(w.end_x, w.end_y);
  }
  for (const r of data.rooms) {
    add(r.center_x - r.width / 2, r.center_y - r.height / 2);
    add(r.center_x + r.width / 2, r.center_y + r.height / 2);
  }
  for (const d of data.dimensions) {
    add(d.start_x, d.start_y);
    add(d.end_x, d.end_y);
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 500, maxY: 400 };
  return { minX, minY, maxX, maxY };
}

export interface DoorGeometry {
  jambA: Point; // hinge side jamb
  jambB: Point;
  leafEnd: Point;
  arc: Point[]; // polyline approximating the swing arc from leafEnd to jambB
  center: Point;
  dir: Point;
  normal: Point;
}

export function doorGeometry(door: Door, wall: Wall): DoorGeometry {
  const d = wallDir(wall);
  const n = wallNormal(wall);
  const center = pointOnWall(wall, door.position_along_wall);
  const half = door.width / 2;
  const hingeLeft = door.swing_direction.startsWith("left");
  const inward = door.swing_direction.endsWith("in");
  const hingeSign = hingeLeft ? -1 : 1;
  const sideSign = inward ? 1 : -1;
  const jambA = { x: center.x + d.x * half * hingeSign, y: center.y + d.y * half * hingeSign };
  const jambB = { x: center.x - d.x * half * hingeSign, y: center.y - d.y * half * hingeSign };
  const leafEnd = { x: jambA.x + n.x * door.width * sideSign, y: jambA.y + n.y * door.width * sideSign };
  const startAngle = Math.atan2(leafEnd.y - jambA.y, leafEnd.x - jambA.x);
  const endAngle = Math.atan2(jambB.y - jambA.y, jambB.x - jambA.x);
  let delta = endAngle - startAngle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const steps = 18;
  const arc: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = startAngle + (delta * i) / steps;
    arc.push({ x: jambA.x + Math.cos(a) * door.width, y: jambA.y + Math.sin(a) * door.width });
  }
  return { jambA, jambB, leafEnd, arc, center, dir: d, normal: n };
}

/** Four corners of a rectangle centred on a wall segment (used to mask openings). */
export function wallSegmentRect(wall: Wall, t: number, width: number, thickness: number): Point[] {
  const d = wallDir(wall);
  const n = wallNormal(wall);
  const c = pointOnWall(wall, t);
  const hw = width / 2;
  const ht = thickness / 2;
  return [
    { x: c.x - d.x * hw - n.x * ht, y: c.y - d.y * hw - n.y * ht },
    { x: c.x + d.x * hw - n.x * ht, y: c.y + d.y * hw - n.y * ht },
    { x: c.x + d.x * hw + n.x * ht, y: c.y + d.y * hw + n.y * ht },
    { x: c.x - d.x * hw + n.x * ht, y: c.y - d.y * hw + n.y * ht },
  ];
}

export function pointsToPath(pts: Point[], close = false): string {
  if (!pts.length) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ") + (close ? " Z" : "");
}

export function clampOpening(t: number, width: number, wall: Wall): number {
  const len = wallLength(wall);
  const half = width / 2;
  if (len <= width) return len / 2;
  return Math.max(half, Math.min(len - half, t));
}
