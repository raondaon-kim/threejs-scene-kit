import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { warehouseAnchors } from '../../kit/anchors';
import { dockPositions } from '../../kit/modules/logistics/warehouse';

type V3 = [number, number, number];
const close = (a: readonly number[], b: readonly number[], p = 6) => {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], p));
};
/** 기준: three.js holder(at, yaw)에 붙은 로컬 점의 월드 좌표 */
const world = (at: V3, yaw: number, local: V3) => {
  const g = new THREE.Object3D();
  g.position.set(...at);
  g.rotation.set(0, (yaw * Math.PI) / 180, 0);
  g.updateMatrixWorld();
  return g.localToWorld(new THREE.Vector3(...local)).toArray();
};

describe('warehouseAnchors', () => {
  it('dock = dockPositions 공식, 앞면 z = depth/2', () => {
    const wh = warehouseAnchors({ width: 30, depth: 16, docks: 4 });
    dockPositions(30, 4).forEach((x, i) => close(wh.dock(i), [x, 0, 8]));
  });
  it('기본값은 warehouse 요소와 같음 (24×14, docks 4)', () => {
    close(warehouseAnchors().dock(0), [dockPositions(24, 4)[0], 0, 7]);
  });
  it('truck: z = d/2 + L/2 + 0.7, rotation = 창고 yaw', () => {
    const p = warehouseAnchors({ width: 30, depth: 16, docks: 4 }).truck(2, { length: 9 });
    close(p.at, [3.6, 0, 13.2]);
    close(p.rotation, [0, 0, 0]);
  });
  it.each([90, 30, -135])('회전 %s°: three.js holder 변환과 일치 (Review Focus 2)', (yaw) => {
    const at: V3 = [5, 0.5, -3];
    const wh = warehouseAnchors({ at, rotation: yaw, width: 30, depth: 16, docks: 4 });
    close(wh.dock(1), world(at, yaw, [-3.6, 0, 8]));
    const t = wh.truck(3, { length: 7 });
    close(t.at, world(at, yaw, [10.8, 0, 8 + 3.5 + 0.7]));
    close(t.rotation, [0, yaw, 0]);
  });
  it('backIn: 앞쪽 from m 지점 → 정차 위치, rotation 180', () => {
    const b = warehouseAnchors({ width: 30, depth: 16, docks: 4 }).backIn(2, { length: 9, from: 13 });
    close(b.at, [3.6, 0, 13.2]);
    close(b.rotation, [0, 180, 0]);
    close(b.path.flat(), [3.6, 26.2, 3.6, 13.2]);
  });
  it('backIn: follow yaw + rotation 180 = 창고 yaw (회전 창고에서도 트럭 앞이 바깥)', () => {
    const yaw = 30;
    const b = warehouseAnchors({ rotation: yaw, width: 30, depth: 16 }).backIn(0);
    const [[x0, z0], [x1, z1]] = b.path;
    const followYaw = (Math.atan2(x1 - x0, z1 - z0) * 180) / Math.PI;
    const total = (((followYaw + b.rotation[1]) % 360) + 360) % 360;
    expect(total).toBeCloseTo(yaw, 6);
  });
  it('docks 1 → 중앙, docks 0 → 오류 (Review Focus 5)', () => {
    close(warehouseAnchors({ docks: 1 }).dock(0), [0, 0, 7]);
    expect(() => warehouseAnchors({ docks: 0 }).dock(0)).toThrow(/도크가 없음/);
  });
  it('잘못된 인덱스·파라미터는 허용 범위를 담은 오류', () => {
    const wh = warehouseAnchors({ docks: 4 });
    for (const i of [-1, 4, 1.5, NaN]) expect(() => wh.dock(i)).toThrow(/0\.\.3/);
    expect(() => warehouseAnchors({ width: NaN })).toThrow(/width/);
    expect(() => wh.truck(0, { length: Infinity })).toThrow(/length/);
    expect(() => warehouseAnchors({ at: [0, NaN, 0] as unknown as V3 })).toThrow(/at/);
  });
});
