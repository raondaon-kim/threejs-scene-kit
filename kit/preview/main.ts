import { createPipeline, type Pipeline } from '../runtime/pipeline';
import { elementRegistry, typeInfo } from '../runtime/registry';
import type { SceneDef } from '../runtime/types';
import { validateScene, type Issue } from '../runtime/validate';
import { buildWorld } from '../runtime/world';
import { composeCompare, composeSheet } from './sheet';
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
  compare(pairs: Array<{ t: number; src: string; label: string }>): Promise<string>;
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
  const ssParam = Number(qs.get('ss'));
  const ss = Number.isFinite(ssParam) && ssParam >= 1 ? ssParam : quality === 'final' ? 2 : 1;
  document.body.classList.toggle('kit-capture', capture);

  let pipeline: Pipeline | null = null;
  let renderAt: (t: number) => Promise<void> = async () => {
    throw new Error('장면이 준비되지 않음');
  };

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
    const built = buildWorld(def, { quality, aspect: meta.width / meta.height });
    if (!built.world) return { ok: false, errors: built.issues };
    const world = built.world;
    try {
      pipeline = createPipeline({ world, look: world.look, quality, width: w, height: h, ss });
    } catch (e) {
      return { ok: false, errors: [{ path: 'renderer', message: `WebGL 초기화 실패: ${(e as Error).message}` }] };
    }
    const p = pipeline;
    renderAt = async (t: number) => {
      const tc = Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), meta.duration);
      world.setTime(tc);
      p.render();
    };
    const stage = document.createElement('div');
    stage.className = 'kit-stage';
    stage.appendChild(p.canvas);
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

  const canvasOf = () => {
    if (!pipeline) throw new Error('장면이 준비되지 않음');
    return pipeline.canvas;
  };

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
    capture: () => canvasOf().toDataURL('image/png'),
    sheet: (times, cols) => composeSheet((t) => renderAt(t), canvasOf(), times, cols),
    compare: (pairs) => composeCompare((t) => renderAt(t), canvasOf(), pairs),
    gpu: () => pipeline?.gpu() ?? 'none',
  };
}
