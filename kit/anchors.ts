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
