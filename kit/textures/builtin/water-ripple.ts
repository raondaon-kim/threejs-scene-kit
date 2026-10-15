import { defineTexture } from '../types';
import { fillPixels, tileNoise, wrap } from '../draw-utils';

/** 물결: 부드러운 명암 + 밝은 잔물결 선과 어두운 골 */
export const waterRipple = defineTexture({
  name: 'water-ripple',
  tile: 5,
  draw(p, { size }) {
    fillPixels(p, size, (x, y) => 128 + (tileNoise(p, x, y, size, 4) - 0.5) * 40);
    p.noFill();
    p.strokeCap(p.ROUND);
    const n = Math.round((size * size) / 2600);
    for (let i = 0; i < n; i++) {
      const x = p.random(size);
      const y = p.random(size);
      const w = p.random(size * 0.03, size * 0.09);
      const light = p.random() < 0.65;
      p.stroke(light ? p.random(175, 215) : p.random(85, 105), light ? 190 : 120);
      p.strokeWeight(p.random(size * 0.003, size * 0.006));
      wrap(size, (dx, dy) => p.arc(x + dx, y + dy, w, w * 0.35, Math.PI * 1.1, Math.PI * 1.9));
    }
  },
});
