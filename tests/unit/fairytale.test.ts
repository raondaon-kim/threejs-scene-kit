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

const BY: Record<string, ElementType> = { island, plateau, rock, river, waterfall, path };

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
