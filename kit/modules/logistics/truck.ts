import * as THREE from 'three';
import { buildByRole, place, roundedBox, wheelGeo, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num, pick } from './common';

const R = 0.5;

/** 트럭: +Z가 앞. kind box(높은 화물칸) | van(낮은 화물칸). travel → 바퀴 회전 */
export const truck = defineElement({
  type: 'truck',
  animatable: ['travel'],
  create(ctx, params) {
    const kind = pick('truck', 'kind', params.kind, ['box', 'van'] as const, 'box');
    const L = Math.max(5, num(params.length, 9));
    const cargoL = L - 2.6;
    const cargoZ = -L / 2 + cargoL / 2;
    const parts: Part[] = [
      { role: 'dark', geo: place(roundedBox(2.3, 0.5, L - 0.4, 0.1), 0, 0.5, 0) },
      { role: 'trim', geo: place(roundedBox(2.5, 2.3, 2.2, 0.35), 0, 0.8, L / 2 - 1.1) },
      { role: 'dark', geo: place(roundedBox(2.2, 0.85, 0.1, 0.04), 0, 2.05, L / 2 + 0.02) },
      { role: 'dark', geo: place(roundedBox(0.08, 0.7, 0.9, 0.03), 1.24, 2.1, L / 2 - 0.85) },
      { role: 'dark', geo: place(roundedBox(0.08, 0.7, 0.9, 0.03), -1.24, 2.1, L / 2 - 0.85) },
      { role: 'dark', geo: place(roundedBox(2.4, 0.35, 0.15, 0.05), 0, 0.7, L / 2 + 0.05) },
      { role: 'trim', geo: place(roundedBox(2.55, kind === 'van' ? 2.2 : 3.0, cargoL, 0.25), 0, 0.85, cargoZ) },
      { role: 'body', geo: place(roundedBox(2.6, 0.35, cargoL - 0.4, 0.08), 0, 1.7, cargoZ) },
    ];
    const built = buildByRole(ctx.style, parts);
    const tireGeo = wheelGeo(R, 0.4);
    const hubGeo = wheelGeo(0.22, 0.42);
    const tire = ctx.style.material('dark');
    const hub = ctx.style.material('trim');
    const wheels: THREE.Group[] = [];
    const axles = L > 7 ? [L / 2 - 1.3, -L / 2 + 1.2, -L / 2 + 2.3] : [L / 2 - 1.3, -L / 2 + 1.2];
    for (const z of axles) {
      for (const x of [-1.05, 1.05]) {
        const g = new THREE.Group();
        g.name = 'wheel';
        g.add(new THREE.Mesh(tireGeo, tire), new THREE.Mesh(hubGeo, hub));
        g.position.set(x, R, z);
        built.group.add(g);
        wheels.push(g);
      }
    }
    return {
      object3d: built.group,
      setParam(name, v) {
        if (name === 'travel') for (const w of wheels) w.rotation.x = v / R;
      },
      dispose() {
        built.dispose();
        tireGeo.dispose();
        hubGeo.dispose();
        tire.dispose();
        hub.dispose();
      },
    };
  },
});
