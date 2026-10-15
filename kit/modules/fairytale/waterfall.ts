import * as THREE from 'three';
import { blob, buildByRole, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { doubleSided, num, seeded } from './common';

/**
 * 폭포: 원점 = 위 가장자리(y=0), 아래로 height만큼 늘어진 물줄기. 물은 +Z 쪽으로 살짝 휘어 떨어진다.
 * height 10, width 3. 위·아래 물보라(흰 덩어리)가 출렁인다.
 */
export const waterfall = defineElement({
  type: 'waterfall',
  create(ctx, params) {
    const H = Math.max(1, num(params.height, 10));
    const W = Math.max(0.3, num(params.width, 3));
    const rng = seeded(ctx, 'waterfall', params);
    const geo = new THREE.PlaneGeometry(W, H, 1, 24);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const s = (H / 2 - pos.getY(i)) / H;
      pos.setXYZ(i, pos.getX(i) * (1 + s * 0.15), -H * s, 1.4 * Math.sqrt(s));
    }
    geo.computeVertexNormals();
    const sheet = doubleSided(ctx, 'water', geo);
    const foamTop: Part[] = [];
    for (let x = -W / 2; x <= W / 2 + 1e-6; x += W / 4) {
      const g = blob(0.35 + rng() * 0.15, rng, 0.2, 1);
      g.translate(x, -0.35, 0.15);
      foamTop.push({ role: 'trim', geo: g });
    }
    const top = buildByRole(ctx.style, foamTop);
    const group = new THREE.Group();
    group.add(sheet.mesh, top.group);
    const puffs = new THREE.Group();
    puffs.name = 'foam';
    puffs.position.set(0, -H, 1.4);
    const owned: Array<{ dispose(): void }> = [sheet, top];
    const ph: number[] = [];
    for (let i = 0; i < 6; i++) {
      const b = buildByRole(ctx.style, [{ role: 'trim', geo: blob(0.5 + rng() * 0.4, rng, 0.2, 1) }]);
      b.group.position.set((rng() - 0.5) * W * 1.3, -0.6 + rng() * 0.4, (rng() - 0.5) * 1.2);
      puffs.add(b.group);
      owned.push(b);
      ph.push(rng() * Math.PI * 2);
    }
    group.add(puffs);
    return {
      object3d: group,
      update(t: number) {
        puffs.children.forEach((c, i) => c.scale.setScalar(1 + 0.08 * Math.sin(t * 3 + ph[i])));
      },
      dispose: () => owned.forEach((o) => o.dispose()),
    };
  },
});
