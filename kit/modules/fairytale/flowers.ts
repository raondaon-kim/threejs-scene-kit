import * as THREE from 'three';
import { blob, buildByRole, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import type { Role } from '../../runtime/types';
import { num, seeded } from './common';

const COLORS: Role[] = ['accent', 'accent2', 'accent3', 'trim'];

/** 꽃밭: 반지름 radius 원 안에 작은 꽃(노랑·분홍·라벤더·흰)과 풀 덩어리. radius 1.5, count 24, variant 0 */
export const flowers = defineElement({
  type: 'flowers',
  create(ctx, params) {
    const R = Math.max(0.2, num(params.radius, 1.5));
    const n = Math.max(1, Math.min(400, Math.round(num(params.count, 24))));
    const rng = seeded(ctx, 'flowers', params);
    const parts: Part[] = [];
    for (let i = 0; i < Math.ceil(n / 3); i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * R;
      const g = blob(0.16 + rng() * 0.1, rng, 0.15, 1);
      g.scale(1, 0.6, 1);
      g.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
      parts.push({ role: 'foliage', geo: g });
    }
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * R;
      const s = 0.07 + rng() * 0.06;
      const g = new THREE.SphereGeometry(s, 10, 8);
      g.scale(1, 0.7, 1);
      g.translate(Math.cos(a) * r, 0.12 + rng() * 0.14, Math.sin(a) * r);
      parts.push({ role: COLORS[Math.floor(rng() * COLORS.length)], geo: g });
    }
    const built = buildByRole(ctx.style, parts);
    return { object3d: built.group, dispose: built.dispose };
  },
});
