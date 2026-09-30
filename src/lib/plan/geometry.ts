import type { Door, Room, FurniturePlacement, FurniturePrimitive, PlanData, Point, Units, Wall } from "./types";

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
  for (const f of data.furniture ?? []) {
    const r = Math.hypot(f.width, f.height) / 2;
    add(f.center_x - r, f.center_y - r);
    add(f.center_x + r, f.center_y + r);
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

/** SVG transform placing a furniture symbol (local coords, origin top-left) in world space. */
export function furnitureTransform(f: FurniturePlacement): string {
  return `translate(${f.center_x} ${f.center_y}) rotate(${f.rotation}) translate(${-f.width / 2} ${-f.height / 2})`;
}

/** Maps a furniture-local point to world coordinates. */
export function furnitureToWorld(f: FurniturePlacement, p: Point): Point {
  const a = (f.rotation * Math.PI) / 180;
  const x = p.x - f.width / 2;
  const y = p.y - f.height / 2;
  return { x: f.center_x + x * Math.cos(a) - y * Math.sin(a), y: f.center_y + x * Math.sin(a) + y * Math.cos(a) };
}

/** World-space polylines approximating a primitive (for PDF output). */
export function primitiveWorldPaths(f: FurniturePlacement, s: FurniturePrimitive): { pts: Point[]; closed: boolean } {
  const T = (x: number, y: number) => furnitureToWorld(f, { x, y });
  if (s.kind === "line") return { pts: [T(s.x1, s.y1), T(s.x2, s.y2)], closed: false };
  if (s.kind === "rect")
    return { pts: [T(s.x, s.y), T(s.x + s.width, s.y), T(s.x + s.width, s.y + s.height), T(s.x, s.y + s.height)], closed: true };
  const pts: Point[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    pts.push(T(s.cx + Math.cos(a) * s.radius, s.cy + Math.sin(a) * s.radius));
  }
  return { pts, closed: true };
}

/** Outline corners of a wall (as a rectangle), offset by `off` from the centreline on each side. */
export function wallFaces(w: Wall, off = w.thickness / 2): { a: [Point, Point]; b: [Point, Point] } {
  const n = wallNormal(w);
  return {
    a: [{ x: w.start_x + n.x * off, y: w.start_y + n.y * off }, { x: w.end_x + n.x * off, y: w.end_y + n.y * off }],
    b: [{ x: w.start_x - n.x * off, y: w.start_y - n.y * off }, { x: w.end_x - n.x * off, y: w.end_y - n.y * off }],
  };
}

// ---------- Wall joins (mitre / T) and interior dimensions ----------

const JOIN_TOL = 1.5; // cm

function lineIntersect(p: Point, d: Point, q: Point, e: Point): Point | null {
  const den = d.x * e.y - d.y * e.x;
  if (Math.abs(den) < 1e-6) return null;
  const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / den;
  return { x: p.x + d.x * t, y: p.y + d.y * t };
}

export interface WallOutline {
  /** [start+left, end+left, end-right, start-right] (left = wallNormal side) */
  pts: [Point, Point, Point, Point];
  joined: { start: boolean; end: boolean };
}

/** Computes the wall's outline with mitred corners at shared endpoints and trimmed T-junctions. */
export function wallOutline(w: Wall, walls: Wall[]): WallOutline {
  const d = wallDir(w);
  const n = wallNormal(w);
  const h = w.thickness / 2;
  const S = { x: w.start_x, y: w.start_y };
  const E = { x: w.end_x, y: w.end_y };
  const pts: [Point, Point, Point, Point] = [
    { x: S.x + n.x * h, y: S.y + n.y * h },
    { x: E.x + n.x * h, y: E.y + n.y * h },
    { x: E.x - n.x * h, y: E.y - n.y * h },
    { x: S.x - n.x * h, y: S.y - n.y * h },
  ];
  const joined = { start: false, end: false };
  const len = wallLength(w);
  if (len < 1) return { pts, joined };

  for (const end of ["start", "end"] as const) {
    const P = end === "start" ? S : E;
    const dA = end === "start" ? d : { x: -d.x, y: -d.y }; // pointing away from joint along this wall
    const nA = { x: -dA.y, y: dA.x };
    const iL = end === "start" ? 0 : 2; // corner on +nA side
    const iR = end === "start" ? 3 : 1; // corner on -nA side
    // 1) corner joint with another wall sharing this endpoint
    const other = walls.find((o) => {
      if (o.id === w.id || wallLength(o) < 1) return false;
      return dist(P, { x: o.start_x, y: o.start_y }) < JOIN_TOL || dist(P, { x: o.end_x, y: o.end_y }) < JOIN_TOL;
    });
    if (other) {
      const od = wallDir(other);
      const atStart = dist(P, { x: other.start_x, y: other.start_y }) < JOIN_TOL;
      const dB = atStart ? od : { x: -od.x, y: -od.y };
      const nB = { x: -dB.y, y: dB.x };
      const hB = other.thickness / 2;
      const cross = dA.x * dB.y - dA.y * dB.x;
      if (Math.abs(cross) > 0.05) {
        const L = lineIntersect({ x: P.x + nA.x * h, y: P.y + nA.y * h }, dA, { x: P.x - nB.x * hB, y: P.y - nB.y * hB }, dB);
        const R = lineIntersect({ x: P.x - nA.x * h, y: P.y - nA.y * h }, dA, { x: P.x + nB.x * hB, y: P.y + nB.y * hB }, dB);
        const lim = (h + hB) * 4;
        if (L && R && dist(L, P) < lim && dist(R, P) < lim) {
          pts[iL] = L;
          pts[iR] = R;
          joined[end] = true;
        }
      } else joined[end] = true; // collinear continuation
      continue;
    }
    // 2) T-junction: endpoint lies on another wall's body
    const host = walls.find((o) => {
      if (o.id === w.id || wallLength(o) < 1) return false;
      const pr = projectToWall(P, o);
      return pr.distance <= o.thickness / 2 + JOIN_TOL && pr.t > 1 && pr.t < wallLength(o) - 1;
    });
    if (host) {
      const hd = wallDir(host);
      const hn = wallNormal(host);
      // face of host on the side where this wall comes from
      const probe = { x: P.x + dA.x * 10, y: P.y + dA.y * 10 };
      const side = (probe.x - host.start_x) * hn.x + (probe.y - host.start_y) * hn.y >= 0 ? 1 : -1;
      const fp = { x: host.start_x + hn.x * side * (host.thickness / 2), y: host.start_y + hn.y * side * (host.thickness / 2) };
      const L = lineIntersect({ x: P.x + nA.x * h, y: P.y + nA.y * h }, dA, fp, hd);
      const R = lineIntersect({ x: P.x - nA.x * h, y: P.y - nA.y * h }, dA, fp, hd);
      if (L && R) {
        pts[iL] = L;
        pts[iR] = R;
        joined[end] = true;
      }
    }
  }
  return { pts, joined };
}

/** Centroid of all wall endpoints — used to decide which face is "inside". */
export function planCentroid(walls: Wall[]): Point {
  if (!walls.length) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const w of walls) {
    x += w.start_x + w.end_x;
    y += w.start_y + w.end_y;
  }
  return { x: x / (walls.length * 2), y: y / (walls.length * 2) };
}

export type DimMode = "interior" | "axis";

/**
 * Wall dimension geometry. "interior" measures the clear face length between
 * adjoining walls, on the side facing the plan interior; "axis" measures the centreline.
 */
export function wallDimension(w: Wall, walls: Wall[], mode: DimMode, offset: number) {
  const n = wallNormal(w);
  if (mode === "axis") {
    const g = wallDimensionGeometry(w, w.thickness / 2 + offset);
    const s = { x: w.start_x + n.x * (w.thickness / 2), y: w.start_y + n.y * (w.thickness / 2) };
    const e = { x: w.end_x + n.x * (w.thickness / 2), y: w.end_y + n.y * (w.thickness / 2) };
    return { ...g, s, e, len: wallLength(w) };
  }
  const { pts } = wallOutline(w, walls);
  const c = planCentroid(walls);
  const mid = { x: (w.start_x + w.end_x) / 2, y: (w.start_y + w.end_y) / 2 };
  const sign = (c.x - mid.x) * n.x + (c.y - mid.y) * n.y >= 0 ? 1 : -1;
  const s = sign > 0 ? pts[0] : pts[3];
  const e = sign > 0 ? pts[1] : pts[2];
  const nn = { x: n.x * sign, y: n.y * sign };
  const a = { x: s.x + nn.x * offset, y: s.y + nn.y * offset };
  const b = { x: e.x + nn.x * offset, y: e.y + nn.y * offset };
  return { a, b, s, e, normal: nn, angle: readableAngleDegrees(a, b), len: dist(s, e) };
}

/** Snaps a point to the nearest wall face (for measuring clear distances wall-to-wall). */
export function snapToWallFace(p: Point, walls: Wall[], tol: number): Point | null {
  let best: { q: Point; d: number } | null = null;
  for (const w of walls) {
    const len = wallLength(w);
    if (len < 1) continue;
    const pr = projectToWall(p, w);
    if (pr.distance > w.thickness / 2 + tol) continue;
    const n = wallNormal(w);
    const c = pointOnWall(w, pr.t);
    const side = (p.x - c.x) * n.x + (p.y - c.y) * n.y >= 0 ? 1 : -1;
    const q = { x: c.x + n.x * side * (w.thickness / 2), y: c.y + n.y * side * (w.thickness / 2) };
    const d = dist(p, q);
    if (d <= tol && (!best || d < best.d)) best = { q, d };
  }
  return best?.q ?? null;
}

// ---------- Room polygons ----------

export function polygonArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function polygonCentroid(pts: Point[]): Point {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < 1e-6) {
    const n = pts.length || 1;
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

/** Point-in-polygon test — used to keep the label inside L-shaped rooms. */
export function pointInPolygon(p: Point, pts: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!, b = pts[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function roomPolygon(r: Room): Point[] {
  if (r.points && r.points.length >= 3) return r.points;
  const hw = r.width / 2, hh = r.height / 2;
  return [
    { x: r.center_x - hw, y: r.center_y - hh },
    { x: r.center_x + hw, y: r.center_y - hh },
    { x: r.center_x + hw, y: r.center_y + hh },
    { x: r.center_x - hw, y: r.center_y + hh },
  ];
}

/** Label anchor: centroid, or the widest interior point on its horizontal line for concave shapes. */
function labelPoint(pts: Point[]): Point {
  const c = polygonCentroid(pts);
  if (pointInPolygon(c, pts)) return c;
  const xs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    if ((a.y > c.y) !== (b.y > c.y)) xs.push(a.x + ((c.y - a.y) / (b.y - a.y)) * (b.x - a.x));
  }
  xs.sort((m, n) => m - n);
  let best = c, bw = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i + 1]! - xs[i]! > bw) { bw = xs[i + 1]! - xs[i]!; best = { x: (xs[i]! + xs[i + 1]!) / 2, y: c.y }; }
  }
  return best;
}

/** Room geometry fields (area, bbox, label) derived from a polygon. */
export function roomFromPolygon(pts: Point[]): Pick<Room, "points" | "area" | "center_x" | "center_y" | "width" | "height"> {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const l = labelPoint(pts);
  return { points: pts, area: Math.round(polygonArea(pts) / 100) / 100, center_x: l.x, center_y: l.y, width: maxX - minX, height: maxY - minY };
}

export function polygonPerimeter(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) s += dist(pts[i]!, pts[(i + 1) % pts.length]!);
  return s;
}

export function translateRoom(r: Room, dx: number, dy: number): Room {
  return {
    ...r,
    center_x: r.center_x + dx,
    center_y: r.center_y + dy,
    points: r.points?.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  };
}

/** Legacy rectangular rooms were drawn on wall axes: pull each side back to the wall face. */
export function insetRectRoomToWalls(r: Room, walls: Wall[]): Room {
  if (r.points && r.points.length >= 3) return r;
  let x1 = r.center_x - r.width / 2, x2 = r.center_x + r.width / 2;
  let y1 = r.center_y - r.height / 2, y2 = r.center_y + r.height / 2;
  const tol = 2;
  const half = (axis: "h" | "v", v: number, a: number, b: number) => {
    let t = 0;
    for (const w of walls) {
      const horiz = Math.abs(w.start_y - w.end_y) < tol, vert = Math.abs(w.start_x - w.end_x) < tol;
      if (axis === "h" && horiz && Math.abs(w.start_y - v) < tol) {
        const lo = Math.min(w.start_x, w.end_x), hi = Math.max(w.start_x, w.end_x);
        if (Math.min(hi, b) - Math.max(lo, a) > 1) t = Math.max(t, w.thickness / 2);
      }
      if (axis === "v" && vert && Math.abs(w.start_x - v) < tol) {
        const lo = Math.min(w.start_y, w.end_y), hi = Math.max(w.start_y, w.end_y);
        if (Math.min(hi, b) - Math.max(lo, a) > 1) t = Math.max(t, w.thickness / 2);
      }
    }
    return t;
  };
  const tT = half("h", y1, x1, x2), tB = half("h", y2, x1, x2), tL = half("v", x1, y1, y2), tR = half("v", x2, y1, y2);
  x1 += tL; x2 -= tR; y1 += tT; y2 -= tB;
  return { ...r, ...roomFromPolygon([{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }]) };
}

/** Snaps to inner/outer wall-outline corners (face intersections). */
export function snapToWallCorner(p: Point, walls: Wall[], tol: number): Point | null {
  let best: { q: Point; d: number } | null = null;
  for (const w of walls) {
    if (wallLength(w) < 1) continue;
    for (const q of wallOutline(w, walls).pts) {
      const d = dist(p, q);
      if (d <= tol && (!best || d < best.d)) best = { q, d };
    }
  }
  return best?.q ?? null;
}
