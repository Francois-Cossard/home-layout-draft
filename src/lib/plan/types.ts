export type Units = "metric" | "imperial";
export type ScaleOption = 50 | 100 | "fit";
export type PaperSize = "a4" | "a3";
export type WallType = "interior" | "exterior";
export type SwingDirection = "left-in" | "left-out" | "right-in" | "right-out";

export interface Wall {
  id: string;
  project_id: string;
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  thickness: number; // cm
  wall_type: WallType;
}

export interface Room {
  id: string;
  project_id: string;
  name: string;
  area: number; // m²
  center_x: number;
  center_y: number;
  width: number; // cm — used to draw the room outline
  height: number; // cm
}

export interface Door {
  id: string;
  project_id: string;
  wall_id: string;
  position_along_wall: number; // cm from wall start to door centre
  width: number; // cm
  swing_direction: SwingDirection;
}

export interface WindowEl {
  id: string;
  project_id: string;
  wall_id: string;
  position_along_wall: number;
  width: number;
}

export interface Dimension {
  id: string;
  project_id: string;
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
}

export interface PlanData {
  walls: Wall[];
  rooms: Room[];
  doors: Door[];
  windows: WindowEl[];
  dimensions: Dimension[];
}

export interface Project extends PlanData {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  default_scale: ScaleOption;
  units: Units;
}

export type ElementKind = "wall" | "room" | "door" | "window" | "dimension";
export type Selection = { kind: ElementKind; id: string } | null;
export type Tool = "select" | "wall" | "room" | "door" | "window" | "dimension";

export interface Point {
  x: number;
  y: number;
}
