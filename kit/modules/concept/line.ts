import * as THREE from 'three';
import { clamp01 } from '../../runtime/easing';
import { defineElement } from '../../runtime/element';
import { num, role } from './params';

export const line = defineElement({
  type: 'line',
  supportsGrow: true,
  create(ctx, params) {
    const pts = params.points;
    const ok = Array.isArray(pts) && pts.length >= 2 &&
      pts.every((p) => Array.isArray(p) && p.length === 3 && p.every((x) => typeof x === 'number' && Number.isFinite(x)));
    if (!ok) throw new Error('line.params.points는 [x,y,z] 점 2개 이상이어야 함 (요소 위치 기준 상대 좌표)');
    const curve = new THREE.CatmullRomCurve3((pts as number[][]).map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const tubular = Math.max(32, (pts as unknown[]).length * 24);
    const radial = 8;
    const geo = new THREE.TubeGeometry(curve, tubular, num(params.radius, 0.06), radial, false);
    const mat = ctx.style.material(role(params.role, 'accent'));
    const mesh = new THREE.Mesh(geo, mat);
    const perSeg = radial * 6;
    const setProgress = (p: number) => {
      const segs = Math.round(clamp01(p) * tubular);
      geo.setDrawRange(0, segs * perSeg);
      mesh.visible = segs > 0;
    };
    setProgress(1);
    return {
      object3d: mesh,
      setProgress,
      dispose() {
        geo.dispose();
        mat.dispose();
      },
    };
  },
});
