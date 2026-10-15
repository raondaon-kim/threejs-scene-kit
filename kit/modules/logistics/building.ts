import { buildByRole, place, roundedBox, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num } from './common';

/** 사무 건물: 몸체 + 층별 창 띠(+Z, +X 면) + 지붕 캡 */
export const building = defineElement({
  type: 'building',
  create(ctx, params) {
    const w = num(params.width, 10);
    const d = num(params.depth, 10);
    const floors = Math.max(1, Math.round(num(params.floors, 4)));
    const H = floors * 3.2;
    const parts: Part[] = [{ role: 'bodyLight', geo: roundedBox(w, H, d, 0.4) }];
    for (let i = 0; i < floors; i++) {
      const y = i * 3.2 + 1.4;
      parts.push({ role: 'dark', geo: place(roundedBox(w * 0.86, 0.9, 0.1, 0.04), 0, y, d / 2) });
      parts.push({ role: 'dark', geo: place(roundedBox(0.1, 0.9, d * 0.86, 0.04), w / 2, y, 0) });
    }
    parts.push({ role: 'trim', geo: place(roundedBox(w - 0.5, 0.3, d - 0.5, 0.1), 0, H, 0) });
    const built = buildByRole(ctx.style, parts);
    return { object3d: built.group, dispose: built.dispose };
  },
});
