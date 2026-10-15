import type { Vec3 } from './types';

export type EaseName = 'linear' | 'in' | 'out' | 'inOut';
export const EASES: readonly EaseName[] = ['linear', 'in', 'out', 'inOut'];

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function ease(name: EaseName, t: number): number {
  const x = clamp01(t);
  switch (name) {
    case 'in':
      return x * x * x;
    case 'out':
      return 1 - Math.pow(1 - x, 3);
    case 'inOut':
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    default:
      return x;
  }
}

export function easeOutBack(t: number): number {
  const x = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export const smoothstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
