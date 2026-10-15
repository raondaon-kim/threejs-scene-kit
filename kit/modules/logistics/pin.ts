import * as THREE from 'three';
import { buildByRole, cone, place, sphere, wheelGeo, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num } from './common';

/** 지도 핀: 꼭짓점이 아래(원점)인 물방울 + 흰 원. 항상 카메라 쪽을 향하고, bob이면 위아래로 흔들린다. */
export const pin = defineElement({
  type: 'pin',
  create(ctx, params) {
    const S = num(params.size, 1.6);
    const bob = params.bob !== false;
    const tip = cone(S * 0.26, S * 0.62);
    tip.rotateX(Math.PI);
    tip.translate(0, S * 0.62, 0);
    const disc = wheelGeo(S * 0.13, 0.05);
    disc.rotateY(Math.PI / 2);
    const parts: Part[] = [
      { role: 'body', geo: tip },
      { role: 'body', geo: place(sphere(S * 0.3), 0, S * 0.42, 0) },
      { role: 'trim', geo: place(disc, 0, S * 0.72, S * 0.28) },
    ];
    const built = buildByRole(ctx.style, parts);
    const outer = new THREE.Group();
    outer.add(built.group);
    const phase = ctx.rng('pin')() * Math.PI * 2;
    const wp = new THREE.Vector3();
    return {
      object3d: outer,
      update(t) {
        built.group.position.y = bob ? 0.18 * (1 + Math.sin(t * 2.2 + phase)) : 0;
        outer.updateWorldMatrix(true, false);
        outer.getWorldPosition(wp);
        const cam = ctx.camera.position;
        const parentYaw = outer.parent ? new THREE.Euler().setFromQuaternion(outer.parent.getWorldQuaternion(new THREE.Quaternion())).y : 0;
        built.group.rotation.y = Math.atan2(cam.x - wp.x, cam.z - wp.z) - parentYaw;
      },
      dispose: built.dispose,
    };
  },
});
