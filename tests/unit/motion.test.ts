import { describe, it, expect } from 'vitest';
import { followState } from '../../kit/runtime/motion';

describe('followState', () => {
  const f = { path: [[0, 0], [10, 0]] as Array<[number, number]>, t0: 2, t1: 4, ease: 'linear' as const };
  it('구간 전후 clamp, 중간 보간, 방향(+X 진행이면 yaw=π/2)', () => {
    expect(followState(f, 0)).toMatchObject({ x: 0, z: 0, travel: 0 });
    const m = followState(f, 3);
    expect(m.x).toBeCloseTo(5);
    expect(m.travel).toBeCloseTo(5);
    expect(m.yaw).toBeCloseTo(Math.PI / 2);
    expect(followState(f, 9).x).toBeCloseTo(10);
  });
  it('중복 점·짧은 경로에서 NaN 없음 (Review Focus 3)', () => {
    const s = followState({ path: [[1, 1], [1, 1], [1, 1]], t0: 0, t1: 1 }, 0.5);
    expect(Number.isFinite(s.x) && Number.isFinite(s.z) && Number.isFinite(s.yaw) && Number.isFinite(s.travel)).toBe(true);
  });
  it('결정적', () => {
    const g = { path: [[0, 0], [5, 5], [10, 0]] as Array<[number, number]>, t0: 0, t1: 3 };
    expect(followState(g, 1.3)).toEqual(followState(g, 1.3));
  });
});
