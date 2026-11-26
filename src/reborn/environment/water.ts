import * as T from 'three';
import type { Terrain } from '../terrain';
import type { WaterRegion } from './land-edits';

function makeWater(region: WaterRegion) {
  const left = Math.floor(region.x - region.radius), top = Math.floor(region.z - region.radius);
  const width = Math.ceil(region.x + region.radius) - left, length = Math.ceil(region.z + region.radius) - top;
  const geometry = new T.PlaneGeometry(width, length, width, length);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(left + width / 2, 0, top + length / 2);
  const position = geometry.getAttribute('position');
  const depths = new T.BufferAttribute(new Float32Array(position.count), 1);
  geometry.setAttribute('waterDepth', depths);
  const location = new T.Vector3(region.x, region.z, region.radius);
  const clarity = { value: region.clarity };
  const time = { value: 0 };
  const material = new T.MeshStandardMaterial({ color: region.color, roughness: .27, metalness: .11,
    transparent: true, depthWrite: false, side: T.DoubleSide });
  material.onBeforeCompile = shader => {
    shader.uniforms.pool = { value: location };
    shader.uniforms.clarity = clarity;
    shader.uniforms.poolTime = time;
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nattribute float waterDepth; varying float vPoolDepth; varying vec2 vPoolPoint;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvPoolDepth = waterDepth; vPoolPoint = position.xz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying float vPoolDepth; varying vec2 vPoolPoint; uniform vec3 pool; uniform float clarity; uniform float poolTime;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float poolDistance = distance(vPoolPoint, pool.xy);
      if (vPoolDepth <= 0.0 || poolDistance > pool.z) discard;
      float shimmer = sin(vPoolPoint.x * 1.2 + vPoolPoint.y * 0.6 + poolTime * 0.33) * 0.012;
      diffuseColor.rgb *= 1.0 + shimmer;
      diffuseColor.a *= (0.76 - clarity * 0.40) * smoothstep(0.0, 0.20, vPoolDepth)
        * (1.0 - smoothstep(pool.z - 0.48, pool.z, poolDistance));`);
  };
  material.customProgramCacheKey = () => 'quiet-water-shoreline';
  const mesh = new T.Mesh(geometry, material);
  mesh.renderOrder = 1;
  const update = (region: WaterRegion, terrain: Terrain) => {
    mesh.position.y = region.level + .013;
    material.color.set(region.color);
    clarity.value = region.clarity;
    for (let i = 0; i < position.count; i++) depths.setX(i, region.level - terrain.height(position.getX(i), position.getZ(i)));
    depths.needsUpdate = true;
  };
  return { mesh, time, update, dispose() { mesh.removeFromParent(); geometry.dispose(); material.dispose(); } };
}

export class QuietWater {
  private pools = new Map<string, { region: WaterRegion; surface: ReturnType<typeof makeWater> }>();
  constructor(private root: T.Group) {}

  apply(regions: readonly WaterRegion[], terrain: Terrain) {
    const ids = new Set(regions.map(region => region.id));
    for (const [id, old] of this.pools) {
      if (!ids.has(id)) { old.surface.dispose(); this.pools.delete(id); }
    }
    for (const region of regions) {
      let pool = this.pools.get(region.id);
      if (!pool || pool.region.x !== region.x || pool.region.z !== region.z || pool.region.radius !== region.radius) {
        pool?.surface.dispose();
        pool = { region, surface: makeWater(region) };
        this.pools.set(region.id, pool);
        this.root.add(pool.surface.mesh);
      }
      pool.region = region;
      pool.surface.update(region, terrain);
    }
  }

  animate(time: number) { for (const { surface } of this.pools.values()) surface.time.value = time; }
}
