import * as T from 'three';

type V = T.Vector3;
export type Point = (u: number, v: number) => V;
type Tint = (u: number, v: number) => T.Color;
export const vector = (x: number, y: number, z: number) => new T.Vector3(x, y, z);

interface FinSurface {
  membrane: T.Material;
  finTint: Tint;
  vein: T.Color;
  trim: T.LineBasicMaterial;
  seam: T.LineBasicMaterial;
}

export function patch(rows: number, cols: number, point: Point, tint: Tint, flip = false): T.BufferGeometry {
  const xyz: number[] = [], rgb: number[] = [], uv: number[] = [], triangles: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const u = i / rows;
    for (let j = 0; j <= cols; j++) {
      const v = j / cols;
      xyz.push(...point(u, v).toArray());
      rgb.push(...tint(u, v).toArray());
      uv.push(u, v);
      if (i === rows || j === cols) continue;
      const a = i * (cols + 1) + j;
      const b = a + cols + 1;
      if (flip) triangles.push(a, b, a + 1, b, b + 1, a + 1);
      else triangles.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(xyz, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(rgb, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  return geometry;
}

export function filament(group: T.Group, path: (t: number) => V, material: T.LineBasicMaterial, color: T.Color, steps = 28, fade = true) {
  const points: V[] = [];
  const colors: number[] = [];
  for (let i = 0; i <= steps; i++) {
    points.push(path(i / steps));
    colors.push(...color.clone().multiplyScalar(fade ? 1 - .86 * (i / steps) ** 1.35 : .84).toArray());
  }
  const geometry = new T.BufferGeometry().setFromPoints(points);
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  const line = new T.Line(geometry, material);
  line.renderOrder = 3;
  group.add(line);
}

export function pearl(group: T.Group, pos: V, radius: number, material: T.Material, scale?: V) {
  const mesh = new T.Mesh(new T.SphereGeometry(radius, 12, 8), material);
  mesh.position.copy(pos);
  if (scale) mesh.scale.copy(scale);
  group.add(mesh);
}

export function fin(group: T.Group, shape: Point, s: FinSurface, fins: number, low: boolean, color = s.vein) {
  const geometry = patch(low ? 17 : 26, low ? 28 : 48, shape, s.finTint);
  const mesh = new T.Mesh(geometry, s.membrane);
  mesh.renderOrder = 1;
  group.add(mesh);
  for (let i = 0; i <= fins; i++) {
    filament(group, u => shape(u, i / fins), i === 0 || i === fins ? s.trim : s.seam, color, low ? 15 : 23);
  }
  filament(group, v => shape(1, v), s.seam, color, 44, false);
}

