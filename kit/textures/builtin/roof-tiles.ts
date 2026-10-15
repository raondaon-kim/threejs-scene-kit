import { defineTexture } from '../types';
import { fillPixels, tileNoise } from '../draw-utils';

/** 기와: 엇갈린 줄의 둥근 기와(위 밝고 아래 가장자리 어둡게). 줄·칸 수가 크기를 나눠 이어짐 */
export const roofTiles = defineTexture({
  name: 'roof-tiles',
  tile: 1.2,
  draw(p, { size }) {
    const rows = 8;
    const cols = 8;
    const h = size / rows;
    const w = size / cols;
    fillPixels(p, size, (x, y) => {
      const r = Math.floor(y / h);
      const off = r % 2 ? w / 2 : 0;
      const u = (((x + off) % w) + w) % w / w;
      const v = (y % h) / h;
      const arch = 1 - Math.pow(Math.abs(u - 0.5) * 2, 3) * 0.6;
      const shade = 150 - v * 55 * arch;
      const edge = v > 0.9 ? -45 : 0;
      const seam = u < 0.04 || u > 0.96 ? -30 : 0;
      return shade + edge + seam + (tileNoise(p, x, y, size, 14) - 0.5) * 26;
    });
    void p;
  },
});
