import { smoothstep } from '../../runtime/easing';
import { createNoise2D, rngFor } from '../../runtime/rng';

export interface TerrainParams {
  size: number;
  height: number;
  roughness: number;
  /** 이 반경 안은 높이 0 (개념 시각화 무대) */
  flatRadius: number;
}

export const TERRAIN_DEFAULTS: TerrainParams = { size: 200, height: 10, roughness: 0.5, flatRadius: 15 };

export function createHeightField(seed: number, p: TerrainParams): { heightAt(x: number, z: number): number } {
  const noise = createNoise2D(rngFor(seed, 'terrain'));
  const base = 2.2 / p.size;
  const gain = 0.35 + 0.4 * p.roughness;
  return {
    heightAt(x: number, z: number): number {
      let amp = 1;
      let freq = base;
      let sum = 0;
      let norm = 0;
      for (let o = 0; o < 5; o++) {
        sum += amp * noise(x * freq, z * freq);
        norm += amp;
        amp *= gain;
        freq *= 2;
      }
      const h = (sum / norm) * p.height;
      if (p.flatRadius <= 0) return h;
      const f = smoothstep((Math.hypot(x, z) - p.flatRadius) / (p.flatRadius * 1.5));
      return h * f;
    },
  };
}
