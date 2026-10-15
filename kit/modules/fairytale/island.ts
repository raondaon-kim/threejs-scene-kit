import * as THREE from 'three';
import { blob, buildByRole, cyl, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num, outline, rockRing, seeded, slab } from './common';

/**
 * 떠 있는 섬: 잔디 윗면(y=0) + 둘레 바위 절벽 + 아래로 좁아지는 바위 밑면 + 떠 있는 작은 바위.
 * radius 30, depth 12, floaters 6, variant 0
 */
export const island = defineElement({
  type: 'island',
  create(ctx, params) {
    const R = Math.max(4, num(params.radius, 30));
    const D = Math.max(2, num(params.depth, 12));
    const F = Math.max(0, Math.round(num(params.floaters, 6)));
    const rng = seeded(ctx, 'island', params);
    const k = R / 30;
    const parts: Part[] = [{ role: 'ground', geo: slab(outline(R, rng), 0.5, 0) }];
    // 윗면 바로 아래 흙·바위 테두리 + 밑으로 좁아지는 층
    const layers = 5;
    for (let i = 0; i < layers; i++) {
      const f = i / (layers - 1);
      const r = R * (0.96 - f * 0.8);
      const size = Math.max(1.2, (3.2 - f * 0.8) * k);
      // 덩어리 높이는 최대 size·1.45 → 첫 층 꼭대기가 윗면(0) 아래 0.3에 오도록
      const y = -0.3 - size * 1.45 - f * Math.max(0, D - size * 2.2);
      rockRing(parts, rng, r, y, size);
    }
    const core = cyl(R * 0.9, R * 0.12, D - 0.6, 48);
    core.translate(0, -D, 0);
    parts.push({ role: 'rock', geo: core });
    const built = buildByRole(ctx.style, parts);
    const group = new THREE.Group();
    group.add(built.group);
    // 떠 있는 작은 바위 (각자 위아래로 흔들림)
    const floaters = new THREE.Group();
    floaters.name = 'floaters';
    const owned: Array<{ dispose(): void }> = [built];
    const base: Array<{ o: THREE.Object3D; y: number; ph: number }> = [];
    for (let i = 0; i < F; i++) {
      const a = rng() * Math.PI * 2;
      const r = R * (0.55 + rng() * 0.5);
      const s = (0.8 + rng() * 1.6) * k;
      const g = blob(s / 2, rng, 0.25, 1);
      const b = buildByRole(ctx.style, [{ role: 'rock', geo: g }]);
      const y = -D * (0.55 + rng() * 0.5);
      b.group.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      floaters.add(b.group);
      owned.push(b);
      base.push({ o: b.group, y, ph: rng() * Math.PI * 2 });
    }
    group.add(floaters);
    return {
      object3d: group,
      update(t: number) {
        for (const f of base) f.o.position.y = f.y + 0.3 * Math.sin(t * 0.8 + f.ph);
      },
      dispose: () => owned.forEach((o) => o.dispose()),
    };
  },
});
