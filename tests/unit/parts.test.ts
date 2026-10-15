import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { roundedBox, place, buildByRole, wheelGeo, blob, prism, arch, ribbon } from '../../kit/parts';
import { rngFor } from '../../kit/runtime/rng';
import { getStyle } from '../../kit/styles';

describe('parts', () => {
  it('roundedBox 원점은 바닥 중심', () => {
    const g = roundedBox(2, 3, 4, 0.3);
    g.computeBoundingBox();
    expect(g.boundingBox!.min.y).toBeCloseTo(0);
    expect(g.boundingBox!.max.y).toBeCloseTo(3);
    expect(g.boundingBox!.max.x).toBeCloseTo(1);
  });
  it('반경이 너무 커도 안전', () => {
    expect(() => roundedBox(0.2, 0.2, 0.2, 5)).not.toThrow();
  });
  it('buildByRole: 역할당 메시 1개, 위치 반영', () => {
    const b = buildByRole(getStyle('clay'), [
      { role: 'body', geo: place(roundedBox(1, 1, 1), 5, 0, 0) },
      { role: 'body', geo: roundedBox(1, 1, 1) },
      { role: 'trim', geo: wheelGeo(0.5, 0.3) },
    ]);
    expect(b.group.children.length).toBe(2);
    const box = new THREE.Box3().setFromObject(b.group);
    expect(box.max.x).toBeCloseTo(5.5);
    b.dispose();
  });
  it('v0.3: blob 결정적·바닥 원점·NaN 없음', () => {
    const a = blob(1, rngFor(1, 'x'));
    const b = blob(1, rngFor(1, 'x'));
    const c = blob(1, rngFor(2, 'x'));
    const arr = (g: THREE.BufferGeometry) => Array.from(g.attributes.position.array as Float32Array);
    expect(arr(a)).toEqual(arr(b));
    expect(arr(a)).not.toEqual(arr(c));
    expect(arr(a).every(Number.isFinite)).toBe(true);
    a.computeBoundingBox();
    expect(a.boundingBox!.min.y).toBeCloseTo(0, 5);
  });
  it('v0.3: prism 크기, arch 아래가 비어 있음', () => {
    const p = prism(4, 2, 3);
    p.computeBoundingBox();
    const s = p.boundingBox!.getSize(new THREE.Vector3());
    expect([s.x, s.y, s.z].map((v) => +v.toFixed(3))).toEqual([4, 2, 3]);
    const a = arch(6, 2, 0.8, 2.4);
    a.computeBoundingBox();
    expect(a.boundingBox!.max.x - a.boundingBox!.min.x).toBeCloseTo(6 + 2 * 0.8, 3);
    const pos = a.attributes.position;
    let inside = 0;
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getX(i)) < 1 && pos.getY(i) > 0.05 && pos.getY(i) < 1.0) inside++;
    expect(inside).toBe(0);
  });
  it('v0.3: ribbon은 parts에서 export', () => {
    expect(typeof ribbon).toBe('function');
  });
});
