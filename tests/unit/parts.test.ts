import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { roundedBox, place, buildByRole, wheelGeo } from '../../kit/parts';
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
});
