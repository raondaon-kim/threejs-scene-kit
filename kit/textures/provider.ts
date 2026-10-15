import p5 from 'p5';
import * as THREE from 'three';
import { drawMeshGradient } from './gradient';
import type { BackgroundSpec, TextureDef, TextureProvider } from './types';

type P5Internal = p5 & { _start?: () => void; _startListener?: EventListener | null; canvas: HTMLCanvasElement };

/** p5 인스턴스로 오프스크린에 그리고 결과를 일반 캔버스로 복사해 돌려준다 (그리기 후 인스턴스 제거) */
export function paintWithP5(w: number, h: number, seed: number, draw: (p: p5) => void): HTMLCanvasElement {
  let out: HTMLCanvasElement | null = null;
  const host = document.createElement('div');
  host.style.display = 'none';
  document.body.appendChild(host);
  const inst = new p5((p: p5) => {
    p.setup = () => {
      p.pixelDensity(1);
      p.createCanvas(w, h);
      p.noLoop();
      p.randomSeed(seed);
      p.noiseSeed(seed);
      draw(p);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.drawImage((p as P5Internal).canvas, 0, 0);
      out = c;
    };
  }, host) as P5Internal;
  if (!out) {
    // 페이지 load 이전이면 p5가 setup을 load 이벤트까지 미룬다 → 즉시 시작 (p5 1.11 내부 동작)
    if (inst._startListener) window.removeEventListener('load', inst._startListener, false);
    inst._start?.();
  }
  inst.remove();
  host.remove();
  if (!out) throw new Error('p5 그리기 실패: setup이 실행되지 않음');
  return out;
}

export const SURFACE_SIZE = 512;

/** 브라우저용 provider: (텍스처, 시드)별로 한 번만 그리고 캐시 */
export function createP5Provider(): TextureProvider {
  const cache = new Map<string, THREE.Texture>();
  return {
    surface(def: TextureDef, seed: number) {
      const key = `s:${def.name}:${seed}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const canvas = paintWithP5(SURFACE_SIZE, SURFACE_SIZE, seed, (p) => def.draw(p, { seed, size: SURFACE_SIZE }));
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.NoColorSpace; // 회색조 디테일 데이터
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      cache.set(key, tex);
      return tex;
    },
    background(spec: BackgroundSpec, colors: string[], aspect: number, seed: number) {
      const w = 1024;
      const h = Math.max(64, Math.round(w / Math.max(0.2, aspect)));
      const key = `b:${JSON.stringify(colors)}:${spec.sun ? 1 : 0}:${w}x${h}:${seed}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const canvas = paintWithP5(w, h, seed, (p) => drawMeshGradient(p, { w, h, colors, sun: !!spec.sun }));
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      cache.set(key, tex);
      return tex;
    },
    dispose() {
      for (const t of cache.values()) t.dispose();
      cache.clear();
    },
  };
}
