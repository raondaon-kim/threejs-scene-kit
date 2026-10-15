import { ease, lerp, lerp3 } from './easing';
import type { CameraMove, Vec3 } from './types';

export const DEFAULT_FOV = 40;

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  fov: number;
}

/** u: 샷 안의 진행도 0..1 */
export function cameraPose(cam: CameraMove, u: number): CameraPose {
  const fov = cam.fov ?? DEFAULT_FOV;
  switch (cam.move) {
    case 'static':
      return { position: [...cam.pos] as Vec3, target: [...cam.target] as Vec3, fov };
    case 'dolly':
    case 'crane': {
      const e = ease(cam.ease ?? (cam.move === 'crane' ? 'out' : 'inOut'), u);
      return { position: lerp3(cam.from, cam.to, e), target: lerp3(cam.target, cam.targetTo ?? cam.target, e), fov };
    }
    case 'orbit': {
      const e = ease(cam.ease ?? 'inOut', u);
      const a = (lerp(cam.fromDeg, cam.toDeg, e) * Math.PI) / 180;
      const [cx, cy, cz] = cam.center;
      return {
        position: [cx + Math.sin(a) * cam.radius, cy + cam.height, cz + Math.cos(a) * cam.radius],
        target: [cx, cy, cz],
        fov,
      };
    }
    default:
      throw new Error(`알 수 없는 카메라 move: ${(cam as { move: string }).move}`);
  }
}
