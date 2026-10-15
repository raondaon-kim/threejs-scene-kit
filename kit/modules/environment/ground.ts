import * as THREE from 'three';
import type { Style } from '../../runtime/style';
import type { ElementHandle } from '../../runtime/types';

/** 평평한 바닥판 (y=0). 그림자를 받는다. */
export function createGround(ctx: { style: Style }, size: number): ElementHandle {
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const mat = ctx.style.material('ground');
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'ground';
  mesh.receiveShadow = true;
  return {
    object3d: mesh,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
