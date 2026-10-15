import { describe, it, expect } from 'vitest';
import { mulberry32, hashString, deriveSeed, rngFor, createNoise2D } from '../../kit/runtime/rng';

describe('rng', () => {
  it('같은 seed는 같은 수열', () => {
    const a = mulberry32(42), b = mulberry32(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
  it('다른 salt는 다른 스트림', () => {
    expect(rngFor(1, 'trees')()).not.toBe(rngFor(1, 'terrain')());
    expect(deriveSeed(1, 'a')).toBe(deriveSeed(1, 'a'));
  });
  it('hashString은 FNV-1a 32bit', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('a')).toBe(0xe40c292c);
  });
  it('noise는 결정적이고 [-1,1] 근처 범위', () => {
    const n1 = createNoise2D(mulberry32(7)), n2 = createNoise2D(mulberry32(7));
    for (let i = 0; i < 50; i++) {
      const v = n1(i * 0.37, i * 0.11);
      expect(v).toBe(n2(i * 0.37, i * 0.11));
      expect(Math.abs(v)).toBeLessThanOrEqual(1.01);
    }
  });
});
