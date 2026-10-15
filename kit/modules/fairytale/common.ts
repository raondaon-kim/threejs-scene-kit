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
/** maxTop: 덩어리 꼭대기 상한(잔디 윗면 아래). 넘으면 바닥 기준으로 납작하게 줄이고, 너무 낮으면 아래로 내린다 */
export function rockRing(parts: Part[], rng: () => number, r: number, y0: number, size: number, role: Role = 'rock', maxTop = Infinity): void {
  const n = Math.max(6, Math.round((Math.PI * 2 * r) / (size * 0.85)));
  const p0 = rng() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = p0 + (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.08;
    const s = size * (0.8 + rng() * 0.45);
    const rr = r + (rng() - 0.5) * size * 0.25;
    const g = blob(s / 2, rng, 0.2, 1);
    g.scale(1, 0.85 + rng() * 0.3, 1);
    g.translate(Math.cos(a) * rr, y0 + (rng() - 0.5) * size * 0.2, Math.sin(a) * rr);
    g.computeBoundingBox();
    // translate/scale이 boundingBox를 다시 계산하므로 값을 먼저 꺼내 둔다
    const minY = g.boundingBox!.min.y;
    const maxY = g.boundingBox!.max.y;
    if (maxY > maxTop) {
      const h = maxY - minY;
      const room = maxTop - minY;
      if (room > h * 0.35) {
        g.translate(0, -minY, 0);
        g.scale(1, room / h, 1);
        g.translate(0, minY, 0);
      } else g.translate(0, maxTop - maxY, 0);
    }
    parts.push({ role, geo: g });
  }
}

/**
 * 평평한 리본의 삼각형이 아래를 향하면(감김 반대) 뒤집는다. 양면 재질은 뒷면에서 법선을 뒤집어
 * 조명이 어두워지므로(강·길이 회색·갈색으로 보임) 앞면이 위를 향하게 맞춘다. 세로 면(폭포)은 그대로.
 */
function faceUp(geo: THREE.BufferGeometry): void {
  const idx = geo.index;
  if (!idx || idx.count < 3) return;
  const p = geo.attributes.position;
  const a = new THREE.Vector3().fromBufferAttribute(p, idx.getX(0));
  const b = new THREE.Vector3().fromBufferAttribute(p, idx.getX(1));
  const c = new THREE.Vector3().fromBufferAttribute(p, idx.getX(2));
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  if (n.y >= 0 || Math.abs(n.y) < 0.7 * n.length()) return; // 수평 리본만 (세로 폭포 면은 건드리지 않음)
  for (let i = 0; i + 2 < idx.count; i += 3) {
    const t = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, t);
  }
  idx.needsUpdate = true;
}

/** 리본 같은 얇은 면은 양면 재질로(감김 방향 무관) + 앞면이 위를 향하게 */
export function doubleSided(ctx: KitContext, role: Role, geo: THREE.BufferGeometry): { mesh: THREE.Mesh; dispose(): void } {
  faceUp(geo);
  const mat = ctx.style.material(role, { side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = role;
  return { mesh, dispose: () => (geo.dispose(), mat.dispose()) };
}

export { buildByRole };
