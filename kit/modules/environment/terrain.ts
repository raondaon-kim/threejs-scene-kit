import * as THREE from 'three';
import type { Style } from '../../runtime/style';
import type { ElementHandle, Quality } from '../../runtime/types';

export function createTerrain(
  ctx: { style: Style; quality: Quality },
  field: { heightAt(x: number, z: number): number },
  size: number,
): ElementHandle {
  const segs = ctx.quality === 'final' ? 160 : 90;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const heights = new Float32Array(pos.count);
  let minH = Infinity;
  let maxH = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const h = field.heightAt(pos.getX(i), pos.getZ(i));
    heights[i] = h;
    pos.setY(i, h);
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
  }
  const base = new THREE.Color(ctx.style.palette.ground);
  const low = base.clone().multiplyScalar(0.75);
  const high = base.clone().lerp(new THREE.Color('#ffffff'), 0.25);
  const c = new THREE.Color();
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = maxH > minH ? (heights[i] - minH) / (maxH - minH) : 0.5;
    c.copy(low).lerp(high, k);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = ctx.style.material('ground', { vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  return {
    object3d: mesh,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
