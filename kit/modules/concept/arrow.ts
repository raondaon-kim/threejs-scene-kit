import * as THREE from 'three';
import { clamp01 } from '../../runtime/easing';
import { defineElement } from '../../runtime/element';
import { num, role, vec3 } from './params';

export const arrow = defineElement({
  type: 'arrow',
  supportsGrow: true,
  create(ctx, params) {
    const to = vec3(params.to, [0, 2, 0]);
    const dir = new THREE.Vector3(...to);
    const len = dir.length();
    if (len < 1e-6) throw new Error('arrow.params.to는 [0,0,0]이 아니어야 함 (요소 위치 기준 상대 좌표)');
    const thick = num(params.thickness, 0.08);
    const headLen = Math.min(len * 0.3, thick * 5);
    const bodyGeo = new THREE.CylinderGeometry(thick, thick, 1, 16);
    bodyGeo.translate(0, 0.5, 0);
    const headGeo = new THREE.ConeGeometry(thick * 2.5, headLen, 24);
    headGeo.translate(0, -headLen / 2, 0);
    const mat = ctx.style.material(role(params.role, 'accent'));
    const body = new THREE.Mesh(bodyGeo, mat);
    const head = new THREE.Mesh(headGeo, mat);
    const group = new THREE.Group();
    group.add(body, head);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const setProgress = (p: number) => {
      const L = len * clamp01(p);
      const bodyL = Math.max(0, L - headLen);
      body.scale.set(1, Math.max(bodyL, 1e-4), 1);
      body.visible = bodyL > 1e-4;
      head.position.y = L;
      head.scale.setScalar(Math.max(1e-4, Math.min(1, L / headLen)));
      head.visible = L > 1e-4;
    };
    setProgress(1);
    return {
      object3d: group,
      setProgress,
      dispose() {
        bodyGeo.dispose();
        headGeo.dispose();
        mat.dispose();
      },
    };
  },
});
