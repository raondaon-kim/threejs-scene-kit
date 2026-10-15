import * as THREE from 'three';
import { elementRegistry, typeInfo } from '../runtime/registry';
import type { SceneDef } from '../runtime/types';
import { validateScene, type Issue } from '../runtime/validate';
import { buildWorld } from '../runtime/world';
import { composeSheet } from './sheet';
import { createTimelineUI } from './timeline-ui';
import './ui.css';

export interface KitStatus {
  ok: boolean;
  errors: Issue[];
}

export interface KitBridge {
  ready: Promise<KitStatus>;
  info(): { width: number; height: number; fps: number; duration: number; shots: Array<{ id: string; start: number; end: number }> };
  renderAt(t: number): Promise<void>;
  capture(): string;
  sheet(times: number[], cols: number): Promise<string>;
  gpu(): string;
}

declare global {
  interface Window {
    __KIT__: KitBridge;
  }
}

function showErrors(errors: Issue[]) {
  const box = document.createElement('pre');
  box.className = 'kit-errors';
  box.textContent = ['장면 오류:', ...errors.map((e) => `- ${e.path || '(root)'}: ${e.message}`)].join('\n');
  document.body.appendChild(box);
}

export function boot(def: SceneDef): void {
  const qs = new URLSearchParams(location.search);
  const capture = qs.get('capture') === '1';
  const quality = qs.get('quality') === 'final' ? 'final' : 'preview';
  document.body.classList.toggle('kit-capture', capture);

  let renderer: THREE.WebGLRenderer | null = null;
  let renderAt: (t: number) => Promise<void> = async () => {
    throw new Error('장면이 준비되지 않음');
  };
  const canvas = document.createElement('canvas');

  const start = async (): Promise<KitStatus> => {
    let types;
    try {
      types = typeInfo(elementRegistry(def?.custom ?? []));
    } catch (e) {
      return { ok: false, errors: [{ path: 'custom', message: (e as Error).message }] };
    }
    const errors = validateScene(def, types);
    if (errors.length) return { ok: false, errors };
    await document.fonts.load('700 64px "Malgun Gothic"').catch(() => undefined);
    await document.fonts.ready;
    const { meta } = def;
    const k = quality === 'final' ? 1 : 0.5;
    const w = Math.round((meta.width * k) / 2) * 2;
    const h = Math.round((meta.height * k) / 2) * 2;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    } catch (e) {
      return { ok: false, errors: [{ path: 'renderer', message: `WebGL 초기화 실패: ${(e as Error).message}` }] };
    }
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    const built = buildWorld(def, { quality, aspect: meta.width / meta.height });
    if (!built.world) return { ok: false, errors: built.issues };
    const world = built.world;
    const r = renderer;
    renderAt = async (t: number) => {
      const tc = Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), meta.duration);
      world.setTime(tc);
      r.render(world.scene, world.camera);
    };
    const stage = document.createElement('div');
    stage.className = 'kit-stage';
    stage.appendChild(canvas);
    document.body.appendChild(stage);
    if (!capture) createTimelineUI({ root: document.body, stage, def, renderAt });
    else await renderAt(0);
    return { ok: true, errors: [] };
  };

  const ready = start().catch((e: unknown) => ({
    ok: false,
    errors: [{ path: '', message: String((e as Error)?.stack ?? e) }],
  }));
  void ready.then((s) => {
    if (!s.ok) showErrors(s.errors);
  });

  window.__KIT__ = {
    ready,
    info: () => ({
      width: def.meta.width,
      height: def.meta.height,
      fps: def.meta.fps,
      duration: def.meta.duration,
      shots: def.shots.map((s) => ({ id: s.id, start: s.start, end: s.end })),
    }),
    renderAt: (t) => renderAt(t),
    capture: () => canvas.toDataURL('image/png'),
    sheet: (times, cols) => composeSheet((t) => renderAt(t), canvas, times, cols),
    gpu: () => {
      const gl = renderer?.getContext();
      if (!gl) return 'none';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    },
  };
}
