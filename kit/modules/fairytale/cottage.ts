import * as THREE from 'three';
import { buildByRole, cyl, place, prism, roundedBox, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num, pick } from './common';

/** 둥근 창: 어두운 원판 + 흰 테 (앞면 +Z를 향함) */
function roundWindow(parts: Part[], x: number, y: number, z: number, r: number): void {
  const frame = cyl(r * 1.25, r * 1.25, 0.08, 24);
  frame.rotateX(Math.PI / 2);
  frame.translate(x, y, z);
  parts.push({ role: 'trim', geo: frame });
  const glass = cyl(r, r, 0.1, 24);
  glass.rotateX(Math.PI / 2);
  glass.translate(x, y, z + 0.02);
  parts.push({ role: 'dark', geo: glass });
}

/**
 * 오두막: 크림 벽 + 박공지붕(앞뒤가 삼각벽, 기와 줄) + 굴뚝 + 둥근 창 + 나무 문 (+Z가 앞).
 * width 3.2, depth 2.6, roof 'roof'|'roofAlt'
 */
export const cottage = defineElement({
  type: 'cottage',
  create(ctx, params) {
    const w = Math.max(1.5, num(params.width, 3.2));
    const d = Math.max(1.5, num(params.depth, 2.6));
    const roofRole = pick('cottage', 'roof', params.roof, ['roof', 'roofAlt'] as const, 'roof');
    const wallH = 2.0;
    const gableH = w * 0.45;
    const parts: Part[] = [
      { role: 'neutral', geo: roundedBox(w + 0.12, 0.35, d + 0.12, 0.08) },
      { role: 'body', geo: roundedBox(w, wallH, d, 0.12) },
      { role: 'body', geo: place(prism(w, gableH, d), 0, wallH - 0.02, 0) },
    ];
    // 지붕 두 장(처마가 나오도록) + 기와 줄
    const half = w / 2 + 0.35;
    const slope = Math.atan2(gableH + 0.15, half);
    const slen = Math.hypot(half, gableH + 0.15);
    for (const s of [-1, 1]) {
      const slab = roundedBox(slen, 0.18, d + 0.6, 0.06);
      slab.translate(0, -0.09, 0);
      slab.rotateZ(s * -slope);
      slab.translate((s * half) / 2, wallH + (gableH + 0.15) / 2 - 0.05, 0);
      parts.push({ role: roofRole, geo: slab });
      for (let k = 1; k <= 4; k++) {
        const f = k / 5;
        const tile = roundedBox(0.09, 0.07, d + 0.6, 0.03);
        tile.rotateZ(s * -slope);
        const lx = s * half * (1 - f);
        const ly = wallH + (gableH + 0.15) * f - 0.05 + 0.06;
        tile.translate(lx, ly, 0);
        parts.push({ role: roofRole, geo: tile });
      }
    }
    parts.push({ role: roofRole, geo: place(roundedBox(0.3, 0.22, d + 0.65, 0.08), 0, wallH + gableH + 0.02, 0) });
    // 굴뚝
    parts.push({ role: 'neutral', geo: place(roundedBox(0.5, 1.5, 0.5, 0.08), w * 0.24, wallH + gableH * 0.35, -d * 0.18) });
    parts.push({ role: 'dark', geo: place(roundedBox(0.36, 0.1, 0.36, 0.04), w * 0.24, wallH + gableH * 0.35 + 1.46, -d * 0.18) });
    // 문·창
    parts.push({ role: 'wood', geo: place(roundedBox(0.75, 1.35, 0.14, 0.2), -w * 0.18, 0.2, d / 2) });
    roundWindow(parts, w * 0.24, 1.25, d / 2 + 0.02, 0.32);
    roundWindow(parts, 0, wallH + gableH * 0.38, d / 2 + 0.02, 0.26);
    for (const s of [-1, 1]) {
      const sw = cyl(0.28, 0.28, 0.08, 20);
      sw.rotateZ(Math.PI / 2);
      sw.translate(s * (w / 2 + 0.02), 1.25, 0);
      parts.push({ role: 'dark', geo: sw });
    }
    const built = buildByRole(ctx.style, parts);
    const group = new THREE.Group();
    group.add(built.group);
    return { object3d: group, dispose: built.dispose };
  },
});
