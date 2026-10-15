import { ELEMENT_ROLES, type Role, type Vec3 } from '../../runtime/types';

export const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function vec3(v: unknown, d: Vec3): Vec3 {
  return Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x)) ? (v as Vec3) : d;
}

export function role(v: unknown, d: Role): Role {
  return ELEMENT_ROLES.includes(v as Role) ? (v as Role) : d;
}
