import {
  CM_PER_FOOT,
  doorGeometry,
  formatLength,
  planBounds,
  primitiveWorldPaths,
  wallDimensionGeometry,
  wallFaces,
  wallLength,
  wallDir,
  wallNormal,
  wallSegmentRect,
} from "./geometry";
import type { PaperSize, Point, Project, ScaleOption } from "./types";

const PAPER: Record<PaperSize, [number, number]> = { a4: [210, 297], a3: [297, 420] };
const MARGIN = 15;
const FOOTER = 22;
const PADDING_CM = 60;

export interface ExportOptions {
  paper: PaperSize;
  scale: ScaleOption;
}

export async function exportPlanPdf(project: Project, opts: ExportOptions) {
  const { jsPDF } = await import("jspdf");

  const b = planBounds(project);
  const planW = b.maxX - b.minX + PADDING_CM * 2;
  const planH = b.maxY - b.minY + PADDING_CM * 2;

  const orientation: "portrait" | "landscape" = planW > planH ? "landscape" : "portrait";
  const [shortSide, longSide] = PAPER[opts.paper];
  const pageW = orientation === "landscape" ? longSide : shortSide;
  const pageH = orientation === "landscape" ? shortSide : longSide;

  const availW = pageW - MARGIN * 2;
  const availH = pageH - MARGIN * 2 - FOOTER;

  // k = millimetres on paper per centimetre in the real world.
  let k: number;
  if (opts.scale === "fit") {
    k = Math.min(availW / planW, availH / planH);
  } else {
    k = 10 / opts.scale;
  }
  const effectiveScale = Math.round(10 / k);

  const drawW = planW * k;
  const drawH = planH * k;
  const offX = MARGIN + (availW - drawW) / 2;
  const offY = MARGIN + (availH - drawH) / 2;

  const X = (x: number) => offX + (x - b.minX + PADDING_CM) * k;
  const Y = (y: number) => offY + (y - b.minY + PADDING_CM) * k;
  const P = (p: Point): [number, number] => [X(p.x), Y(p.y)];

  const doc = new jsPDF({ orientation, unit: "mm", format: opts.paper });
  doc.setProperties({ title: project.name, subject: "Floor plan", creator: "Planche" });

  const INK: [number, number, number] = [38, 38, 46];
  const BLUE: [number, number, number] = [55, 110, 170];
  doc.setDrawColor(...INK);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");

  // Clip to drawing area when the plan overflows the page at fixed scale.
  doc.saveGraphicsState();
  doc.rect(MARGIN, MARGIN, availW, availH, null);
  doc.clip();
  doc.discardPath();

  const polygon = (pts: Point[], style: "F" | "S" | "FD") => {
    const [x0, y0] = P(pts[0]!);
    const segs: [number, number][] = [];
    let prev: [number, number] = [x0, y0];
    for (let i = 1; i < pts.length; i++) {
      const cur = P(pts[i]!);
      segs.push([cur[0] - prev[0], cur[1] - prev[1]]);
      prev = cur;
    }
    doc.lines(segs, x0, y0, [1, 1], style, true);
  };
  const polyline = (pts: Point[]) => {
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = P(pts[i - 1]!);
      const [bx, by] = P(pts[i]!);
      doc.line(ax, ay, bx, by);
    }
  };

  // Rooms — soft outline and label
  doc.setLineWidth(0.15);
  doc.setDrawColor(...BLUE);
  doc.setLineDashPattern([1.2, 1], 0);
  for (const r of project.rooms) {
    doc.rect(X(r.center_x - r.width / 2), Y(r.center_y - r.height / 2), r.width * k, r.height * k, "S");
  }
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(...INK);

  // Walls — structural: solid poché; drywall: two thin faces with light hatch
  doc.setFillColor(...INK);
  for (const w of project.walls) {
    if (wallLength(w) < 1) continue;
    const f = wallFaces(w);
    const pts = [f.a[0], f.a[1], f.b[1], f.b[0]];
    if (w.wall_type === "structural") {
      doc.setLineWidth(0.15);
      polygon(pts, "FD");
    } else {
      doc.setLineWidth(0.25);
      polyline([f.a[0], f.a[1]]);
      polyline([f.b[0], f.b[1]]);
      doc.setLineWidth(0.15);
      polyline([f.a[0], f.b[0]]);
      polyline([f.a[1], f.b[1]]);
      polyline([f.a[0], f.b[1]]);
    }
  }

  // Openings: white cut-out over the wall, then symbol
  doc.setFillColor(255, 255, 255);
  for (const d of project.doors) {
    const w = project.walls.find((x) => x.id === d.wall_id);
    if (!w) continue;
    polygon(wallSegmentRect(w, d.position_along_wall, d.width, w.thickness + 0.5), "F");
    const g = doorGeometry(d, w);
    doc.setLineWidth(0.35);
    doc.line(...P(g.jambA), ...P(g.leafEnd));
    doc.setLineWidth(0.2);
    polyline(g.arc);
  }
  for (const win of project.windows) {
    const w = project.walls.find((x) => x.id === win.wall_id);
    if (!w) continue;
    polygon(wallSegmentRect(w, win.position_along_wall, win.width, w.thickness + 0.5), "F");
    doc.setLineWidth(0.3);
    polygon(wallSegmentRect(w, win.position_along_wall, win.width, w.thickness), "S");
    const d = wallDir(w);
    const c = { x: w.start_x + d.x * win.position_along_wall, y: w.start_y + d.y * win.position_along_wall };
    const a = { x: c.x - d.x * (win.width / 2), y: c.y - d.y * (win.width / 2) };
    const e = { x: c.x + d.x * (win.width / 2), y: c.y + d.y * (win.width / 2) };
    doc.setLineWidth(0.2);
    doc.line(...P(a), ...P(e));
  }

  // Room labels
  for (const r of project.rooms) {
    const [cx, cy] = P({ x: r.center_x, y: r.center_y });
    doc.setFontSize(Math.max(6, Math.min(11, r.width * k * 0.09)));
    doc.setFont("helvetica", "bold");
    doc.text(r.name, cx, cy - 1, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(Math.max(5, Math.min(9, r.width * k * 0.07)));
    doc.text(areaLabel(r.area, project.units), cx, cy + 3, { align: "center" });
  }

  // Dimensions
  doc.setLineWidth(0.2);
  doc.setDrawColor(...BLUE);
  doc.setTextColor(...BLUE);
  doc.setFontSize(7);
  for (const dim of project.dimensions) {
    const a = { x: dim.start_x, y: dim.start_y };
    const e = { x: dim.end_x, y: dim.end_y };
    const len = Math.hypot(e.x - a.x, e.y - a.y);
    if (len === 0) continue;
    const ux = (e.x - a.x) / len;
    const uy = (e.y - a.y) / len;
    const nx = -uy;
    const ny = ux;
    const tick = 8; // cm
    doc.line(...P(a), ...P(e));
    doc.line(...P({ x: a.x - nx * tick, y: a.y - ny * tick }), ...P({ x: a.x + nx * tick, y: a.y + ny * tick }));
    doc.line(...P({ x: e.x - nx * tick, y: e.y - ny * tick }), ...P({ x: e.x + nx * tick, y: e.y + ny * tick }));
    const mid = P({ x: (a.x + e.x) / 2 - nx * 12, y: (a.y + e.y) / 2 - ny * 12 });
    const angle = -(Math.atan2(uy, ux) * 180) / Math.PI;
    doc.text(formatLength(len, project.units), mid[0], mid[1], { align: "center", angle });
  }
  // Furniture
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.18);
  for (const f of project.furniture ?? []) {
    for (const shape of f.primitives) {
      const { pts, closed } = primitiveWorldPaths(f, shape);
      if (closed) polygon(pts, "S");
      else polyline(pts);
    }
  }

  // Wall lengths — aligned, offset on one side
  doc.setDrawColor(90, 90, 100);
  doc.setTextColor(90, 90, 100);
  doc.setFontSize(6);
  doc.setLineWidth(0.12);
  for (const w of project.walls) {
    const len = wallLength(w);
    if (len < 1) continue;
    const g = wallDimensionGeometry(w, w.thickness / 2 + 3.5 / k);
    doc.line(...P(g.a), ...P(g.b));
    const tick = 1.2 / k;
    for (const p of [g.a, g.b]) {
      doc.line(...P({ x: p.x - g.normal.x * tick, y: p.y - g.normal.y * tick }), ...P({ x: p.x + g.normal.x * tick, y: p.y + g.normal.y * tick }));
    }
    const off = 0.8 / k;
    const mid = P({ x: (g.a.x + g.b.x) / 2 + g.normal.x * off * (Math.abs(g.angle) === 90 ? 1 : 1), y: (g.a.y + g.b.y) / 2 + g.normal.y * off });
    doc.text(formatLength(len, project.units), mid[0], mid[1], { align: "center", angle: -g.angle });
  }
  doc.restoreGraphicsState();

  // Footer
  doc.setDrawColor(...INK);
  doc.setTextColor(...INK);
  const footerY = pageH - MARGIN - FOOTER + 6;
  doc.setLineWidth(0.3);
  doc.line(MARGIN, footerY, pageW - MARGIN, footerY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(project.name, MARGIN, footerY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    `${opts.paper.toUpperCase()} ${orientation} · Scale 1:${effectiveScale} · ${new Date().toLocaleDateString()}`,
    MARGIN,
    footerY + 12,
  );

  // Scale bar: metric 1m segments, imperial 1ft segments
  const unitCm = project.units === "imperial" ? CM_PER_FOOT : 100;
  const segMm = unitCm * k;
  const segments = Math.max(1, Math.min(5, Math.floor(60 / segMm)));
  const barX = pageW - MARGIN - segMm * segments;
  const barY = footerY + 5;
  const barH = 2;
  doc.setLineWidth(0.2);
  for (let i = 0; i < segments; i++) {
    if (i % 2 === 0) doc.setFillColor(...INK);
    else doc.setFillColor(255, 255, 255);
    doc.rect(barX + i * segMm, barY, segMm, barH, "FD");
  }
  doc.setFontSize(6.5);
  for (let i = 0; i <= segments; i++) {
    const label = i === segments ? `${i} ${project.units === "imperial" ? "ft" : "m"}` : `${i}`;
    doc.text(label, barX + i * segMm, barY + barH + 3, { align: "center" });
  }

  const safeName = project.name.replace(/[^\w\-]+/g, "_");
  doc.save(`${safeName}_1-${effectiveScale}.pdf`);
}

function areaLabel(m2: number, units: Project["units"]) {
  if (units === "imperial") return `${Math.round(m2 * 10.7639)} sq ft`;
  return `${m2.toFixed(1)} m2`;
}
