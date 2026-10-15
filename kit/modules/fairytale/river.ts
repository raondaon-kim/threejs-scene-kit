import * as THREE from 'three';
import { blob, buildByRole, ribbon, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { curveFrom } from '../../runtime/motion';
import type { Vec3 } from '../../runtime/types';
import { doubleSided, num, points, seeded } from './common';

/** 강: points [[x,z]…] (절대 좌표), width 3. 물 리본 + 양쪽 가장자리 돌 */
export const river = defineElement({
  type: 'river',
  create(ctx, params) {
    const pts = points('river', params.points);
    const w = Math.max(0.5, num(params.width, 3));
    const rng = seeded(ctx, 'river', params);
    const curve = curveFrom(pts.map(([x, z]) => [x, 0, z] as Vec3));
    const len = Math.max(0.5, curve.getLength() || 0.5);
    const steps = Math.max(2, Math.ceil(len / 0.5));
    const water = doubleSided(ctx, 'water', ribbon(curve, 0, 1, steps, -w / 2, w / 2, 0.03));
    const bank = doubleSided(ctx, 'road', ribbon(curve, 0, 1, steps, -w / 2 - 0.6, w / 2 + 0.6, 0.015));
    const stones: Part[] = [];
    for (let s = 0.8; s < len; s += 1.4) {
      const u = s / len;
      const p = curve.getPointAt(u);
      const t = curve.getTangentAt(u);
      const l = Math.hypot(t.x, t.z) || 1;
      const nx = -t.z / l;
      const nz = t.x / l;
      for (const side of [-1, 1]) {
        if (rng() < 0.35) continue;
        const size = 0.35 + rng() * 0.45;
        const off = side * (w / 2 + 0.15 + rng() * 0.3);
        const g = blob(size / 2, rng, 0.2, 1);
        g.scale(1, 0.6, 1);
        g.translate(p.x + nx * off, 0, p.z + nz * off);
        stones.push({ role: 'rock', geo: g });
      }
    }
    const group = new THREE.Group();
    group.add(bank.mesh, water.mesh);
    const built = stones.length ? buildByRole(ctx.style, stones) : null;
    if (built) group.add(built.group);
    return {
      object3d: group,
      dispose() {
        water.dispose();
        bank.dispose();
        built?.dispose();
      },
    };
  },
});
