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
    const parts: Part[] = [{ role: 'ground', geo: slab(outline(R, rng), 0.25, 0, 0.25) }];
    // 절벽: 위쪽 세 층은 거의 수직(두꺼운 절벽), 그 아래는 안쪽으로 좁아진다.
    // 덩어리 높이는 최대 size·1.45 → 각 층 꼭대기를 위 층과 겹치게 쌓는다.
    let yTop = -0.15;
    let i = 0;
    while (yTop > -D + 1 && i < 12) {
      const vertical = i < 3;
      const f = Math.min(1, Math.max(0, (-yTop - D * 0.35) / (D * 0.65)));
      const r = vertical ? R * (0.995 - i * 0.025) : R * (0.92 - f * 0.72);
      const size = Math.max(1.4, (vertical ? 4.2 : 3.6 - f * 1.6) * k);
      const y0 = yTop - size * 1.3;
      rockRing(parts, rng, r, y0, size);
      yTop = y0 + size * 0.5;
      i++;
    }
    // 가장자리로 넘쳐 흐르는 잔디(이끼) 덩어리: 판 모서리 띠를 가린다
    const n = Math.round((Math.PI * 2 * R) / (1.6 * k));
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + rng() * 0.05;
      const s = (1.1 + rng() * 0.7) * k;
      const g = blob(s / 2, rng, 0.2, 1);
      g.scale(1, 0.55, 1);
      g.translate(Math.cos(a) * R * 0.985, -0.55 * k - rng() * 0.4 * k, Math.sin(a) * R * 0.985);
      parts.push({ role: 'ground', geo: g });
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
