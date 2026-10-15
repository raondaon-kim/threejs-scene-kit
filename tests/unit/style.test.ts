import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getStyle } from '../../kit/styles';
import { createLights } from '../../kit/runtime/style';
import { SKY_PRESETS } from '../../kit/runtime/types';

describe('styles', () => {
  for (const name of ['stylized', 'minimal'] as const) {
    it(`${name}: 모든 하늘 프리셋과 역할 재질`, () => {
      const s = getStyle(name);
      expect(s.name).toBe(name);
      for (const p of SKY_PRESETS) {
        const c = s.sky(p);
        expect(c.top).toMatch(/^#[0-9a-f]{6}$/i);
        expect(c.sunDir).toHaveLength(3);
      }
      const a = s.material('accent');
      const b = s.material('accent');
      expect(a).not.toBe(b);
      expect(a).toBeInstanceOf(THREE.Material);
      const w = s.material('water', { transparent: true, opacity: 0.8 });
      expect(w.transparent).toBe(true);
      expect(w.opacity).toBeCloseTo(0.8);
      a.dispose();
      b.dispose();
      w.dispose();
    });
  }
  it('stylized는 툰, minimal은 standard', () => {
    expect(getStyle('stylized').material('ground')).toBeInstanceOf(THREE.MeshToonMaterial);
    expect(getStyle('minimal').material('ground')).toBeInstanceOf(THREE.MeshStandardMaterial);
  });
  it('조명 리그: 반구광 + 방향광', () => {
    const s = getStyle('stylized');
    const lights = createLights(s.sky('day'), s);
    expect(lights.some((l) => l instanceof THREE.HemisphereLight)).toBe(true);
    expect(lights.some((l) => l instanceof THREE.DirectionalLight)).toBe(true);
  });
});
