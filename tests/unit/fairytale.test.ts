import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getStyle } from '../../kit/styles';
import { rngFor } from '../../kit/runtime/rng';
import type { ElementType, KitContext } from '../../kit/runtime/types';
import { island } from '../../kit/modules/fairytale/island';
import { plateau } from '../../kit/modules/fairytale/plateau';
import { rock } from '../../kit/modules/fairytale/rock';
import { river } from '../../kit/modules/fairytale/river';
import { waterfall } from '../../kit/modules/fairytale/waterfall';
import { path } from '../../kit/modules/fairytale/path';
import { castle } from '../../kit/modules/fairytale/castle';
import { cottage } from '../../kit/modules/fairytale/cottage';
import { mushroom } from '../../kit/modules/fairytale/mushroom';
import { windmill } from '../../kit/modules/fairytale/windmill';
import { bridge } from '../../kit/modules/fairytale/bridge';
import { fairytree } from '../../kit/modules/fairytale/fairytree';
import { flowers } from '../../kit/modules/fairytale/flowers';
import { field } from '../../kit/modules/fairytale/field';
import { fence } from '../../kit/modules/fairytale/fence';
import { cloud } from '../../kit/modules/fairytale/cloud';

const BY: Record<string, ElementType> = { island, plateau, rock, river, waterfall, path, castle, cottage, mushroom, windmill, bridge, fairytree, flowers, field, fence, cloud };

const ctx: KitContext = { style: getStyle('pastel'), rng: (s) => rngFor(7, s), heightAt: () => 0, quality: 'preview', camera: new THREE.PerspectiveCamera() };
const verts = (o: THREE.Object3D) => {
  const out: number[] = [];
  o.updateMatrixWorld(true);
  o.traverse((m) => {
    const g = (m as THREE.Mesh).geometry;
    if (g) for (const v of g.attributes.position.array as Float32Array) out.push(v);
  });
  return out;
};
const bbox = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);

describe('fairytale 지형', () => {
  it('island: 윗면 y≈0, 바위는 아래로, 반지름 반영, NaN 없음', () => {
    const h = island.create(ctx, { radius: 30, depth: 12 });
    const b = bbox(h.object3d);
    expect(b.max.y).toBeGreaterThan(-0.1);
    expect(b.max.y).toBeLessThan(1.5);
    expect(b.min.y).toBeLessThan(-8);
    expect(b.max.x).toBeGreaterThan(27);
    expect(b.max.x).toBeLessThan(36);
    expect(verts(h.object3d).every(Number.isFinite)).toBe(true);
    h.dispose();
  });
  it.each(['island', 'plateau', 'rock'])('%s: 같은 variant → 같은 정점, 다른 variant → 다름 (Review Focus 1)', (t) => {
    const T = BY[t];
    const a = verts(T.create(ctx, { variant: 1 }).object3d);
    const b = verts(T.create(ctx, { variant: 1 }).object3d);
    const c = verts(T.create(ctx, { variant: 2 }).object3d);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
  it('plateau: 윗면 = height', () => {
    const b = bbox(BY.plateau.create(ctx, { radius: 9, height: 5 }).object3d);
    expect(b.max.y).toBeGreaterThan(4.8);
    expect(b.max.y).toBeLessThan(5.6);
    expect(b.min.y).toBeGreaterThanOrEqual(-0.05);
  });
  it('waterfall: 원점 = 위 가장자리, 아래로 height', () => {
    const b = bbox(BY.waterfall.create(ctx, { height: 10, width: 3 }).object3d);
    expect(b.max.y).toBeLessThan(1.2);
    expect(b.min.y).toBeLessThan(-9);
  });
  it.each(['river', 'path'])('%s: 중복 점 유한, 점 1개 오류 (Review Focus 2)', (t) => {
    const h = BY[t].create(ctx, { points: [[0, 0], [0, 0], [10, 0], [10, 8]] });
    expect(verts(h.object3d).every(Number.isFinite)).toBe(true);
    expect(() => BY[t].create(ctx, { points: [[0, 0]] })).toThrow(/points/);
  });
  it('island update: 같은 t → 같은 상태 (Review Focus 3)', () => {
    const h = BY.island.create(ctx, {});
    const ys = () => {
      const out: number[] = [];
      h.object3d.traverse((o) => out.push(o.position.y));
      return out;
    };
    h.update?.(3);
    const a = ys();
    h.update?.(9);
    h.update?.(3);
    expect(ys()).toEqual(a);
  });
});

describe('fairytale 건물', () => {
  it.each(['castle', 'cottage', 'mushroom', 'windmill', 'bridge'])('%s: 기본 생성, 바닥 원점, 크기, dispose', (t) => {
    const h = BY[t].create(ctx, {});
    h.update?.(1.2);
    const b = bbox(h.object3d);
    expect(b.min.y).toBeGreaterThanOrEqual(-0.05);
    expect(b.min.y).toBeLessThan(0.6);
    expect(b.getSize(new THREE.Vector3()).length()).toBeGreaterThan(2);
    expect(verts(h.object3d).every(Number.isFinite)).toBe(true);
    h.dispose();
  });
  it('castle: 탑 지붕은 roofAlt, 성문(dark)', () => {
    const h = BY.castle.create(ctx, { towers: 4 });
    expect(h.object3d.getObjectByName('roofAlt')).toBeTruthy();
    expect(h.object3d.getObjectByName('dark')).toBeTruthy();
  });
  it('cottage: roof 선택, 잘못된 값 오류', () => {
    expect(BY.cottage.create(ctx, { roof: 'roofAlt' }).object3d.getObjectByName('roofAlt')).toBeTruthy();
    expect(() => BY.cottage.create(ctx, { roof: 'gold' })).toThrow(/roof/);
  });
  it('mushroom: 빨간 갓(accent2) + 흰 점(trim)', () => {
    const o = BY.mushroom.create(ctx, {}).object3d;
    expect(o.getObjectByName('accent2')).toBeTruthy();
    expect(o.getObjectByName('trim')).toBeTruthy();
  });
  it('windmill: 날개 각 = t·speed·2π, seek 순서 무관 (Review Focus 3)', () => {
    const h = BY.windmill.create(ctx, { speed: 0.25 });
    const sails = h.object3d.getObjectByName('sails')!;
    h.update!(2);
    const a = sails.rotation.z;
    h.update!(7);
    h.update!(2);
    expect(sails.rotation.z).toBeCloseTo(a, 9);
    expect(Math.abs(a)).toBeCloseTo((2 * 0.25 * 2 * Math.PI) % (2 * Math.PI), 6);
  });
  it('castle 깃발: seek 순서 무관', () => {
    const h = BY.castle.create(ctx, {});
    const f = h.object3d.getObjectByName('flags')!;
    h.update!(1.5);
    const a = f.children.map((c) => c.rotation.y);
    h.update!(4);
    h.update!(1.5);
    expect(f.children.map((c) => c.rotation.y)).toEqual(a);
  });
  it('bridge: 로컬 X로 걸침 (span 반영)', () => {
    const b = bbox(BY.bridge.create(ctx, { span: 7 }).object3d);
    expect(b.max.x - b.min.x).toBeGreaterThan(7);
    expect(b.max.z - b.min.z).toBeLessThan(4);
  });
});

describe('fairytale 자연', () => {
  it.each(['fairytree', 'flowers', 'field', 'cloud'])('%s: 기본 생성, 크기, dispose', (t) => {
    const h = BY[t].create(ctx, {});
    const b = bbox(h.object3d);
    expect(b.getSize(new THREE.Vector3()).length()).toBeGreaterThan(0.5);
    expect(verts(h.object3d).every(Number.isFinite)).toBe(true);
    h.dispose();
  });
  it.each(['fairytree', 'flowers'])('%s: variant 결정성 (Review Focus 1)', (t) => {
    expect(verts(BY[t].create(ctx, { variant: 3 }).object3d)).toEqual(verts(BY[t].create(ctx, { variant: 3 }).object3d));
  });
  it('fairytree kind conifer/puffy, 잘못된 kind 오류', () => {
    expect(BY.fairytree.create(ctx, { kind: 'conifer' }).object3d.getObjectByName('foliage')).toBeTruthy();
    expect(() => BY.fairytree.create(ctx, { kind: 'palm' })).toThrow(/kind/);
  });
  it('fence: 점 따라 기둥, 중복 점 유한, 점 1개 오류 (Review Focus 2)', () => {
    const h = BY.fence.create(ctx, { points: [[0, 0], [0, 0], [6, 0]] });
    expect(verts(h.object3d).every(Number.isFinite)).toBe(true);
    expect(bbox(h.object3d).max.x).toBeGreaterThan(5.5);
    expect(() => BY.fence.create(ctx, { points: [[0, 0]] })).toThrow(/points/);
  });
  it('cloud: userData.noShadow, update seek 무관', () => {
    const h = BY.cloud.create(ctx, {});
    expect(h.object3d.userData.noShadow).toBe(true);
    h.update!(2);
    const a = h.object3d.position.y;
    h.update!(5);
    h.update!(2);
    expect(h.object3d.position.y).toBe(a);
  });
});

describe('fairytale 리본 면 방향 (벤치마크 1라운드: 강·길이 어둡게 렌더)', () => {
  it.each(['river', 'path'])('%s: 리본 삼각형이 위(+Y)를 향함', (t) => {
    const h = BY[t].create(ctx, { points: [[0, 0], [10, 0], [12, 10]] });
    let checked = 0;
    h.object3d.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !['water', 'road'].includes(m.name)) return;
      const g = m.geometry;
      const idx = g.index!;
      const p = g.attributes.position;
      const a = new THREE.Vector3().fromBufferAttribute(p, idx.getX(0));
      const b = new THREE.Vector3().fromBufferAttribute(p, idx.getX(1));
      const c = new THREE.Vector3().fromBufferAttribute(p, idx.getX(2));
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      expect(n.y, m.name).toBeGreaterThan(0);
      checked++;
    });
    expect(checked).toBeGreaterThan(0);
  });
});
