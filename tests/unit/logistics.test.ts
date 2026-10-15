import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getStyle } from '../../kit/styles';
import { LOGISTICS_ELEMENTS } from '../../kit/modules/logistics';
import { dockPositions } from '../../kit/modules/logistics/warehouse';
import { warehouseAnchors } from '../../kit/anchors';
import { elementRegistry } from '../../kit/runtime/registry';
import type { KitContext } from '../../kit/runtime/types';

const ctx: KitContext = { style: getStyle('clay'), rng: () => () => 0.5, heightAt: () => 0, quality: 'preview', camera: new THREE.PerspectiveCamera() };
const byType = Object.fromEntries(LOGISTICS_ELEMENTS.map((e) => [e.type, e]));

describe('logistics kit', () => {
  it('10종 등록', () => {
    expect(Object.keys(byType).sort()).toEqual(['building', 'container', 'forklift', 'lot', 'pallet', 'pin', 'road', 'tree', 'truck', 'warehouse']);
    for (const t of Object.keys(byType)) expect(elementRegistry().has(t)).toBe(true);
  });
  for (const type of ['warehouse', 'truck', 'forklift', 'pallet', 'container', 'lot', 'tree', 'pin', 'building']) {
    it(`${type}: 기본 생성, 바닥 원점, dispose`, () => {
      const h = byType[type].create(ctx, {});
      h.update?.(1.5);
      const box = new THREE.Box3().setFromObject(h.object3d);
      expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
      expect(box.min.y).toBeLessThan(0.6);
      expect(box.getSize(new THREE.Vector3()).length()).toBeGreaterThan(0.5);
      h.dispose();
    });
  }
  it('road: 중복 점에서도 유한, 점 1개는 오류 (Review Focus 3)', () => {
    const h = byType.road.create(ctx, { points: [[0, 0], [0, 0], [20, 0]] });
    h.object3d.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) expect(Array.from(m.geometry.attributes.position.array as Float32Array).every(Number.isFinite)).toBe(true);
    });
    expect(() => byType.road.create(ctx, { points: [[0, 0]] })).toThrow();
    h.dispose();
  });
  it('truck travel → 바퀴 회전, 값으로 결정', () => {
    const h = byType.truck.create(ctx, {});
    expect(byType.truck.animatable).toContain('travel');
    h.setParam!('travel', 3.14);
    const wheel = h.object3d.getObjectByName('wheel')!;
    const a = wheel.rotation.x;
    h.setParam!('travel', 0);
    h.setParam!('travel', 3.14);
    expect(wheel.rotation.x).toBe(a);
    expect(a).not.toBe(0);
    h.dispose();
  });
  it('forklift lift → 캐리지 높이 (Review Focus 1)', () => {
    const h = byType.forklift.create(ctx, {});
    const c = h.object3d.getObjectByName('carriage')!;
    h.setParam!('lift', 0);
    const y0 = c.position.y;
    h.setParam!('lift', 1);
    expect(c.position.y).toBeGreaterThan(y0 + 1);
    h.setParam!('lift', 0);
    expect(c.position.y).toBe(y0);
    h.dispose();
  });
  it('warehouse: ribs on/off가 지오메트리를 바꿈', () => {
    const count = (p: Record<string, unknown>) => {
      const h = byType.warehouse.create(ctx, p);
      let v = 0;
      h.object3d.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) v += m.geometry.attributes.position.count; });
      h.dispose();
      return v;
    };
    expect(count({})).toBeGreaterThan(count({ ribs: false }));
  });
  it('warehouse 도크는 중심 대칭 (리뷰 I2)', () => {
    expect(dockPositions(30, 4).map((x) => +x.toFixed(3))).toEqual([-10.8, -3.6, 3.6, 10.8]);
    expect(dockPositions(30, 1)).toEqual([0]);
    const h = byType.warehouse.create(ctx, { width: 30, docks: 4, ribs: false });
    const dark = h.object3d.getObjectByName('dark') as THREE.Mesh;
    dark.geometry.computeBoundingBox();
    const bb = dark.geometry.boundingBox!;
    const front = new THREE.Box3();
    const pos = dark.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) if (pos.getZ(i) > 6.9) front.expandByPoint(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
    expect(front.min.x).toBeCloseTo(-front.max.x, 1);
    void bb;
    h.dispose();
  });
  it('앵커 dock x = 실제 메시의 범퍼 기둥 사이 중앙 (accent 기둥 x±1.9)', () => {
    const h = byType.warehouse.create(ctx, { width: 30, depth: 16, docks: 3 });
    const accent = h.object3d.getObjectByName('accent') as THREE.Mesh;
    const pos = accent.geometry.attributes.position;
    const xs: number[] = [];
    for (let i = 0; i < pos.count; i++) xs.push(pos.getX(i));
    const wh = warehouseAnchors({ width: 30, depth: 16, docks: 3 });
    for (let i = 0; i < 3; i++) {
      const x = wh.dock(i)[0];
      for (const s of [-1, 1]) expect(xs.some((v) => Math.abs(v - (x + s * 1.9)) < 0.11)).toBe(true);
    }
    h.dispose();
  });
  it('lot: role 지정', () => {
    const h = byType.lot.create(ctx, { role: 'neutral' });
    const mesh = h.object3d.getObjectByName('neutral') as THREE.Mesh;
    expect(mesh).toBeDefined();
    h.dispose();
  });
  it('잘못된 params', () => {
    expect(() => byType.pallet.create(ctx, { cargo: 'gold' })).toThrow(/boxes/);
    expect(() => byType.container.create(ctx, { length: 7 })).toThrow();
    expect(() => byType.truck.create(ctx, { kind: 'bus' })).toThrow();
    expect(() => byType.tree.create(ctx, { kind: 'palm' })).toThrow();
  });
});
