import { defineTexture } from '../types';
import { fillPixels, tileNoise, wrap } from '../draw-utils';

/** 나뭇결: 세로로 길게 늘인 줄무늬 + 옹이 */
export const woodGrain = defineTexture({
  name: 'wood-grain',
  tile: 1.5,
  draw(p, { size }) {
    fillPixels(p, size, (x, y) => {
      const warp = tileNoise(p, x, y, size, 3) * 18;
      const band = Math.sin(((x + warp) / size) * Math.PI * 2 * 14);
      return 128 + band * 26 + (tileNoise(p, x, y, size, 20, 51, 7) - 0.5) * 30;
    });
    p.noFill();
    for (let i = 0; i < 4; i++) {
      const x = p.random(size);
      const y = p.random(size);
      const r = p.random(size * 0.012, size * 0.03);
      p.stroke(80, 160);
      p.strokeWeight(2);
      wrap(size, (dx, dy) => {
        p.ellipse(x + dx, y + dy, r * 1.4, r * 3);
        p.ellipse(x + dx, y + dy, r * 0.6, r * 1.4);
      });
    }
  },
});
