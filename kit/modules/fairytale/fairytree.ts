import { blob, buildByRole, cone, cyl, place, shade, tintColors, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num, pick, seeded } from './common';

/**
 * 동화 나무: puffy(몽글한 덩어리 수관) | conifer(원뿔 3단). height 3.5, variant 0.
 * 수관은 위가 밝고 아래가 어두운 정점 색 음영 + tint(기본 0.06)만큼 나무마다 색이 조금씩 다르다.
 */
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
    // 수관 전체 높이 범위로 음영 (위 밝게, 아래 어둡게) + 나무마다 색 흔들림
    const crown = parts.filter((p) => p.role === 'foliage');
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const c of crown) {
      c.geo.computeBoundingBox();
      y0 = Math.min(y0, c.geo.boundingBox!.min.y);
      y1 = Math.max(y1, c.geo.boundingBox!.max.y);
    }
    const tint = Math.max(0, Math.min(0.5, num(params.tint, 0.06)));
    const m: [number, number, number] = [1 + (rng() * 2 - 1) * tint, 1 + (rng() * 2 - 1) * tint * 0.6, 1 + (rng() * 2 - 1) * tint];
    for (const c of crown) tintColors(shade(c.geo, { top: 1.12, bottom: 0.78, y0, y1 }), m);
    const built = buildByRole(ctx.style, parts);
    return { object3d: built.group, dispose: built.dispose };
  },
});
