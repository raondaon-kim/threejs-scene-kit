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
  it('v0.3: 모든 스타일에 rock/roof/roofAlt, pastel 팔레트·하늘', () => {
    for (const n of ['stylized', 'minimal', 'clay', 'pastel'] as const) {
      const s = getStyle(n);
      for (const r of ['rock', 'roof', 'roofAlt'] as const) expect(s.palette[r], `${n}.${r}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
    const p = getStyle('pastel');
    expect(p.palette.ground).toBe('#9cc97a');
    expect(p.palette.roofAlt).toBe('#a98ae0');
    expect(p.look.shadows).toBe(true);
    for (const pr of SKY_PRESETS) expect(p.sky(pr).horizon).toMatch(/^#[0-9a-f]{6}$/i);
    expect(p.sky('day').horizon).toBe('#f6c9d6');
  });
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

describe('v0.2 styles', () => {
  it('clay 스타일: look과 새 역할', () => {
    const s = getStyle('clay');
    expect(s.look.ao).not.toBeNull();
    expect(s.look.toneMapping).toBe('neutral');
    for (const r of ['body', 'bodyLight', 'trim', 'dark', 'road', 'cargo', 'wood'] as const) expect(s.palette[r]).toMatch(/^#/);
    expect(getStyle('stylized').palette.body).toMatch(/^#/);
    expect(getStyle('minimal').look.toneMapping).toBe('none');
  });
});
