import { buildByRole, cyl, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num, outline, rockRing, seeded, slab } from './common';

/** 높은 단: 잔디 윗면(y = height) + 바위 절벽 둘레. radius 9, height 5, variant 0 */
export const plateau = defineElement({
  type: 'plateau',
  create(ctx, params) {
    const r = Math.max(2, num(params.radius, 9));
    const h = Math.max(1, num(params.height, 5));
    const rng = seeded(ctx, 'plateau', params);
    const parts: Part[] = [{ role: 'ground', geo: slab(outline(r, rng, 0.06), 0.4, h, 0.3) }];
    const core = cyl(r * 0.93, r * 0.98, h - 0.5, 40);
    parts.push({ role: 'rock', geo: core });
    const size = Math.min(2.4, Math.max(1.2, h / 2.2));
    const rows = Math.max(1, Math.ceil((h - 0.4) / (size * 0.8)));
    for (let i = 0; i < rows; i++) {
      const y = Math.min(h - 0.25 - size * 1.45, i * size * 0.8);
      // rockRing의 세로 흔들림(±0.1·size)만큼 띄워 바닥 아래로 내려가지 않게
      rockRing(parts, rng, r * (0.98 - i * 0.015), Math.max(0, y) + size * 0.11, size);
    }
    const built = buildByRole(ctx.style, parts);
    return { object3d: built.group, dispose: built.dispose };
  },
});
