import { ease, lerp, lerp3 } from './easing';
import { curveFrom } from './motion';
import type { CameraMove, Vec3 } from './types';

export const DEFAULT_FOV = 40;
export const DEFAULT_SIZE = 30;

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  fov: number;
  /** ortho 카메라의 화면 세로 높이(m) */
  size: number;
}

const sizeAt = (cam: CameraMove, e: number) => lerp(cam.size ?? DEFAULT_SIZE, cam.sizeTo ?? cam.size ?? DEFAULT_SIZE, e);

/** u: 샷 안의 진행도 0..1 */
export function cameraPose(cam: CameraMove, u: number): CameraPose {
  const fov = cam.fov ?? DEFAULT_FOV;
  switch (cam.move) {
    case 'static':
      return { position: [...cam.pos] as Vec3, target: [...cam.target] as Vec3, fov, size: sizeAt(cam, ease('inOut', u)) };
    case 'dolly':
    case 'crane': {
      const e = ease(cam.ease ?? (cam.move === 'crane' ? 'out' : 'inOut'), u);
      return { position: lerp3(cam.from, cam.to, e), target: lerp3(cam.target, cam.targetTo ?? cam.target, e), fov, size: sizeAt(cam, e) };
    }
    case 'orbit': {
      const e = ease(cam.ease ?? 'inOut', u);
      const a = (lerp(cam.fromDeg, cam.toDeg, e) * Math.PI) / 180;
      const [cx, cy, cz] = cam.center;
      return {
        position: [cx + Math.sin(a) * cam.radius, cy + cam.height, cz + Math.cos(a) * cam.radius],
        target: [cx, cy, cz],
        fov,
        size: sizeAt(cam, e),
      };
    }
    case 'path': {
      const e = ease(cam.ease ?? 'inOut', u);
      const p = curveFrom(cam.points).getPointAt(e);
      let target: Vec3;
      if (cam.targets) {
        const q = curveFrom(cam.targets).getPointAt(e);
        target = [q.x, q.y, q.z];
      } else {
        target = [...(cam.target as Vec3)] as Vec3;
      }
      return { position: [p.x, p.y, p.z], target, fov, size: sizeAt(cam, e) };
    }
    default:
      throw new Error(`알 수 없는 카메라 move: ${(cam as { move: string }).move}`);
  }
}
