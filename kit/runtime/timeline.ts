import { clamp01, ease, easeOutBack, lerp, smoothstep } from './easing';
import type { AnimName, Cue, ShotDef } from './types';

export const DEFAULT_DUR = 0.6;

export interface AnimMods {
  opacity: number;
  scale: number;
  dy: number;
  progress: number | null;
}

export function animMods(anim: AnimName, p: number): AnimMods {
  const x = clamp01(p);
  switch (anim) {
    case 'fade':
      return { opacity: ease('out', x), scale: 1, dy: 0, progress: null };
    case 'pop':
      return { opacity: clamp01(x * 3), scale: Math.max(0.0001, easeOutBack(x)), dy: 0, progress: null };
    case 'rise':
      return { opacity: ease('out', x), scale: 1, dy: -1.5 * (1 - ease('out', x)), progress: null };
    case 'grow':
      return { opacity: 1, scale: 1, dy: 0, progress: ease('inOut', x) };
    default:
      return { opacity: 1, scale: 1, dy: 0, progress: null };
  }
}

export interface ElementState {
  visible: boolean;
  opacity: number;
  scale: number;
  dy: number;
  progress: number | null;
}

const HIDDEN: ElementState = { visible: false, opacity: 0, scale: 1, dy: 0, progress: 0 };

function cueProgress(c: Cue, t: number): number {
  return c.anim === 'none' ? 1 : clamp01((t - c.t) / (c.dur ?? DEFAULT_DUR));
}

export function elementState(el: { enter?: Cue; exit?: Cue }, t: number): ElementState {
  let pIn = 1;
  let pOut = 0;
  if (el.enter) {
    if (t < el.enter.t) return HIDDEN;
    pIn = cueProgress(el.enter, t);
  }
  if (el.exit && t >= el.exit.t) {
    pOut = cueProgress(el.exit, t);
    if (pOut >= 1) return HIDDEN;
  }
  const a = animMods(el.enter?.anim ?? 'none', pIn);
  const b = animMods(el.exit?.anim ?? 'none', 1 - pOut);
  const progress = a.progress === null && b.progress === null ? null : (a.progress ?? 1) * (b.progress ?? 1);
  return { visible: true, opacity: a.opacity * b.opacity, scale: a.scale * b.scale, dy: a.dy + b.dy, progress };
}

export function sampleTrack(keys: Array<[number, number]>, t: number): number {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t < t1) {
      const [t0, v0] = keys[i - 1];
      return lerp(v0, v1, smoothstep((t - t0) / (t1 - t0)));
    }
  }
  return last[1];
}

export function findShot(shots: ShotDef[], t: number): { shot: ShotDef; u: number } {
  let shot = shots[0];
  for (const s of shots) if (t >= s.start) shot = s;
  return { shot, u: clamp01((t - shot.start) / (shot.end - shot.start)) };
}
