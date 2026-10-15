import * as THREE from 'three';
import { clamp01, ease } from './easing';
import type { FollowDef, Vec3 } from './types';

const cache = new Map<string, THREE.CatmullRomCurve3>();

/** centripetal Catmull-Rom 곡선 (같은 점 목록이면 캐시 재사용). 연속 중복 점은 제거한다. */
export function curveFrom(points: Vec3[]): THREE.CatmullRomCurve3 {
  const key = JSON.stringify(points);
  let c = cache.get(key);
  if (!c) {
    const vs: THREE.Vector3[] = [];
    for (const p of points) {
      const v = new THREE.Vector3(p[0], p[1], p[2]);
      if (!vs.length || vs[vs.length - 1].distanceToSquared(v) > 1e-10) vs.push(v);
    }
    if (vs.length === 1) vs.push(vs[0].clone().add(new THREE.Vector3(0, 0, 1e-4)));
    c = new THREE.CatmullRomCurve3(vs, false, 'centripetal');
    cache.set(key, c);
  }
  return c;
}

/** 경로 이동 상태: t의 순수함수. yaw는 +Z가 앞인 오브젝트를 진행 방향으로 돌리는 각도. */
export function followState(f: FollowDef, t: number): { x: number; z: number; yaw: number; travel: number } {
  const curve = curveFrom(f.path.map(([x, z]) => [x, 0, z] as Vec3));
  const u = ease(f.ease ?? 'inOut', clamp01((t - f.t0) / (f.t1 - f.t0)));
  const p = curve.getPointAt(u);
  const tan = curve.getTangentAt(u);
  const len = curve.getLength();
  const yaw = Math.atan2(tan.x, tan.z);
  return {
    x: Number.isFinite(p.x) ? p.x : f.path[0][0],
    z: Number.isFinite(p.z) ? p.z : f.path[0][1],
    yaw: Number.isFinite(yaw) ? yaw : 0,
    travel: Number.isFinite(len) ? u * len : 0,
  };
}
