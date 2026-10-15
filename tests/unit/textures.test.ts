import { describe, it, expect } from 'vitest';
import { BUILTIN_TEXTURES } from '../../kit/textures/names';
import { BUILTIN_TEXTURE_DEFS, defineTexture } from '../../kit/textures';
import { tileNoise } from '../../kit/textures/draw-utils';

describe('textures', () => {
  it('내장 7종 이름 = 정의 목록, tile 양수, 이름 규칙', () => {
    expect([...BUILTIN_TEXTURES].sort()).toEqual(['grass-brush', 'paper', 'rock-grain', 'roof-tiles', 'soil-pebbles', 'water-ripple', 'wood-grain']);
    expect(BUILTIN_TEXTURE_DEFS.map((d) => d.name).sort()).toEqual([...BUILTIN_TEXTURES].sort());
    for (const d of BUILTIN_TEXTURE_DEFS) {
      expect(d.tile).toBeGreaterThan(0);
      expect(d.name).toMatch(/^[a-z0-9-]+$/);
      expect(typeof d.draw).toBe('function');
    }
  });
  it('defineTexture 검사', () => {
    expect(() => defineTexture({ name: 'Bad Name', tile: 1, draw() {} })).toThrow(/name/);
    expect(() => defineTexture({ name: 'ok', tile: 0, draw() {} })).toThrow(/tile/);
    expect(() => defineTexture({ name: 'ok', tile: 1 } as never)).toThrow(/draw/);
    expect(defineTexture({ name: 'ok-2', tile: 2, draw() {} }).name).toBe('ok-2');
  });
});

describe('tileNoise (최종 리뷰 I-1: 거울 대칭·오프셋 이음선)', () => {
  // p5 noise처럼 음수 좌표를 절댓값으로 바꾸는 가짜 노이즈
  const p = {
    noise(a: number, b: number) {
      a = Math.abs(a);
      b = Math.abs(b);
      return 0.5 + 0.25 * Math.sin(a * 1.7 + 0.3) * Math.cos(b * 1.1 + 0.2) + 0.2 * Math.sin(a * 0.37 + b * 0.61);
    },
  } as never;
  const size = 64;
  it.each([[0, 0], [211, 5], [97, 31]])('오프셋 (%s, %s): 가장자리가 이어짐 f(0,y) = f(size,y), f(x,0) = f(x,size)', (ox, oy) => {
    for (const k of [0, 7, 33, 63]) {
      expect(tileNoise(p, 0, k, size, 4, ox, oy)).toBeCloseTo(tileNoise(p, size, k, size, 4, ox, oy), 9);
      expect(tileNoise(p, k, 0, size, 4, ox, oy)).toBeCloseTo(tileNoise(p, k, size, size, 4, ox, oy), 9);
    }
  });
  it('거울 대칭이 아님: f(x,y) ≠ f(size−x,y)', () => {
    let maxDiff = 0;
    for (const x of [5, 13, 21]) for (const y of [3, 30]) maxDiff = Math.max(maxDiff, Math.abs(tileNoise(p, x, y, size, 4) - tileNoise(p, size - x, y, size, 4)));
    expect(maxDiff).toBeGreaterThan(1e-3);
  });
});
