import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { bridgeOn, lane, warehouseAnchors, type XZ } from '../../kit/anchors';
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

describe('lane', () => {
  it('직선: +X 진행의 오른쪽은 +Z', () => {
    close(lane([[0, 0], [10, 0]], 1.6).flat(), [0, 1.6, 10, 1.6]);
  });
  it('90° 꺾임: 두 구간 모두에서 거리 유지 (미터 꼭짓점)', () => {
    const r = lane([[0, 0], [10, 0], [10, 10]], 1);
    close(r.flat(), [0, 1, 9, 1, 9, 10]);
  });
  it('음수 offset = 왼쪽', () => {
    close(lane([[0, 0], [10, 0]], -2).flat(), [0, -2, 10, -2]);
  });
  it('reverse: 뒤집어 진행, 오른쪽은 반대편', () => {
    close(lane([[0, 0], [10, 0]], 1.6, { reverse: true }).flat(), [10, -1.6, 0, -1.6]);
  });
  it('입력 배열을 바꾸지 않음 (Review Focus 3)', () => {
    const pts: XZ[] = [[0, 0], [10, 0], [10, 10]];
    const copy = JSON.stringify(pts);
    lane(pts, 1, { reverse: true });
    lane(pts, -1);
    expect(JSON.stringify(pts)).toBe(copy);
  });
  it('U턴(180°)에서도 NaN 없음 (Review Focus 1)', () => {
    const r = lane([[0, 0], [10, 0], [0, 0.0001]], 1);
    expect(r.flat().every(Number.isFinite)).toBe(true);
    close(r[1], [10, 1], 3);
  });
  it('예각은 배율 상한 2', () => {
    const r = lane([[0, 0], [10, 0], [0, 1]], 1);
    expect(Math.hypot(r[1][0] - 10, r[1][1])).toBeLessThanOrEqual(2 + 1e-9);
  });
  it('연속 중복점 제거, 서로 다른 점 2개 미만이면 오류', () => {
    expect(lane([[0, 0], [0, 0], [10, 0]], 1)).toHaveLength(2);
    expect(() => lane([[1, 1], [1, 1]], 1)).toThrow(/2개/);
    expect(() => lane([[0, 0], [NaN, 1]], 1)).toThrow(/숫자/);
    expect(() => lane([[0, 0], [1, 0]], NaN)).toThrow(/offset/);
  });
});

describe('bridgeOn', () => {
  const R: XZ[] = [[0, -10], [0, 0], [10, 10], [20, 10]];
  it('로컬 X가 강 법선과 평행 (Review Focus 4)', () => {
    const p = bridgeOn(R, 1);
    close(p.at, [0, 0, 0]);
    const yaw = (p.rotation[1] * Math.PI) / 180;
    const localX = [Math.cos(yaw), -Math.sin(yaw)];
    const t = [10 - 0, 10 - -10];
    const l = Math.hypot(t[0], t[1]);
    const n = [-t[1] / l, t[0] / l];
    expect(Math.abs(localX[0] * n[0] + localX[1] * n[1])).toBeCloseTo(1, 6);
  });
  it('끝점·정수 아님·범위 밖 → 오류', () => {
    for (const i of [0, 3, 1.5, -1, 9]) expect(() => bridgeOn(R, i)).toThrow(/1\.\.2/);
  });
});
