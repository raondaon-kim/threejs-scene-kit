import type { Rng } from '../../runtime/rng';

/** Bridson Poisson-disk 샘플링, 영역 [-half, half]^2. rng 소비 순서가 고정되어 결정적. */
export function poissonDisk(rng: Rng, half: number, radius: number, maxPoints: number, k = 20): Array<[number, number]> {
  const cell = radius / Math.SQRT2;
  const gw = Math.max(1, Math.ceil((2 * half) / cell));
  const grid = new Int32Array(gw * gw).fill(-1);
  const pts: Array<[number, number]> = [];
  const active: number[] = [];
  const cellOf = (x: number, z: number): [number, number] => [
    Math.min(gw - 1, Math.max(0, Math.floor((x + half) / cell))),
    Math.min(gw - 1, Math.max(0, Math.floor((z + half) / cell))),
  ];
  const add = (x: number, z: number) => {
    pts.push([x, z]);
    const [cx, cz] = cellOf(x, z);
    grid[cz * gw + cx] = pts.length - 1;
    active.push(pts.length - 1);
  };
  if (maxPoints <= 0) return pts;
  add((rng() * 2 - 1) * half, (rng() * 2 - 1) * half);
  while (active.length > 0 && pts.length < maxPoints) {
    const ai = Math.floor(rng() * active.length);
    const [px, pz] = pts[active[ai]];
    let found = false;
    for (let n = 0; n < k; n++) {
      const a = rng() * Math.PI * 2;
      const r = radius * (1 + rng());
      const x = px + Math.cos(a) * r;
      const z = pz + Math.sin(a) * r;
      if (x < -half || x > half || z < -half || z > half) continue;
      const [cx, cz] = cellOf(x, z);
      let ok = true;
      for (let dz = -2; dz <= 2 && ok; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          const gx = cx + dx;
          const gz = cz + dz;
          if (gx < 0 || gz < 0 || gx >= gw || gz >= gw) continue;
          const j = grid[gz * gw + gx];
          if (j < 0) continue;
          const [qx, qz] = pts[j];
          if ((qx - x) ** 2 + (qz - z) ** 2 < radius * radius) {
            ok = false;
            break;
          }
        }
      }
      if (ok) {
        add(x, z);
        found = true;
        if (pts.length >= maxPoints) break;
      }
    }
    if (!found) active.splice(ai, 1);
  }
  return pts;
}
