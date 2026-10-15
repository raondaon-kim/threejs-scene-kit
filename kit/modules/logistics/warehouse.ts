import { buildByRole, cyl, place, roundedBox, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num } from './common';
import { dockPositions } from './layout';

export { dockPositions };

/** 창고: 둥근 박스 몸체, 세로 패널 리브(ribs), 앞면(+Z) 도크, 지붕 스카이라이트·설비 */
export const warehouse = defineElement({
  type: 'warehouse',
  create(ctx, params) {
    const w = num(params.width, 24);
    const d = num(params.depth, 14);
    const h = num(params.height, 7);
    const docks = Math.max(0, Math.round(num(params.docks, 4)));
    const skylights = Math.max(0, Math.round(num(params.skylights, 3)));
    const parts: Part[] = [{ role: 'body', geo: roundedBox(w, h, d, 0.8) }];
    if (params.ribs !== false) {
      for (let x = -w / 2 + 1.2; x <= w / 2 - 1.2; x += 1.5) parts.push({ role: 'body', geo: place(roundedBox(0.14, h - 0.9, 0.12, 0.04), x, 0.2, d / 2 + 0.02) });
      for (let z = -d / 2 + 1.2; z <= d / 2 - 1.2; z += 1.5) parts.push({ role: 'body', geo: place(roundedBox(0.12, h - 0.9, 0.14, 0.04), w / 2 + 0.02, 0.2, z) });
    }
    for (let i = 0; i < skylights; i++) {
      const x = -w * 0.32 + (skylights === 1 ? w * 0.32 : (i * w * 0.64) / (skylights - 1));
      parts.push({ role: 'trim', geo: place(roundedBox(w * 0.12, 0.35, d * 0.3, 0.12), x, h, -d * 0.05) });
    }
    parts.push({ role: 'trim', geo: place(roundedBox(1.4, 0.9, 1.2, 0.15), w * 0.38, h, -d * 0.3) });
    parts.push({ role: 'trim', geo: place(roundedBox(1.4, 0.9, 1.2, 0.15), w * 0.38 - 1.8, h, -d * 0.3) });
    for (const x of dockPositions(w, docks)) {
      parts.push({ role: 'dark', geo: place(roundedBox(3.4, 3.7, 0.3, 0.08), x, 0, d / 2) });
      parts.push({ role: 'trim', geo: place(roundedBox(2.8, 3.2, 0.22, 0.05), x, 0, d / 2 + 0.06) });
      parts.push({ role: 'trim', geo: place(roundedBox(1, 0.15, 0.18, 0.04), x, 4.1, d / 2 + 0.05) });
      for (const s of [-1, 1]) parts.push({ role: 'accent', geo: place(cyl(0.1, 0.1, 1, 12), x + s * 1.9, 0, d / 2 + 0.8) });
    }
    parts.push({ role: 'dark', geo: place(roundedBox(0.15, 0.9, d * 0.7, 0.05), -w / 2 - 0.02, h * 0.62 - 0.45, 0) });
    parts.push({ role: 'trim', geo: place(roundedBox(1, 2.1, 0.15, 0.04), -w * 0.44, 0, d / 2 + 0.05) });
    const built = buildByRole(ctx.style, parts);
    return { object3d: built.group, dispose: built.dispose };
  },
});
