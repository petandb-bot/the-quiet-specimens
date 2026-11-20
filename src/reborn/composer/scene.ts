import * as T from 'three';
import type { GroundPoint } from '../motion';

const count = 80;
export type Marker = { center: GroundPoint; radius: number; color: string; selected?: boolean; square?: boolean };

export class ArrangeScene {
  readonly plan = new T.OrthographicCamera(-36, 36, 36, -36, .1, 160);
  private marks = new T.Group();
  private lines: Array<T.LineLoop<T.BufferGeometry, T.LineBasicMaterial>> = [];
  private ray = new T.Raycaster();
  private cursor = new T.Vector2();

  constructor(private host: HTMLCanvasElement, scene: T.Scene) {
    this.plan.position.set(0, 78, 0);
    this.plan.up.set(0, 0, -1);
    this.plan.lookAt(0, 0, 0);
    this.marks.visible = false;
    scene.add(this.marks);
  }

  resize(aspect: number) {
    // Fit the complete editable area in both portrait and landscape.
    const w = 34.5 * Math.max(1, aspect), h = 34.5 / Math.min(1, aspect);
    this.plan.left = -w; this.plan.right = w; this.plan.top = h; this.plan.bottom = -h;
    this.plan.updateProjectionMatrix();
  }

  update(markers: readonly Marker[], height: (x: number, z: number) => number, visible: boolean) {
    this.marks.visible = visible;
    if (!visible) return;
    for (const [i, marker] of markers.entries()) {
      let line = this.lines[i];
      if (!line) {
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(3 * count), 3));
        line = new T.LineLoop(geometry, new T.LineBasicMaterial({ transparent: true, depthWrite: false, fog: false }));
        line.frustumCulled = false;
        line.renderOrder = 6;
        this.marks.add(line);
        this.lines.push(line);
      }
      line.visible = true;
      line.material.color.set(marker.color);
      line.material.opacity = marker.selected ? .98 : .58;
      const positions = line.geometry.attributes.position;
      for (let step = 0; step < count; step++) {
        const a = step * Math.PI * 2 / count;
        const u = Math.cos(a), v = Math.sin(a);
        const scale = marker.radius / (marker.square ? Math.max(Math.abs(u), Math.abs(v)) : 1);
        const x = marker.center[0] + scale * u, z = marker.center[1] + scale * v;
        positions.setXYZ(step, x, height(x, z) + .085, z);
      }
      positions.needsUpdate = true;
    }
    for (let i = markers.length; i < this.lines.length; i++) this.lines[i].visible = false;
  }

  // Raycast the same ground triangles used by the residents and the visible terrain.
  hit(clientX: number, clientY: number, camera: T.Camera, ground: T.Mesh, objects: readonly T.Object3D[]) {
    const rect = this.host.getBoundingClientRect();
    this.cursor.set(2 * (clientX - rect.left) / rect.width - 1, 1 - 2 * (clientY - rect.top) / rect.height);
    this.ray.setFromCamera(this.cursor, camera);
    const hit = this.ray.intersectObject(ground, false)[0];
    const object = this.ray.intersectObjects([...objects], true)[0];
    let parent = object && (!hit || object.distance <= hit.distance + .08) ? object.object : undefined;
    while (parent && !parent.userData.objectId) parent = parent.parent ?? undefined;
    return { ground: hit ? [hit.point.x, hit.point.z] as GroundPoint : undefined, object: parent?.userData.objectId as string | undefined };
  }
}
