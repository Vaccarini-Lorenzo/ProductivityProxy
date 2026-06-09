export interface Vec {
  x: number;
  y: number;
}

export interface OpPort extends Vec {
  id: string;
}

// Diamond (rhombus): top, right, bottom, left
const IF_VERTS: Vec[] = [
  { x: 50, y: 4 },
  { x: 96, y: 50 },
  { x: 50, y: 96 },
  { x: 4, y: 50 },
];

// Regular polygon with one vertex pointing left (the input).
export function polygonVerts(sides: number): Vec[] {
  const n = Math.max(3, sides);
  const radius = 47;
  const verts: Vec[] = [];
  for (let k = 0; k < n; k += 1) {
    const angle = ((180 - (k * 360) / n) * Math.PI) / 180;
    verts.push({ x: 50 + radius * Math.cos(angle), y: 50 - radius * Math.sin(angle) });
  }
  return verts;
}

export interface OperatorLayout {
  verts: Vec[];
  input: Vec;
  ports: OpPort[];
}

export function operatorLayout(type: string, cases: string[]): OperatorLayout {
  if (type === "if") {
    return {
      verts: IF_VERTS,
      input: IF_VERTS[3],
      ports: [
        { id: "then", x: IF_VERTS[1].x, y: IF_VERTS[1].y },
        { id: "else", x: IF_VERTS[2].x, y: IF_VERTS[2].y },
      ],
    };
  }
  const verts = polygonVerts(cases.length + 1);
  return {
    verts,
    input: verts[0],
    ports: cases.map((id, index) => ({ id, x: verts[index + 1].x, y: verts[index + 1].y })),
  };
}

export function pointsAttr(verts: Vec[]): string {
  return verts.map((v) => `${v.x},${v.y}`).join(" ");
}

// Position for a port's text label, nudged toward the shape centre.
export function labelPos(port: Vec): Vec {
  return { x: port.x + (50 - port.x) * 0.34, y: port.y + (50 - port.y) * 0.34 };
}
