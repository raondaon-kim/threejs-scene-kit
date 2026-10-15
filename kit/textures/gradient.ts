import type p5 from 'p5';
import type { Style } from '../runtime/style';
import type { SkyPreset } from '../runtime/types';
import type { BackgroundPreset } from './types';

/** 배경 프리셋 → 스타일 하늘색 [top, horizon, bottom, sun]. sunset은 dusk를 더 따뜻하게 */
export function presetColors(style: Style, preset: BackgroundPreset | SkyPreset): string[] {
  const sky = style.sky((preset === 'sunset' ? 'dusk' : preset) as SkyPreset);
  if (preset === 'sunset') return [sky.top, sky.horizon, '#ffd2b0', sky.bottom, sky.sun];
  return [sky.top, sky.horizon, sky.bottom, sky.sun];
}

/**
 * 메쉬 그라디언트: 위→아래 기본 그라디언트 위에 큰 색 덩어리(방사형)를 시드로 배치하고 흐리게 섞는다.
 * colors[0]=위, 마지막=아래 쪽으로 배치. sun이면 왼쪽 위에 해와 번짐.
 */
export function drawMeshGradient(p: p5, o: { w: number; h: number; colors: string[]; sun: boolean }): void {
  const { w, h, colors } = o;
  const ctx = p.drawingContext as CanvasRenderingContext2D;
  const lin = ctx.createLinearGradient(0, 0, 0, h);
  colors.forEach((c, i) => lin.addColorStop(colors.length === 1 ? 0 : i / (colors.length - 1), c));
  ctx.fillStyle = lin;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.filter = `blur(${Math.round(w * 0.04)}px)`;
  const blobs = Math.max(6, colors.length * 3);
  for (let i = 0; i < blobs; i++) {
    const ci = i % colors.length;
    const band = colors.length === 1 ? 0.5 : ci / (colors.length - 1);
    const x = p.random(-0.1, 1.1) * w;
    const y = (band + p.random(-0.22, 0.22)) * h;
    const r = p.random(0.25, 0.55) * Math.max(w, h);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(colors[ci], 0.55));
    g.addColorStop(1, hexA(colors[ci], 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  if (o.sun) {
    const sc = colors[colors.length - 1];
    const sx = w * 0.18;
    const sy = h * 0.2;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, w * 0.35);
    glow.addColorStop(0, hexA('#fff6e0', 0.95));
    glow.addColorStop(0.08, hexA('#fff1d6', 0.9));
    glow.addColorStop(0.1, hexA(sc, 0.55));
    glow.addColorStop(1, hexA(sc, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }
}

function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
