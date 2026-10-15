import * as THREE from 'three';
import { buildByRole, cone, cyl, place, roundedBox, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num } from './common';

/**
 * 풍차: 원통 탑 + 복숭아 원뿔 지붕 + 날개 4개(+Z 쪽 허브). height 6, speed 0.25(회전/초).
 * update(t): 날개 그룹 'sails'의 rotation.z = −(2π·speed·t mod 2π)
 */
export const windmill = defineElement({
  type: 'windmill',
  create(ctx, params) {
    const H = Math.max(2, num(params.height, 6));
    const speed = num(params.speed, 0.25);
    const k = H / 6;
    const towerH = H * 0.74;
    const parts: Part[] = [
      { role: 'neutral', geo: cyl(1.5 * k, 1.6 * k, 0.4 * k, 32) },
      { role: 'body', geo: cyl(1.05 * k, 1.4 * k, towerH, 32) },
      { role: 'roof', geo: place(cone(1.35 * k, H * 0.3), 0, towerH - 0.05, 0) },
      { role: 'wood', geo: place(roundedBox(0.7 * k, 1.2 * k, 0.15, 0.2 * k), 0, 0.3 * k, 1.38 * k) },
      { role: 'dark', geo: place(roundedBox(0.4 * k, 0.55 * k, 0.15, 0.12 * k), 0, towerH * 0.55, 1.22 * k) },
    ];
    const tower = buildByRole(ctx.style, parts);
    const hubY = towerH * 0.95;
    const hubZ = 1.35 * k;
    const blade: Part[] = [{ role: 'wood', geo: place(cyl(0.22 * k, 0.22 * k, 0.4 * k, 16).rotateX(Math.PI / 2), 0, 0, 0) }];
    const arm = H * 0.5;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const spar = roundedBox(0.14 * k, arm, 0.1, 0.03);
      spar.rotateZ(a);
      blade.push({ role: 'wood', geo: spar });
      const sail = roundedBox(0.75 * k, arm * 0.78, 0.05, 0.03);
      sail.translate(0.42 * k, arm * 0.2, 0.04);
      sail.rotateZ(a);
      blade.push({ role: 'bodyLight', geo: sail });
      for (let j = 1; j <= 3; j++) {
        const rib = roundedBox(0.8 * k, 0.05, 0.06, 0.02);
        rib.translate(0.42 * k, arm * 0.2 + (arm * 0.78 * j) / 4, 0.08);
        rib.rotateZ(a);
        blade.push({ role: 'wood', geo: rib });
      }
    }
    const sailsBuilt = buildByRole(ctx.style, blade);
    const sails = sailsBuilt.group;
    sails.name = 'sails';
    sails.position.set(0, hubY, hubZ);
    const group = new THREE.Group();
    group.add(tower.group, sails);
    return {
      object3d: group,
      update(t: number) {
        sails.rotation.z = -((2 * Math.PI * speed * t) % (2 * Math.PI));
      },
      dispose() {
        tower.dispose();
        sailsBuilt.dispose();
      },
    };
  },
});
