import type p5 from 'p5';

/** 가장자리를 넘는 획이 반대편에서 이어지도록 9곳(±size)에 그린다 */
export function wrap(size: number, fn: (dx: number, dy: number) => void): void {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) fn(dx, dy);
}

/**
 * 반복되는 노이즈: 네 귀퉁이 샘플을 가중 평균해 가장자리가 이어지게 한다. 반환 0~1.
 * freq: 한 장 안의 노이즈 주기 수 (클수록 잘다). ox·oy: 다른 무늬가 필요할 때 노이즈 도메인 이동(이음매 유지).
 * p5 noise는 음수 좌표를 절댓값으로 바꿔 거울 대칭을 만들므로, 도메인을 항상 양수 쪽으로 옮겨 샘플한다.
 */
export function tileNoise(p: p5, x: number, y: number, size: number, freq: number, ox = 0, oy = 0): number {
  const s = freq / size;
  const u = x / size;
  const v = y / size;
  const n = (a: number, b: number) => p.noise((a + 2 * size + ox) * s, (b + 2 * size + oy) * s);
  return n(x, y) * (1 - u) * (1 - v) + n(x - size, y) * u * (1 - v) + n(x, y - size) * (1 - u) * v + n(x - size, y - size) * u * v;
}

/** 픽셀마다 회색값을 채운다 (0~255) */
export function fillPixels(p: p5, size: number, f: (x: number, y: number) => number): void {
  p.loadPixels();
  const px = p.pixels;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const g = Math.max(0, Math.min(255, f(x, y)));
      const i = 4 * (y * size + x);
      px[i] = g;
      px[i + 1] = g;
      px[i + 2] = g;
      px[i + 3] = 255;
    }
  }
  p.updatePixels();
}
