import * as THREE from 'three';
import { curveFrom } from '../../runtime/motion';
import { defineElement } from '../../runtime/element';
import type { Vec3 } from '../../runtime/types';
import { num } from './common';
import { ribbon } from '../../parts';

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
