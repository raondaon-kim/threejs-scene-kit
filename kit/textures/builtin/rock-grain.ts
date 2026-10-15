import { defineTexture } from '../types';
import { fillPixels, tileNoise, wrap } from '../draw-utils';

/** 바위 결: 굵은 얼룩 + 잔결 + 가는 금 */
export const rockGrain = defineTexture({
  name: 'rock-grain',
  tile: 3,
  draw(p, { size }) {
    p.noiseDetail(4, 0.5);
    fillPixels(p, size, (x, y) => 128 + (tileNoise(p, x, y, size, 4) - 0.5) * 90 + (tileNoise(p, x, y, size, 24, 97, 31) - 0.5) * 50);
    p.noFill();
    for (let i = 0; i < 26; i++) {
      let x = p.random(size);
      let y = p.random(size);
      let a = p.random(Math.PI * 2);
      p.stroke(p.random(60, 95), 150);
      p.strokeWeight(p.random(1, 2.2));
      const steps = Math.round(p.random(6, 16));
      for (let k = 0; k < steps; k++) {
        const len = p.random(size * 0.01, size * 0.025);
        a += p.random(-0.6, 0.6);
        const nx = x + Math.cos(a) * len;
        const ny = y + Math.sin(a) * len;
        const [x0, y0] = [x, y];
        wrap(size, (dx, dy) => p.line(x0 + dx, y0 + dy, nx + dx, ny + dy));
        x = nx;
        y = ny;
      }
    }
  },
});
