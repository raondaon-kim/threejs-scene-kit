import * as THREE from 'three';
import { buildByRole, roundedBox, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num } from './common';

/** 아치 다리의 윗면 높이 (x: 다리 중심 기준) */
function deckY(x: number, W: number, h0: number, hTop: number): number {
  return h0 + (hTop - h0) * Math.cos((Math.PI / 2) * Math.min(1, Math.abs(x) / W));
}

/**
 * 돌 아치 다리: 로컬 X 방향으로 걸친다(양 끝이 땅에 닿음). 아치 구멍 아래로 물이 흐른다.
 * span 7(아치 폭), width 2.4(다리 폭). 양쪽 낮은 난간.
 */
export const bridge = defineElement({
  type: 'bridge',
  create(ctx, params) {
    const span = Math.max(1.5, num(params.span, 7));
    const width = Math.max(0.8, num(params.width, 2.4));
    const W = span / 2 + 1.3;
    const rise = span * 0.26;
    const hTop = rise + 0.75;
    const h0 = 0.3;
    const seg = 28;
    const body = new THREE.Shape();
    body.moveTo(-W, 0);
    for (let i = 0; i <= seg; i++) {
      const x = -W + (2 * W * i) / seg;
      body.lineTo(x, deckY(x, W, h0, hTop));
    }
    body.lineTo(W, 0);
    for (let i = 0; i <= seg; i++) {
      const a = (Math.PI * i) / seg;
      body.lineTo((Math.cos(a) * span) / 2, Math.sin(a) * rise);
    }
    body.closePath();
    const geo = new THREE.ExtrudeGeometry(body, { depth: width, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
    geo.translate(0, 0.08, -width / 2); // bevel(0.08)만큼 올려 바닥 아래로 내려가지 않게
    const parts: Part[] = [{ role: 'neutral', geo }];
    // 난간: 윗면 곡선을 따라 낮은 벽
    const rail = new THREE.Shape();
    rail.moveTo(-W, deckY(-W, W, h0, hTop));
    for (let i = 0; i <= seg; i++) {
      const x = -W + (2 * W * i) / seg;
      rail.lineTo(x, deckY(x, W, h0, hTop) + 0.45);
    }
    for (let i = seg; i >= 0; i--) {
      const x = -W + (2 * W * i) / seg;
      rail.lineTo(x, deckY(x, W, h0, hTop));
    }
    rail.closePath();
    for (const s of [-1, 1]) {
      const r = new THREE.ExtrudeGeometry(rail, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
      r.translate(0, 0, s > 0 ? width / 2 - 0.24 : -width / 2);
      parts.push({ role: 'neutral', geo: r });
      for (const e of [-1, 1]) {
        const post = roundedBox(0.4, 0.75, 0.4, 0.08);
        post.translate(e * (W - 0.2), deckY(W, W, h0, hTop), s * (width / 2 - 0.12));
        parts.push({ role: 'rock', geo: post });
      }
    }
    // 아치 테두리 돌(쐐기돌 느낌)
    for (let i = 1; i < 10; i++) {
      const a = (Math.PI * i) / 10;
      const v = roundedBox(0.28, 0.42, width + 0.06, 0.05);
      v.rotateZ(a - Math.PI / 2);
      v.translate((Math.cos(a) * (span / 2 + 0.12)), Math.sin(a) * (rise + 0.12) - 0.2, 0);
      parts.push({ role: 'rock', geo: v });
    }
    const built = buildByRole(ctx.style, parts);
    return { object3d: built.group, dispose: built.dispose };
  },
});
