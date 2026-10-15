import * as THREE from 'three';
import { curveFrom } from '../../runtime/motion';
import { defineElement } from '../../runtime/element';
import type { Vec3 } from '../../runtime/types';
import { num } from './common';

/** 곡선 위의 평평한 리본(법선 +Y). offset 범위 [a, b]는 중심선 기준 좌우 거리. */
function ribbon(curve: THREE.Curve<THREE.Vector3>, u0: number, u1: number, steps: number, a: number, b: number, y: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = u0 + ((u1 - u0) * i) / steps;
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    let nx = -t.z;
    let nz = t.x;
    const l = Math.hypot(nx, nz);
    if (l < 1e-8 || !Number.isFinite(l)) {
      nx = 1;
      nz = 0;
    } else {
      nx /= l;
      nz /= l;
    }
    pos.push(p.x + nx * a, y, p.z + nz * a, p.x + nx * b, y, p.z + nz * b);
    nor.push(0, 1, 0, 0, 1, 0);
    if (i > 0) {
      const k = i * 2;
      idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  // 리본의 감김 방향과 관계없이 위에서 보이도록 양면 재질을 쓴다.
  return g;
}

/** 도로: points [[x,z]…] 2개 이상(절대 좌표), width, 중앙 점선, 연석 */
export const road = defineElement({
  type: 'road',
  create(ctx, params) {
    const pts = params.points;
    const ok = Array.isArray(pts) && pts.length >= 2 && pts.every((p) => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === 'number' && Number.isFinite(x)));
    if (!ok) throw new Error('road.params.points는 [x, z] 점 2개 이상이어야 함 (절대 좌표)');
    const w = num(params.width, 6);
    const dashes = params.dashes !== false;
    const curve = curveFrom((pts as Array<[number, number]>).map(([x, z]) => [x, 0, z] as Vec3));
    const len = Math.max(0.5, curve.getLength() || 0.5);
    const steps = Math.max(2, Math.ceil(len / 0.5));
    const surface = ribbon(curve, 0, 1, steps, -w / 2, w / 2, 0.02);
    const trimGeos = [ribbon(curve, 0, 1, steps, w / 2, w / 2 + 0.3, 0.06), ribbon(curve, 0, 1, steps, -w / 2 - 0.3, -w / 2, 0.06)];
    if (dashes) {
      for (let s = 1; s + 1.5 < len; s += 3) {
        trimGeos.push(ribbon(curve, s / len, (s + 1.5) / len, 3, -0.08, 0.08, 0.035));
      }
    }
    const roadMat = ctx.style.material('road', { side: THREE.DoubleSide });
    const trimMat = ctx.style.material('trim', { side: THREE.DoubleSide });
    const group = new THREE.Group();
    const surfMesh = new THREE.Mesh(surface, roadMat);
    surfMesh.name = 'road';
    group.add(surfMesh);
    for (const g of trimGeos) group.add(new THREE.Mesh(g, trimMat));
    return {
      object3d: group,
      dispose() {
        surface.dispose();
        trimGeos.forEach((g) => g.dispose());
        roadMat.dispose();
        trimMat.dispose();
      },
    };
  },
});
