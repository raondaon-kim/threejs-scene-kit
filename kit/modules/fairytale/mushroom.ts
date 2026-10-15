import * as THREE from 'three';
import { buildByRole, cyl, place, roundedBox, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num, seeded } from './common';

/** 버섯집: 크림 줄기 + 빨간 갓(흰 점) + 나무 문 + 둥근 창. height 3, variant 0 (+Z가 앞) */
export const mushroom = defineElement({
  type: 'mushroom',
  create(ctx, params) {
    const H = Math.max(0.8, num(params.height, 3));
    const k = H / 3;
    const rng = seeded(ctx, 'mushroom', params);
    const stemH = H * 0.62;
    const stemR = 0.8 * k;
    const capR = 1.55 * k;
    const capY = stemH - 0.15 * k;
    const parts: Part[] = [{ role: 'bodyLight', geo: cyl(stemR * 0.92, stemR * 1.12, stemH, 32) }];
    const cap = new THREE.SphereGeometry(capR, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 0.72, 1);
    cap.translate(0, capY, 0);
    parts.push({ role: 'accent2', geo: cap });
    parts.push({ role: 'body', geo: place(cyl(capR * 0.97, capR * 0.97, 0.12 * k, 40), 0, capY - 0.06 * k, 0) });
    // 흰 점: 갓 표면 위 (위에서 볼 때 고르게)
    const spots = 9;
    for (let i = 0; i < spots; i++) {
      const th = (i / spots) * Math.PI * 2 + rng() * 0.5;
      const ph = 0.35 + rng() * 0.85;
      const r = (0.18 + rng() * 0.12) * k;
      const s = new THREE.SphereGeometry(r, 16, 10);
      s.scale(1, 0.35, 1);
      const nx = Math.sin(ph) * Math.cos(th);
      const ny = Math.cos(ph) * 0.72;
      const nz = Math.sin(ph) * Math.sin(th);
      s.lookAt(new THREE.Vector3(nx, ny, nz));
      s.translate(nx * capR, capY + ny * capR, nz * capR);
      parts.push({ role: 'trim', geo: s });
    }
    const top = new THREE.SphereGeometry(0.22 * k, 16, 10);
    top.scale(1, 0.35, 1);
    top.translate(0, capY + capR * 0.72, 0);
    parts.push({ role: 'trim', geo: top });
    // 문·창
    parts.push({ role: 'wood', geo: place(roundedBox(0.6 * k, 1.0 * k, 0.14, 0.2 * k), 0, 0.05, stemR * 1.02) });
    const win = cyl(0.17 * k, 0.17 * k, 0.1, 20);
    win.rotateX(Math.PI / 2);
    win.rotateY(0.7);
    win.translate(Math.sin(0.7) * stemR * 0.98, stemH * 0.6, Math.cos(0.7) * stemR * 0.98);
    parts.push({ role: 'dark', geo: win });
    const built = buildByRole(ctx.style, parts);
    return { object3d: built.group, dispose: built.dispose };
  },
});
