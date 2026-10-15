import { buildByRole, place, roundedBox, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { role } from '../concept/params';
import { num } from './common';

/** 포장된 마당/주차장: 낮은 판(role, 기본 road) + 주차선(stalls) */
export const lot = defineElement({
  type: 'lot',
  create(ctx, params) {
    const w = num(params.width, 20);
    const d = num(params.depth, 12);
    const stalls = Math.max(0, Math.round(num(params.stalls, 0)));
    const parts: Part[] = [{ role: role(params.role, 'road'), geo: roundedBox(w, 0.06, d, 0.03) }];
    for (let i = 0; i <= stalls && stalls > 0; i++) {
      const x = -w * 0.45 + (i * w * 0.9) / stalls;
      parts.push({ role: 'trim', geo: place(roundedBox(0.12, 0.02, d * 0.35, 0.01), x, 0.06, -d * 0.28) });
    }
    const built = buildByRole(ctx.style, parts);
    return { object3d: built.group, dispose: built.dispose };
  },
});
