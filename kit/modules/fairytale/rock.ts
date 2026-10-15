import { blob, buildByRole, shade } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num, seeded } from './common';

/** 둥근 바위. size 1.5(지름), variant 0 */
export const rock = defineElement({
  type: 'rock',
  create(ctx, params) {
    const s = Math.max(0.2, num(params.size, 1.5));
    const rng = seeded(ctx, 'rock', params);
    const g = blob(s / 2, rng, 0.22, 2);
    g.scale(1, 0.75, 1);
    shade(g, { top: 1.05, bottom: 0.72 });
    const built = buildByRole(ctx.style, [{ role: 'rock', geo: g }]);
    return { object3d: built.group, dispose: built.dispose };
  },
});
