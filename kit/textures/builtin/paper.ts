import { defineTexture } from '../types';
import { fillPixels, tileNoise } from '../draw-utils';

/** 종이·회벽: 아주 옅은 얼룩과 잔결 (벽면에 손맛만 더함) */
export const paper = defineTexture({
  name: 'paper',
  tile: 6,
  draw(p, { size }) {
    fillPixels(p, size, (x, y) => 128 + (tileNoise(p, x, y, size, 3) - 0.5) * 30 + (tileNoise(p, x + 211, y + 5, size, 40) - 0.5) * 22);
  },
});
