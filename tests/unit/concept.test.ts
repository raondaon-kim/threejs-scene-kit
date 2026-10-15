import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getStyle } from '../../kit/styles';
import { shape } from '../../kit/modules/concept/shape';
import { arrow } from '../../kit/modules/concept/arrow';
import { bars } from '../../kit/modules/concept/bars';
import { line } from '../../kit/modules/concept/line';
import { elementRegistry, typeInfo } from '../../kit/runtime/registry';
import { defineElement } from '../../kit/runtime/element';
import type { KitContext } from '../../kit/runtime/types';

const ctx: KitContext = {
  style: getStyle('minimal'),
  rng: () => () => 0.5,
  heightAt: () => 0,
  quality: 'preview',
  camera: new THREE.PerspectiveCamera(),
};

describe('concept elements', () => {
  it('shape: 종류별 생성, 잘못된 kind는 오류', () => {
    for (const kind of ['box', 'sphere', 'cylinder', 'cone', 'torus']) {
      const h = shape.create(ctx, { kind, size: 2 });
      expect((h.object3d as THREE.Mesh).geometry).toBeDefined();
      h.dispose();
    }
    expect(() => shape.create(ctx, { kind: 'star' })).toThrow(/box\|sphere/);
  });
  it('arrow: progress에 따라 길이', () => {
    const h = arrow.create(ctx, { to: [0, 4, 0] });
    const [body, head] = h.object3d.children as THREE.Mesh[];
    h.setProgress!(0.5);
    expect(head.position.y).toBeCloseTo(2);
    h.setProgress!(0);
    expect(body.visible).toBe(false);
    expect(head.visible).toBe(false);
    expect(() => arrow.create(ctx, { to: [0, 0, 0] })).toThrow();
    h.dispose();
  });
  it('bars: 값 비례 높이, 순차 성장', () => {
    const h = bars.create(ctx, { values: [1, 2, 4], maxHeight: 4 });
    const bs = h.object3d.children as THREE.Mesh[];
    expect(bs[2].scale.y).toBeCloseTo(4);
    expect(bs[0].scale.y).toBeCloseTo(1);
    h.setProgress!(0.3);
    expect(bs[0].scale.y).toBeGreaterThan(bs[2].scale.y);
    expect(() => bars.create(ctx, { values: [] })).toThrow();
    expect(() => bars.create(ctx, { values: [1, 2], labels: ['a'] })).toThrow();
    h.dispose();
  });
  it('line: drawRange가 progress를 따름', () => {
    const h = line.create(ctx, { points: [[0, 0, 0], [1, 1, 0], [2, 0, 0]] });
    const geo = (h.object3d as THREE.Mesh).geometry;
    h.setProgress!(1);
    const full = geo.drawRange.count;
    h.setProgress!(0.5);
    expect(geo.drawRange.count).toBeLessThan(full);
    expect(geo.drawRange.count).toBeGreaterThan(0);
    expect(() => line.create(ctx, { points: [[0, 0, 0]] })).toThrow();
    h.dispose();
  });
});

describe('registry', () => {
  it('내장 요소와 grow 지원 정보', () => {
    const info = typeInfo(elementRegistry());
    expect([...info.keys()].sort()).toEqual(['arrow', 'bars', 'bridge', 'building', 'castle', 'cloud', 'container', 'cottage', 'fairytree', 'fence', 'field', 'flowers', 'forklift', 'grass', 'island', 'label', 'line', 'lot', 'mushroom', 'pallet', 'path', 'pin', 'plateau', 'river', 'road', 'rock', 'shape', 'tree', 'truck', 'warehouse', 'waterfall', 'windmill']);
    expect(info.get('arrow')!.supportsGrow).toBe(true);
    expect(info.get('shape')!.supportsGrow).toBe(false);
  });
  it('커스텀 요소 추가와 이름 충돌 (Review Focus 3)', () => {
    const custom = defineElement({ type: 'spiral', supportsGrow: true, create: () => ({ object3d: new THREE.Group(), dispose() {} }) });
    expect(elementRegistry([custom]).has('spiral')).toBe(true);
    const clash = defineElement({ type: 'shape', create: () => ({ object3d: new THREE.Group(), dispose() {} }) });
    expect(() => elementRegistry([clash])).toThrow(/겹침/);
  });
});
