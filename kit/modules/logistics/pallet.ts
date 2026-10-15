import { buildByRole, place, roundedBox, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num, pick } from './common';

/** 팔레트: 나무판 + 적재물(boxes 종이상자 | crates 파란 상자 | none) */
export const pallet = defineElement({
  type: 'pallet',
  create(ctx, params) {
    const cargo = pick('pallet', 'cargo', params.cargo, ['boxes', 'crates', 'none'] as const, 'boxes');
    const rows = Math.max(1, Math.round(num(params.rows, 2)));
    const cols = Math.max(1, Math.round(num(params.cols, 2)));
    const layers = Math.max(1, Math.round(num(params.layers, 2)));
    const parts: Part[] = [{ role: 'wood', geo: roundedBox(1.2, 0.15, 1.0, 0.03) }];
    if (cargo !== 'none') {
      const cw = 1.2 / cols;
      const cd = 1.0 / rows;
      const ch = cargo === 'crates' ? 0.5 : 0.42;
      for (let l = 0; l < layers; l++) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = -0.6 + cw * (c + 0.5);
            const z = -0.5 + cd * (r + 0.5);
            parts.push({
              role: cargo === 'crates' ? 'body' : 'cargo',
              geo: place(roundedBox(cw * 0.92, ch * 0.96, cd * 0.92, cargo === 'crates' ? 0.08 : 0.05), x, 0.15 + l * ch, z),
            });
          }
        }
      }
    }
    const built = buildByRole(ctx.style, parts);
    return { object3d: built.group, dispose: built.dispose };
  },
});
