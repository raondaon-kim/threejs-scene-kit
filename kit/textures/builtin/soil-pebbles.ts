import { defineTexture } from '../types';
import { fillPixels, tileNoise, wrap } from '../draw-utils';

/** 흙길: 얼룩진 흙 + 작은 자갈(그림자 테두리) */
export const soilPebbles = defineTexture({
  name: 'soil-pebbles',
  tile: 2.5,
  draw(p, { size }) {
    fillPixels(p, size, (x, y) => 128 + (tileNoise(p, x, y, size, 6) - 0.5) * 50 + (tileNoise(p, x, y, size, 30, 13, 71) - 0.5) * 24);
    p.noStroke();
    const n = Math.round((size * size) / 1200);
    for (let i = 0; i < n; i++) {
      const x = p.random(size);
      const y = p.random(size);
      const r = p.random(size * 0.006, size * 0.016);
      const g = p.random(120, 185);
      const rot = p.random(0.6, 1);
      wrap(size, (dx, dy) => {
        p.fill(75, 120);
        p.ellipse(x + dx + r * 0.25, y + dy + r * 0.3, r * 2.1, r * 2.1 * rot);
        p.fill(g);
        p.ellipse(x + dx, y + dy, r * 2, r * 2 * rot);
      });
    }
  },
});
