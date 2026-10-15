import * as THREE from 'three';
import { distToPolyline, type XZ } from '../../layout';
import { shade } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num } from '../concept/params';
import { ELEMENT_ROLES, type Role } from '../../runtime/types';

const MAX = 20000;

function xz(v: unknown): v is XZ {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

/** 풀포기 하나: 가늘게 휜 잎 3장(교차), 바닥 원점, 아래 어둡고 위 밝은 정점 색 */
function tuft(h: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const w = h * 0.09;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const lean = 0.18 * h;
    // 잎 = 아래 사각(두 삼각) + 위 뾰족 삼각, 위로 갈수록 기울어짐
    const pts = [
      [-w, 0, 0], [w, 0, 0], [w * 0.6, h * 0.55, lean * 0.4], [-w * 0.6, h * 0.55, lean * 0.4], [0, h, lean],
    ].map(([x, y, z]) => [x * ca - z * sa, y, x * sa + z * ca]);
    const tri = (i: number, j: number, l: number) => pos.push(...pts[i], ...pts[j], ...pts[l]);
    tri(0, 1, 2);
    tri(0, 2, 3);
    tri(3, 2, 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return shade(g, { top: 1.12, bottom: 0.82 });
}

/**
 * 잔디: 풀포기를 원 안에 인스턴싱으로 흩뿌린다 (절대 좌표). 그림자를 드리우지 않는다.
 * center [0,0], radius 10, count 1500(최대 20000), height 0.35, avoid [[x,z]…][] (강·길), avoidWidth 2, role 'ground'(잔디와 같은 색), variant 0
 */
export const grass = defineElement({
  type: 'grass',
  create(ctx, params) {
    if (params.center !== undefined && !xz(params.center)) throw new Error('grass.params.center는 [x, z] 숫자 2개');
    const [cx, cz] = (params.center as XZ | undefined) ?? [0, 0];
    const R = Math.max(0.5, num(params.radius, 10));
    const count = Math.max(0, Math.min(MAX, Math.round(num(params.count, 1500))));
    const H = Math.max(0.05, num(params.height, 0.35));
    const half = Math.max(0, num(params.avoidWidth, 2)) / 2;
    const avoid = params.avoid;
    if (avoid !== undefined && !(Array.isArray(avoid) && avoid.every((l) => Array.isArray(l) && l.length >= 1 && l.every(xz)))) {
      throw new Error('grass.params.avoid는 [[x, z], …] 선들의 배열 (강·길 points)');
    }
    const lines = (avoid as XZ[][] | undefined) ?? [];
    const v = typeof params.variant === 'number' && Number.isFinite(params.variant) ? Math.round(params.variant) : 0;
    const rng = ctx.rng(`grass:${v}`);
    const geo = tuft(H);
    const role = (params.role ?? 'ground') as Role;
    if (!ELEMENT_ROLES.includes(role)) throw new Error(`grass.params.role '${String(params.role)}'은 알 수 없는 역할. 가능: ${ELEMENT_ROLES.join('|')}`);
    const mat = ctx.style.material(role, { vertexColors: true, keepColor: true, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
    mesh.name = role;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    let n = 0;
    for (let tries = 0; n < count && tries < count * 4; tries++) {
      const r = R * Math.sqrt(rng());
      const a = rng() * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const yaw = rng() * Math.PI * 2;
      const k = 0.7 + rng() * 0.6;
      const tone = 0.88 + rng() * 0.24;
      if (lines.some((l) => distToPolyline([x, z], l) < half)) continue;
      q.setFromAxisAngle(up, yaw);
      s.set(k, k * (0.85 + rng() * 0.3), k);
      m.compose(new THREE.Vector3(x, 0, z), q, s);
      mesh.setMatrixAt(n, m);
      mesh.setColorAt(n, c.setRGB(tone, tone * (0.97 + rng() * 0.06), tone * 0.95));
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    const group = new THREE.Group();
    group.add(mesh);
    group.userData.noShadow = true;
    return {
      object3d: group,
      dispose() {
        geo.dispose();
        mat.dispose();
        mesh.dispose();
      },
    };
  },
});
