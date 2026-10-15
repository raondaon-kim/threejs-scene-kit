import * as THREE from 'three';
import { blob, buildByRole, type Part } from '../../parts';
import type { KitContext, Role } from '../../runtime/types';

export { num } from '../concept/params';
export { pick } from '../logistics/common';

export type XZ = [number, number];

/** 요소별 시드 rng: 같은 type·variant면 같은 수열 */
export function seeded(ctx: KitContext, type: string, params: Record<string, unknown>): () => number {
  const v = typeof params.variant === 'number' && Number.isFinite(params.variant) ? Math.round(params.variant) : 0;
  return ctx.rng(`${type}:${v}`);
}

/** 점 배열 params 검사 (road와 같은 규칙: [x, z] 2개 이상, 절대 좌표) */
export function points(type: string, v: unknown): XZ[] {
  const ok = Array.isArray(v) && v.length >= 2 && v.every((p) => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === 'number' && Number.isFinite(x)));
  if (!ok) throw new Error(`${type}.params.points는 [x, z] 점 2개 이상이어야 함 (절대 좌표)`);
  return v as XZ[];
}

/** 시드로 흔들린 둥근 외곽선 (반지름 r, n개 점) */
export function outline(r: number, rng: () => number, wobble = 0.05, n = 72): XZ[] {
  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;
  const p3 = rng() * Math.PI * 2;
  const out: XZ[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + wobble * (Math.sin(3 * a + p1) * 0.6 + Math.sin(5 * a + p2) * 0.3 + Math.sin(9 * a + p3) * 0.15);
    out.push([Math.cos(a) * r * k, Math.sin(a) * r * k]);
  }
  return out;
}

/** 외곽선을 두께 t의 둥근 판으로 (윗면 y = top). 잔디 윗면에 씀 */
export function slab(ol: XZ[], t: number, top: number, bevel = 0.35): THREE.BufferGeometry {
  const s = new THREE.Shape();
  ol.forEach(([x, z], i) => (i === 0 ? s.moveTo(x, -z) : s.lineTo(x, -z)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, top - (t + bevel), 0);
  return g;
}

/** 반지름 r 원 둘레에 바위 덩어리 한 바퀴 (바닥 y0). size는 덩어리 지름 */
export function rockRing(parts: Part[], rng: () => number, r: number, y0: number, size: number, role: Role = 'rock'): void {
  const n = Math.max(6, Math.round((Math.PI * 2 * r) / (size * 0.85)));
  const p0 = rng() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = p0 + (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.08;
    const s = size * (0.8 + rng() * 0.45);
    const rr = r + (rng() - 0.5) * size * 0.25;
    const g = blob(s / 2, rng, 0.2, 1);
    g.scale(1, 0.85 + rng() * 0.3, 1);
    g.translate(Math.cos(a) * rr, y0 + (rng() - 0.5) * size * 0.2, Math.sin(a) * rr);
    parts.push({ role, geo: g });
  }
}

/** 리본 같은 얇은 면은 양면 재질로(감김 방향 무관) */
export function doubleSided(ctx: KitContext, role: Role, geo: THREE.BufferGeometry): { mesh: THREE.Mesh; dispose(): void } {
  const mat = ctx.style.material(role, { side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = role;
  return { mesh, dispose: () => (geo.dispose(), mat.dispose()) };
}

export { buildByRole };
