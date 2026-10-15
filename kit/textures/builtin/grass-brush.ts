import { defineTexture } from '../types';
import { fillPixels, tileNoise, wrap } from '../draw-utils';

/** 잔디 붓터치: 부드러운 얼룩 위에 짧은 풀잎 획 */
export const grassBrush = defineTexture({
  name: 'grass-brush',
  tile: 4,
  draw(p, { size }) {
    fillPixels(p, size, (x, y) => 128 + (tileNoise(p, x, y, size, 5) - 0.5) * 60);
    p.strokeCap(p.ROUND);
    const n = Math.round((size * size) / 190);
    for (let i = 0; i < n; i++) {
      const x = p.random(size);
      const y = p.random(size);
      const len = p.random(size * 0.012, size * 0.03);
      const a = -Math.PI / 2 + p.random(-0.7, 0.7);
      const g = p.random() < 0.5 ? p.random(150, 190) : p.random(70, 110);
      p.stroke(g, p.random(90, 170));
      p.strokeWeight(p.random(size * 0.003, size * 0.006));
      wrap(size, (dx, dy) => p.line(x + dx, y + dy, x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len));
    }
  },
});
