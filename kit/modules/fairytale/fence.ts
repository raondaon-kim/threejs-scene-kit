import { buildByRole, place, roundedBox, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { points } from './common';

/** 나무 울타리: points [[x,z]…] (절대 좌표)를 직선으로 잇고 기둥 약 1m 간격 + 가로대 2줄 */
export const fence = defineElement({
  type: 'fence',
  create(ctx, params) {
    const pts = points('fence', params.points);
    const parts: Part[] = [];
    const post = (x: number, z: number) => parts.push({ role: 'wood', geo: place(roundedBox(0.14, 0.75, 0.14, 0.04), x, 0, z) });
    let posts = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1];
      const [x1, z1] = pts[i];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 1e-6) continue;
      const yaw = Math.atan2(-(z1 - z0), x1 - x0);
      const n = Math.max(1, Math.round(len));
      for (let k = posts === 0 ? 0 : 1; k <= n; k++) {
        post(x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n);
        posts++;
      }
      for (const y of [0.28, 0.55]) {
        parts.push({ role: 'wood', geo: place(roundedBox(len, 0.07, 0.06, 0.02), (x0 + x1) / 2, y, (z0 + z1) / 2, yaw) });
      }
    }
    if (!parts.length) throw new Error('fence.params.points는 서로 다른 점 2개 이상이어야 함');
    const built = buildByRole(ctx.style, parts);
    return { object3d: built.group, dispose: built.dispose };
  },
});
