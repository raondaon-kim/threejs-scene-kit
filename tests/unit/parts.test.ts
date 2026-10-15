import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { roundedBox, place, buildByRole, wheelGeo, blob, prism, arch, ribbon, shade } from '../../kit/parts';
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
  it('v0.4: shade — 높이 비율로 위·아래 배율, 범위 지정', () => {
    const g = shade(roundedBox(1, 2, 1, 0.1), { top: 1.2, bottom: [0.5, 0.6, 0.7] });
    const c = g.attributes.color;
    const p = g.attributes.position;
    let lo = -1;
    let hi = -1;
    for (let i = 0; i < p.count; i++) {
      if (lo < 0 || p.getY(i) < p.getY(lo)) lo = i;
      if (hi < 0 || p.getY(i) > p.getY(hi)) hi = i;
    }
    expect([c.getX(lo), c.getY(lo), c.getZ(lo)].map((v) => +v.toFixed(3))).toEqual([0.5, 0.6, 0.7]);
    expect(c.getX(hi)).toBeCloseTo(1.2, 3);
    const r = shade(roundedBox(1, 1, 1, 0.1), { top: 1, bottom: 0, y0: 0, y1: 2 });
    let max = 0;
    for (let i = 0; i < r.attributes.color.count; i++) max = Math.max(max, r.attributes.color.getX(i));
    expect(max).toBeCloseTo(0.5, 3);
  });
  it('v0.4: 색 있는 부품 + 없는 부품 같은 role 병합 (Review Focus 4), keepColor 재질', () => {
    const style = getStyle('clay');
    const built = buildByRole(style, [
      { role: 'body', geo: shade(roundedBox(1, 1, 1), { top: 1, bottom: 0.5 }) },
      { role: 'body', geo: place(roundedBox(1, 1, 1), 3, 0, 0) },
    ]);
    const mesh = built.group.getObjectByName('body') as THREE.Mesh;
    const col = mesh.geometry.attributes.color;
    expect(col).toBeTruthy();
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) if (pos.getX(i) > 2) expect([col.getX(i), col.getY(i), col.getZ(i)]).toEqual([1, 1, 1]);
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat.vertexColors).toBe(true);
    expect('#' + mat.color.getHexString()).toBe(style.palette.body.toLowerCase());
    built.dispose();
  });
  it('v0.4: 4 스타일 모두 keepColor면 팔레트 색 유지, 아니면 흰색', () => {
    for (const n of ['stylized', 'minimal', 'clay', 'pastel'] as const) {
      const s = getStyle(n);
      const k = s.material('foliage', { vertexColors: true, keepColor: true }) as THREE.MeshStandardMaterial;
      expect('#' + k.color.getHexString(), n).toBe(s.palette.foliage.toLowerCase());
      const w = s.material('foliage', { vertexColors: true }) as THREE.MeshStandardMaterial;
      expect(w.color.getHexString(), n).toBe('ffffff');
    }
  });
});

