import { dockPositions } from './modules/logistics/layout';
import type { Vec3 } from './runtime/types';

/** scene.ts 작성용 순수 헬퍼: 손계산 좌표를 대신한다. 결과는 숫자 배열이라 scene 데이터에 그대로 넣는다 */
export type XZ = [number, number];
export interface Placement {
  at: Vec3;
  rotation: Vec3;
}
export interface BackIn extends Placement {
  path: XZ[];
}
export interface WarehouseAnchorOpts {
  at?: Vec3;
  /** yaw(도). warehouse 요소의 rotation[1]과 같은 값 */
  rotation?: number;
  width?: number;
  depth?: number;
  docks?: number;
}

const DEG = Math.PI / 180;

function fin(name: string, v: unknown, d: number): number {
  if (v === undefined) return d;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`warehouseAnchors: ${name}는 유한한 숫자여야 함 (받은 값 ${String(v)})`);
  return v;
}

export function warehouseAnchors(o: WarehouseAnchorOpts = {}) {
  const at = o.at ?? [0, 0, 0];
  if (!Array.isArray(at) || at.length !== 3 || at.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
    throw new Error('warehouseAnchors: at은 유한한 숫자 3개 [x, y, z]여야 함');
  }
  const yaw = fin('rotation', o.rotation, 0);
  const w = fin('width', o.width, 24);
  const d = fin('depth', o.depth, 14);
  const docks = Math.max(0, Math.round(fin('docks', o.docks, 4)));
  const xs = dockPositions(w, docks);
  const c = Math.cos(yaw * DEG);
  const s = Math.sin(yaw * DEG);
  const toWorld = (x: number, z: number): XZ => [at[0] + x * c + z * s, at[2] - x * s + z * c];
  const dockX = (i: number) => {
    if (docks === 0) throw new Error('warehouseAnchors: 도크가 없음 (docks 0)');
    if (!Number.isInteger(i) || i < 0 || i >= docks) throw new Error(`warehouseAnchors: dock 인덱스는 0..${docks - 1} 정수 (받은 값 ${i})`);
    return xs[i];
  };
  const truckZ = (len: number) => d / 2 + len / 2 + 0.7;
  return {
    /** 도크 문 중앙 바닥 (월드) */
    dock(i: number): Vec3 {
      const [x, z] = toWorld(dockX(i), d / 2);
      return [x, at[1], z];
    },
    /** 도크 앞 정차 트럭: 뒷면이 노란 범퍼 바로 앞, 앞이 바깥 */
    truck(i: number, t: { length?: number } = {}): Placement {
      const [x, z] = toWorld(dockX(i), truckZ(fin('length', t.length, 9)));
      return { at: [x, at[1], z], rotation: [0, yaw, 0] };
    },
    /** 후진 진입: follow.path로 쓰고 rotation [0,180,0] (follow가 진행 방향 yaw를 더함) */
    backIn(i: number, t: { length?: number; from?: number } = {}): BackIn {
      const lx = dockX(i);
      const zt = truckZ(fin('length', t.length, 9));
      const from = fin('from', t.from, 13);
      const [x, z] = toWorld(lx, zt);
      return { at: [x, at[1], z], rotation: [0, 180, 0], path: [toWorld(lx, zt + from), [x, z]] };
    },
  };
}

/**
 * 도로 중심선 points를 진행 방향 오른쪽으로 offset(m)만큼 평행 이동한 경로 (음수 = 왼쪽).
 * 꺾이는 점은 이등분 법선으로 밀고 배율은 최대 2. U턴은 앞 구간 법선을 쓴다. 입력은 바꾸지 않는다.
 */
export function lane(points: XZ[], offset: number, opts: { reverse?: boolean } = {}): XZ[] {
  if (typeof offset !== 'number' || !Number.isFinite(offset)) throw new Error('lane: offset은 유한한 숫자여야 함');
  const src = opts.reverse ? [...points].reverse() : points;
  const pts: XZ[] = [];
  for (const p of src) {
    if (!Array.isArray(p) || p.length !== 2 || !p.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      throw new Error('lane: 점은 [x, z] 유한한 숫자 쌍이어야 함');
    }
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-9) pts.push([p[0], p[1]]);
  }
  if (pts.length < 2) throw new Error('lane: 서로 다른 점이 2개 이상 필요함');
  const right = (a: XZ, b: XZ): XZ => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l = Math.hypot(dx, dz);
    return [-dz / l, dx / l];
  };
  return pts.map((p, i): XZ => {
    let n: XZ;
    let k = 1;
    if (i === 0) n = right(pts[0], pts[1]);
    else if (i === pts.length - 1) n = right(pts[i - 1], p);
    else {
      const n1 = right(pts[i - 1], p);
      const n2 = right(p, pts[i + 1]);
      const sx = n1[0] + n2[0];
      const sz = n1[1] + n2[1];
      const l = Math.hypot(sx, sz);
      if (l < 1e-3) n = n1; // U턴(거의 180°): 이등분 법선이 불안정하므로 앞 구간 법선
      else {
        n = [sx / l, sz / l];
        k = Math.min(2, 1 / Math.max(1e-6, n[0] * n1[0] + n[1] * n1[1]));
      }
    }
    return [p[0] + n[0] * offset * k, p[1] + n[1] * offset * k];
  });
}
