import * as THREE from 'three';
import { buildByRole, cyl, place, roundedBox, wheelGeo, type Part } from '../../parts';
import { clamp01 } from '../../runtime/easing';
import { defineElement } from '../../runtime/element';
import { num } from './common';

const R = 0.32;

/** 지게차: +Z가 앞. lift(0~1) → 캐리지 높이, travel → 바퀴 회전. load면 팔레트+상자 적재 */
export const forklift = defineElement({
  type: 'forklift',
  animatable: ['lift', 'travel'],
  create(ctx, params) {
    const load = params.load !== false;
    const body: Part[] = [
      { role: 'accent', geo: place(roundedBox(1.3, 0.9, 2.0, 0.2), 0, 0.3, -0.2) },
      { role: 'accent', geo: place(roundedBox(1.3, 0.7, 0.5, 0.15), 0, 0.3, -1.15) },
      { role: 'dark', geo: place(roundedBox(0.6, 0.5, 0.5, 0.1), 0, 1.2, -0.45) },
      { role: 'dark', geo: place(roundedBox(1.25, 0.08, 1.35, 0.03), 0, 2.4, -0.15) },
      { role: 'dark', geo: place(roundedBox(0.12, 2.6, 0.12, 0.03), 0.4, 0.15, 0.95) },
      { role: 'dark', geo: place(roundedBox(0.12, 2.6, 0.12, 0.03), -0.4, 0.15, 0.95) },
    ];
    for (const x of [-0.55, 0.55]) for (const z of [0.45, -0.75]) body.push({ role: 'dark', geo: place(cyl(0.05, 0.05, 1.2, 10), x, 1.2, z) });
    const built = buildByRole(ctx.style, body);

    const car: Part[] = [
      { role: 'dark', geo: place(roundedBox(0.15, 0.08, 1.1, 0.03), 0.3, 0, 1.6) },
      { role: 'dark', geo: place(roundedBox(0.15, 0.08, 1.1, 0.03), -0.3, 0, 1.6) },
      { role: 'dark', geo: place(roundedBox(1.0, 0.6, 0.08, 0.03), 0, 0, 1.05) },
    ];
    if (load) {
      car.push({ role: 'wood', geo: place(roundedBox(1.0, 0.15, 1.0, 0.03), 0, 0.08, 1.6) });
      for (const x of [-0.24, 0.24]) for (const z of [1.36, 1.84]) car.push({ role: 'cargo', geo: place(roundedBox(0.46, 0.42, 0.46, 0.06), x, 0.23, z) });
    }
    const carriage = buildByRole(ctx.style, car);
    carriage.group.name = 'carriage';
    built.group.add(carriage.group);

    const tireGeo = wheelGeo(R, 0.25);
    const hubGeo = wheelGeo(0.13, 0.27);
    const tire = ctx.style.material('dark');
    const hub = ctx.style.material('trim');
    const wheels: THREE.Group[] = [];
    for (const z of [0.6, -0.9]) {
      for (const x of [-0.62, 0.62]) {
        const g = new THREE.Group();
        g.name = 'wheel';
        g.add(new THREE.Mesh(tireGeo, tire), new THREE.Mesh(hubGeo, hub));
        g.position.set(x, R, z);
        built.group.add(g);
        wheels.push(g);
      }
    }
    const setLift = (v: number) => {
      carriage.group.position.y = 0.12 + clamp01(v) * 1.8;
    };
    setLift(num(params.lift, 0));
    return {
      object3d: built.group,
      setParam(name, v) {
        if (name === 'lift') setLift(v);
        else if (name === 'travel') for (const w of wheels) w.rotation.x = v / R;
      },
      dispose() {
        built.dispose();
        carriage.dispose();
        tireGeo.dispose();
        hubGeo.dispose();
        tire.dispose();
        hub.dispose();
      },
    };
  },
});
