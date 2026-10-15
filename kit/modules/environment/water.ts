import * as THREE from 'three';
import type { Style } from '../../runtime/style';
import type { ElementHandle } from '../../runtime/types';

export function createWater(ctx: { style: Style }, p: { level: number; size: number }): ElementHandle {
  const geo = new THREE.PlaneGeometry(p.size, p.size, 64, 64);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const base = Float32Array.from(pos.array as Float32Array);
  const mat = ctx.style.material('water', { transparent: true, opacity: 0.85 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = p.level;
  const update = (t: number) => {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      pos.setY(i, 0.12 * Math.sin(x * 0.35 + t * 1.3) + 0.08 * Math.cos(z * 0.28 + t * 0.9));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  update(0);
  return {
    object3d: mesh,
    update,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
