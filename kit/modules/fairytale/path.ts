import * as THREE from 'three';
import { ribbon } from '../../parts';
import { defineElement } from '../../runtime/element';
import { curveFrom } from '../../runtime/motion';
import type { Vec3 } from '../../runtime/types';
import { doubleSided, num, points } from './common';

/** 흙길: points [[x,z]…] (절대 좌표), width 1.6 */
export const path = defineElement({
  type: 'path',
  create(ctx, params) {
    const pts = points('path', params.points);
    const w = Math.max(0.3, num(params.width, 1.6));
    const curve = curveFrom(pts.map(([x, z]) => [x, 0, z] as Vec3));
    const len = Math.max(0.5, curve.getLength() || 0.5);
    const steps = Math.max(2, Math.ceil(len / 0.4));
    const surf = doubleSided(ctx, 'road', ribbon(curve, 0, 1, steps, -w / 2, w / 2, 0.04));
    const group = new THREE.Group();
    group.add(surf.mesh);
    return { object3d: group, dispose: surf.dispose };
  },
});
