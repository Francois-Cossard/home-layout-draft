export type Units = "metric" | "imperial";
export type ScaleOption = 50 | 100 | "fit";
export type PaperSize = "a4" | "a3";
export type WallType = "structural" | "drywall";
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

export type FurniturePrimitive =
  | { id: string; kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { id: string; kind: "rect"; x: number; y: number; width: number; height: number }
  | { id: string; kind: "circle"; cx: number; cy: number; radius: number };

export interface FurnitureDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  primitives: FurniturePrimitive[];
  created_at: string;
}

export interface FurniturePlacement {
  id: string;
  project_id: string;
  definition_id: string;
  name: string;
  center_x: number;
  center_y: number;
  rotation: number;
  width: number;
  height: number;
  primitives: FurniturePrimitive[];
}

export interface PlanData {
  walls: Wall[];
  rooms: Room[];
  doors: Door[];
  windows: WindowEl[];
  dimensions: Dimension[];
  furniture: FurniturePlacement[];
}

export interface Project extends PlanData {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  default_scale: ScaleOption;
  units: Units;
}

export type ElementKind = "wall" | "room" | "door" | "window" | "dimension" | "furniture";
export type Selection = { kind: ElementKind; id: string } | null;
export type Tool = "select" | "wall" | "room" | "door" | "window" | "dimension" | "furniture";

export interface Point {
  x: number;
  y: number;
}
