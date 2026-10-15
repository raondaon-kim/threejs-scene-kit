import * as THREE from 'three';
import { blob, buildByRole, shade, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num, seeded } from './common';

/** 구름: 흰 덩어리 무리. 그림자를 드리우지 않는다(userData.noShadow). size 4, variant 0. update: 천천히 위아래 */
export const cloud = defineElement({
  type: 'cloud',
  create(ctx, params) {
    const S = Math.max(0.5, num(params.size, 4));
    const rng = seeded(ctx, 'cloud', params);
    const parts: Part[] = [];
    const n = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0.5 : i / (n - 1);
      const x = (f - 0.5) * S * 1.1;
      const r = S * (0.2 + 0.16 * Math.sin(Math.PI * f) + rng() * 0.06);
      const g = blob(r, rng, 0.08, 2);
      g.translate(x, (rng() - 0.5) * S * 0.06, (rng() - 0.5) * S * 0.25);
      parts.push({ role: 'trim', geo: g });
    }
    // 아래쪽은 살짝 라벤더 그늘
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of parts) {
      p.geo.computeBoundingBox();
      y0 = Math.min(y0, p.geo.boundingBox!.min.y);
      y1 = Math.max(y1, p.geo.boundingBox!.max.y);
    }
    for (const p of parts) shade(p.geo, { top: 1, bottom: [0.86, 0.85, 0.95], y0, y1 });
    const built = buildByRole(ctx.style, parts);
    const group = new THREE.Group();
    group.add(built.group);
    group.userData.noShadow = true;
    const ph = rng() * Math.PI * 2;
    return {
      object3d: group,
      update(t: number) {
        group.position.y = 0.25 * Math.sin(t * 0.5 + ph);
      },
      dispose: built.dispose,
    };
  },
});
