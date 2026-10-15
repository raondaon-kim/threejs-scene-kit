import { createPipeline, type Pipeline } from '../runtime/pipeline';
import { elementRegistry, typeInfo } from '../runtime/registry';
import type { SceneDef } from '../runtime/types';
import { validateScene, type Issue } from '../runtime/validate';
import { buildWorld } from '../runtime/world';
import { getStyle } from '../styles';
import { BACKGROUND_PRESETS, textureRegistry } from '../textures';
import { drawMeshGradient, presetColors } from '../textures/gradient';
import { createP5Provider, paintWithP5, SURFACE_SIZE } from '../textures/provider';
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
  /** 텍스처·배경 프리셋 견본 시트 (swatch.mjs) */
  swatch(): Promise<{ png: string; textures: string[]; backgrounds: string[] }>;
  /** 텍스처 결정성·이어짐 확인용 (e2e) */
  textureProbe(name: string, seed: number): { hash: number; seamX: number; seamY: number; innerX: number; innerY: number };
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

function pixelsOf(c: HTMLCanvasElement): Uint8ClampedArray {
  return c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
}

/** 결정성 해시 + 이어짐 지표: 가장자리(마지막→처음) 평균 차이와, 내부에서 가장 큰 인접 줄 평균 차이 */
function probe(c: HTMLCanvasElement) {
  const d = pixelsOf(c);
  const n = c.width;
  let hash = 0;
  for (let i = 0; i < d.length; i += 4) hash = (Math.imul(hash, 31) + d[i]) >>> 0;
  const at = (x: number, y: number) => d[4 * (y * n + x)];
  const colDiff = (a: number, b: number) => {
    let s = 0;
    for (let k = 0; k < n; k++) s += Math.abs(at(a, k) - at(b, k));
    return s / n;
  };
  const rowDiff = (a: number, b: number) => {
    let s = 0;
    for (let k = 0; k < n; k++) s += Math.abs(at(k, a) - at(k, b));
    return s / n;
  };
  let innerX = 0;
  let innerY = 0;
  for (let i = 0; i + 1 < n; i++) {
    innerX = Math.max(innerX, colDiff(i, i + 1));
    innerY = Math.max(innerY, rowDiff(i, i + 1));
  }
  return { hash, seamX: colDiff(n - 1, 0), seamY: rowDiff(n - 1, 0), innerX, innerY };
}

async function composeSwatch(def: SceneDef, provider: ReturnType<typeof createP5Provider>) {
  void provider;
  const defs = [...textureRegistry().values()];
  const cell = 256;
  const cols = 4;
  const label = 22;
  const rowsT = Math.ceil(defs.length / cols);
  const bw = 256;
  const bh = 144;
  const out = document.createElement('canvas');
  out.width = cols * cell;
  out.height = rowsT * (cell + label) + bh + label;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.font = '14px sans-serif';
  defs.forEach((d, i) => {
    const c = paintWithP5(SURFACE_SIZE, SURFACE_SIZE, 7, (p) => d.draw(p, { seed: 7, size: SURFACE_SIZE }));
    const x = (i % cols) * cell;
    const y = Math.floor(i / cols) * (cell + label);
    for (const dx of [0, 1]) for (const dy of [0, 1]) ctx.drawImage(c, x + (dx * cell) / 2, y + (dy * cell) / 2, cell / 2, cell / 2);
    ctx.fillStyle = '#eee';
    ctx.fillText(`${d.name} (${d.tile}m)`, x + 6, y + cell + 16);
  });
  const style = getStyle(def.style);
  const y0 = rowsT * (cell + label);
  BACKGROUND_PRESETS.forEach((pr, i) => {
    const colors = presetColors(style, pr);
    const c = paintWithP5(1024, 576, 7, (p) => drawBg(p, colors, pr === 'sunset'));
    ctx.drawImage(c, i * bw, y0, bw, bh);
    ctx.fillStyle = '#eee';
    ctx.fillText(`background: ${pr}`, i * bw + 6, y0 + bh + 16);
  });
  return { png: out.toDataURL('image/png'), textures: defs.map((d) => d.name), backgrounds: [...BACKGROUND_PRESETS] };
}

const drawBg = (p: Parameters<typeof drawMeshGradient>[0], colors: string[], sun: boolean) => drawMeshGradient(p, { w: 1024, h: 576, colors, sun });

export function boot(def: SceneDef): void {
  const qs = new URLSearchParams(location.search);
  const capture = qs.get('capture') === '1';
  const quality = qs.get('quality') === 'final' ? 'final' : 'preview';
  const ssParam = Number(qs.get('ss'));
  const ss = Number.isFinite(ssParam) && ssParam >= 1 ? ssParam : quality === 'final' ? 2 : 1;
  document.body.classList.toggle('kit-capture', capture);

  let pipeline: Pipeline | null = null;
  const provider = createP5Provider();
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
    swatch: () => composeSwatch(def, provider),
    textureProbe: (name, seed) => {
      const d = textureRegistry().get(name);
      if (!d) throw new Error(`알 수 없는 텍스처 '${name}'`);
      return probe(paintWithP5(SURFACE_SIZE, SURFACE_SIZE, seed, (p) => d.draw(p, { seed, size: SURFACE_SIZE })));
    },
  };
}
