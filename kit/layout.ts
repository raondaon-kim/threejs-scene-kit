import { deriveSeed, mulberry32 } from './runtime/rng';
import type { ElementDef } from './runtime/types';

/** scene.ts 작성용 순수 배치 헬퍼: 반복문·해시 지터 대신 쓴다. 결과는 ElementDef 배열 */
export type XZ = [number, number];

/** 점에서 꺾은선(점 1개면 그 점)까지 최단 거리 */
export function distToPolyline(p: XZ, line: XZ[]): number {
  if (line.length === 1) return Math.hypot(p[0] - line[0][0], p[1] - line[0][1]);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1];
    const [bx, bz] = line[i];
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz;
    const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / l2));
    best = Math.min(best, Math.hypot(p[0] - (ax + dx * t), p[1] - (az + dz * t)));
  }
  return best;
}

export interface ScatterOpts {
  /** 흩뿌릴 요소 type (예: 'fairytree', 'flowers', 'rock') */
  type: string;
  /** 최대 개수 (0~5000). 조건(minDist·avoid) 때문에 덜 놓일 수 있음 */
  count: number;
  /** 원 중심 [x, z] (절대), 기본 [0, 0] */
  center?: XZ;
  radius: number;
  seed: number;
  /** 서로 최소 거리(m) */
  minDist?: number;
  /** 피할 선들 (강·길 points) */
  avoid?: XZ[][];
  /** 선 폭(m): 선에서 avoidWidth/2 안에는 놓지 않음. 기본 2 */
  avoidWidth?: number;
  /** 요소 params: 객체(공통) 또는 (i, rnd) => 객체. variant는 자동으로 i (명시하면 그 값) */
  params?: Record<string, unknown> | ((i: number, rnd: () => number) => Record<string, unknown>);
  /** id 접두사, 기본 type */
  idPrefix?: string;
  /** 높이(at.y), 기본 0 */
  y?: number;
  /** 무작위 Y 회전, 기본 true */
  rotate?: boolean;
}

export function scatter(o: ScatterOpts): ElementDef[] {
  if (typeof o.type !== 'string' || !o.type) throw new Error('scatter: type(요소 이름)이 필요함');
  if (!Number.isInteger(o.count) || o.count < 0 || o.count > 5000) throw new Error('scatter: count는 0~5000 정수');
  if (typeof o.radius !== 'number' || !(o.radius > 0)) throw new Error('scatter: radius는 0보다 큰 숫자');
  if (!Number.isInteger(o.seed)) throw new Error('scatter: seed는 정수');
  const [cx, cz] = o.center ?? [0, 0];
  const prefix = o.idPrefix ?? o.type;
  const rnd = mulberry32(deriveSeed(o.seed, `scatter:${o.type}:${prefix}`));
  const half = (o.avoidWidth ?? 2) / 2;
  const min = o.minDist ?? 0;
  const out: ElementDef[] = [];
  const placed: XZ[] = [];
  const maxTries = o.count * 40 + 40;
  for (let tries = 0; out.length < o.count && tries < maxTries; tries++) {
    const r = o.radius * Math.sqrt(rnd());
    const a = rnd() * Math.PI * 2;
    const p: XZ = [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
    const rot = rnd() * 360;
    if (o.avoid?.some((line) => line.length && distToPolyline(p, line) < half)) continue;
    if (min > 0 && placed.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < min)) continue;
    const i = out.length;
    const extra = typeof o.params === 'function' ? o.params(i, rnd) : (o.params ?? {});
    placed.push(p);
    out.push({
      id: `${prefix}-${i}`,
      type: o.type,
      at: [p[0], o.y ?? 0, p[1]],
      ...(o.rotate === false ? {} : { rotation: [0, rot, 0] as [number, number, number] }),
      params: { variant: i, ...extra },
    });
  }
  return out;
}
