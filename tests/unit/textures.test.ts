import { describe, it, expect } from 'vitest';
import { BUILTIN_TEXTURES } from '../../kit/textures/names';
import { BUILTIN_TEXTURE_DEFS, defineTexture } from '../../kit/textures';

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
