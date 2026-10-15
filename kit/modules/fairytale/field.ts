import { buildByRole, roundedBox, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num } from './common';

/** 밀밭: 흙 바닥 위에 노란 덩어리 줄(X 방향). width 6, depth 4, rows 5 */
export const field = defineElement({
  type: 'field',
  create(ctx, params) {
    const w = Math.max(1, num(params.width, 6));
    const d = Math.max(1, num(params.depth, 4));
    const rows = Math.max(1, Math.min(40, Math.round(num(params.rows, 5))));
    const parts: Part[] = [{ role: 'road', geo: roundedBox(w, 0.1, d, 0.04) }];
    const step = d / rows;
    const n = Math.max(1, Math.floor(w / 0.55));
    for (let r = 0; r < rows; r++) {
      const z = -d / 2 + step * (r + 0.5);
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + (w / n) * (i + 0.5);
        const g = roundedBox(0.5, 0.5 + ((i + r) % 3) * 0.06, Math.min(0.5, step * 0.8), 0.18);
        g.translate(x, 0.08, z);
        parts.push({ role: 'cargo', geo: g });
      }
    }
    const built = buildByRole(ctx.style, parts);
    return { object3d: built.group, dispose: built.dispose };
  },
});
