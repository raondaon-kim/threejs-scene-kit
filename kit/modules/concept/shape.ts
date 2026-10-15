import * as THREE from 'three';
import { defineElement } from '../../runtime/element';
import { num, role } from './params';

export const shape = defineElement({
  type: 'shape',
  supportsGrow: false,
  create(ctx, params) {
    const kind = String(params.kind ?? 'box');
    const size = num(params.size, 1);
    let geo: THREE.BufferGeometry;
    switch (kind) {
      case 'box':
        geo = new THREE.BoxGeometry(size, size, size);
        break;
      case 'sphere':
        geo = new THREE.SphereGeometry(size / 2, 32, 16);
        break;
      case 'cylinder':
        geo = new THREE.CylinderGeometry(size / 2, size / 2, size, 32);
        break;
      case 'cone':
        geo = new THREE.ConeGeometry(size / 2, size, 32);
        break;
      case 'torus':
        geo = new THREE.TorusGeometry(size / 2, size * 0.15, 16, 48);
        break;
      default:
        throw new Error(`shape.kind '${kind}'은 지원하지 않음. 가능: box|sphere|cylinder|cone|torus`);
    }
    const mat = ctx.style.material(role(params.role, 'accent'));
    const mesh = new THREE.Mesh(geo, mat);
    return {
      object3d: mesh,
      dispose() {
        geo.dispose();
        mat.dispose();
      },
    };
  },
});
