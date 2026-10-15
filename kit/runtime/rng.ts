/** 결정적 난수와 노이즈. kit 안에서 Math.random 사용 금지. */
export type Rng = () => number;

/** FNV-1a 32bit */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 기능별 하위 스트림: 새 salt를 추가해도 기존 salt의 출력은 변하지 않는다. */
export function deriveSeed(seed: number, salt: string): number {
  return (Math.imul(seed >>> 0, 0x9e3779b1) ^ hashString(salt)) >>> 0;
}

export function rngFor(seed: number, salt: string): Rng {
  return mulberry32(deriveSeed(seed, salt));
}

/** 2D simplex noise. rng로 순열을 섞으므로 seed마다 다른 지형. 반환 범위 약 [-1, 1]. */
export function createNoise2D(rng: Rng): (x: number, y: number) => number {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const corner = (x: number, y: number, gi: number) => {
    let t = 0.5 - x * x - y * y;
    if (t < 0) return 0;
    t *= t;
    const g = grad[gi & 7];
    return t * t * (g[0] * x + g[1] * y);
  };
  return (xin, yin) => {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const n =
      corner(x0, y0, perm[ii + perm[jj]]) +
      corner(x1, y1, perm[ii + i1 + perm[jj + j1]]) +
      corner(x2, y2, perm[ii + 1 + perm[jj + 1]]);
    return 70 * n;
  };
}
