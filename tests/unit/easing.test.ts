import { describe, it, expect } from 'vitest';
import { ease, clamp01, easeOutBack, smoothstep, lerp3 } from '../../kit/runtime/easing';

describe('easing', () => {
  it('끝점 보존', () => {
    for (const n of ['linear', 'in', 'out', 'inOut'] as const) {
      expect(ease(n, 0)).toBeCloseTo(0);
      expect(ease(n, 1)).toBeCloseTo(1);
    }
    expect(easeOutBack(1)).toBeCloseTo(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5);
  });
  it('범위 밖 입력은 clamp', () => {
    expect(clamp01(-2)).toBe(0);
    expect(ease('inOut', 5)).toBe(1);
  });
  it('lerp3', () => {
    expect(lerp3([0, 0, 0], [2, 4, 6], 0.5)).toEqual([1, 2, 3]);
  });
});
