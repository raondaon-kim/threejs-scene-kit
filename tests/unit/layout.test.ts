import { describe, it, expect } from 'vitest';
import { distToPolyline, scatter } from '../../kit/layout';

describe('scatter', () => {
  const base = { type: 'fairytree', count: 40, center: [5, -3] as [number, number], radius: 12, seed: 3 };
  it('결정적: 같은 옵션 = 같은 결과, 다른 seed = 다른 결과', () => {
    expect(scatter(base)).toEqual(scatter(base));
    expect(scatter(base)).not.toEqual(scatter({ ...base, seed: 4 }));
  });
  it('개수 이하, 원 안, id 접두사, variant: i, 회전', () => {
    const r = scatter({ ...base, idPrefix: 'tr' });
    expect(r.length).toBeGreaterThan(30);
    expect(r.length).toBeLessThanOrEqual(40);
    r.forEach((e, i) => {
      expect(e.id).toBe(`tr-${i}`);
      expect(e.type).toBe('fairytree');
      expect(Math.hypot(e.at![0] - 5, e.at![2] + 3)).toBeLessThanOrEqual(12 + 1e-9);
      expect((e.params as { variant: number }).variant).toBe(i);
      expect(e.rotation![1]).toBeGreaterThanOrEqual(0);
    });
  });
  it('minDist 지켜짐', () => {
    const r = scatter({ ...base, count: 80, minDist: 2.5 });
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
      expect(Math.hypot(r[i].at![0] - r[j].at![0], r[i].at![2] - r[j].at![2])).toBeGreaterThanOrEqual(2.5);
    }
  });
  it('avoid 선에서 avoidWidth/2 이상 떨어짐', () => {
    const line: Array<[number, number]> = [[-10, -3], [20, -3]];
    const r = scatter({ ...base, count: 60, avoid: [line], avoidWidth: 4 });
    for (const e of r) expect(distToPolyline([e.at![0], e.at![2]], line)).toBeGreaterThanOrEqual(2);
  });
  it('params: 객체 병합 또는 함수(i, rnd), 명시한 variant 우선, y 높이', () => {
    const a = scatter({ ...base, count: 3, params: { height: 4 }, y: 6 });
    expect(a[0].params).toMatchObject({ height: 4, variant: 0 });
    expect(a[0].at![1]).toBe(6);
    const b = scatter({ ...base, count: 3, params: (i) => ({ kind: i % 2 ? 'conifer' : 'puffy', variant: 100 + i }) });
    expect(b[1].params).toMatchObject({ kind: 'conifer', variant: 101 });
  });
  it('잘못된 옵션 오류', () => {
    expect(() => scatter({ ...base, count: -1 })).toThrow(/count/);
    expect(() => scatter({ ...base, radius: 0 })).toThrow(/radius/);
    expect(() => scatter({ ...base, type: '' })).toThrow(/type/);
  });
});

describe('distToPolyline', () => {
  it('선분까지 거리', () => {
    expect(distToPolyline([5, 3], [[0, 0], [10, 0]])).toBeCloseTo(3);
    expect(distToPolyline([-4, 3], [[0, 0], [10, 0]])).toBeCloseTo(5);
    expect(distToPolyline([1, 1], [[1, 1]])).toBeCloseTo(0);
  });
});
