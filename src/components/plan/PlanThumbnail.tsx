import { doorGeometry, planBounds, pointsToPath } from "@/lib/plan/geometry";
import type { PlanData } from "@/lib/plan/types";

export function PlanThumbnail({ data, className }: { data: PlanData; className?: string }) {
  const b = planBounds(data);
  const pad = 80;
  const w = b.maxX - b.minX + pad * 2;
  const h = b.maxY - b.minY + pad * 2;
  const k = Math.max(w, h) / 220; // ~1px strokes scale

  return (
    <svg viewBox={`${b.minX - pad} ${b.minY - pad} ${w} ${h}`} className={className} preserveAspectRatio="xMidYMid meet">
      {data.rooms.map((r) => (
        <rect
          key={r.id}
          x={r.center_x - r.width / 2}
          y={r.center_y - r.height / 2}
          width={r.width}
          height={r.height}
          className="fill-room-fill stroke-blueprint/40"
          strokeWidth={k}
          strokeDasharray={`${k * 4} ${k * 3}`}
        />
      ))}
      {data.walls.map((wall) => (
        <line
          key={wall.id}
          x1={wall.start_x}
          y1={wall.start_y}
          x2={wall.end_x}
          y2={wall.end_y}
          className="stroke-wall"
          strokeWidth={Math.max(wall.thickness, k * 2)}
          strokeLinecap="square"
        />
      ))}
      {data.doors.map((d) => {
        const wall = data.walls.find((x) => x.id === d.wall_id);
        if (!wall) return null;
        const g = doorGeometry(d, wall);
        return (
          <g key={d.id} className="stroke-ink" fill="none" strokeWidth={k}>
            <line x1={g.jambA.x} y1={g.jambA.y} x2={g.leafEnd.x} y2={g.leafEnd.y} />
            <path d={pointsToPath(g.arc)} />
          </g>
        );
      })}
    </svg>
  );
}
