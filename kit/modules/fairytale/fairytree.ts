import { blob, buildByRole, cone, cyl, place, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num, pick, seeded } from './common';

/** 동화 나무: puffy(몽글한 덩어리 수관) | conifer(원뿔 3단). height 3.5, variant 0 */
export const fairytree = defineElement({
  type: 'fairytree',
  create(ctx, params) {
    const kind = pick('fairytree', 'kind', params.kind, ['puffy', 'conifer'] as const, 'puffy');
    const H = Math.max(0.6, num(params.height, 3.5));
    const rng = seeded(ctx, 'fairytree', params);
    const parts: Part[] = [];
    if (kind === 'puffy') {
      parts.push({ role: 'trunk', geo: cyl(H * 0.045, H * 0.07, H * 0.48, 12) });
      const cy = H * 0.42;
      const R = H * 0.2;
      const top = blob(R * 1.15, rng, 0.1, 2);
      top.translate(0, cy + R * 0.55, 0);
      parts.push({ role: 'foliage', geo: top });
      const n = 5 + Math.floor(rng() * 2);
      const p0 = rng() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = p0 + (i / n) * Math.PI * 2;
        const r = R * (0.85 + rng() * 0.3);
        const g = blob(r, rng, 0.1, 2);
        g.translate(Math.cos(a) * R * 0.95, cy - r * 0.2 + rng() * R * 0.3, Math.sin(a) * R * 0.95);
        parts.push({ role: 'foliage', geo: g });
      }
    } else {
      parts.push({ role: 'trunk', geo: cyl(H * 0.04, H * 0.06, H * 0.25, 10) });
      const tiers = 3;
      for (let i = 0; i < tiers; i++) {
        const f = i / tiers;
        const r = H * (0.26 - f * 0.07);
        parts.push({ role: 'foliage', geo: place(cone(r, H * 0.42), 0, H * (0.16 + f * 0.24), 0) });
      }
    }
    const built = buildByRole(ctx.style, parts);
    return { object3d: built.group, dispose: built.dispose };
  },
});
