import * as THREE from 'three';
import { arch, buildByRole, cone, cyl, place, roundedBox, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num } from './common';

/** 톱니(성가퀴): 길이 len 벽 위에 merlon을 늘어놓는다 (X 방향, 중심 0) */
function merlonsX(parts: Part[], len: number, y: number, z: number, t: number, ry = 0, cx = 0, cz = 0): void {
  const n = Math.max(2, Math.floor(len / 0.9));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (len / n) * (i + 0.5);
    const g = roundedBox(0.5, 0.5, t + 0.08, 0.06);
    g.translate(x, y, z);
    if (ry) g.rotateY(ry);
    g.translate(cx, 0, cz);
    parts.push({ role: 'neutral', geo: g });
  }
}

/** 원통 탑: 몸통 + 상단 링 + 톱니 + 라벤더 원뿔 지붕 + 창. 반환: 지붕 꼭대기 높이 */
function tower(parts: Part[], x: number, z: number, r: number, h: number): number {
  parts.push({ role: 'body', geo: place(cyl(r, r * 1.05, h, 28), x, 0, z) });
  parts.push({ role: 'neutral', geo: place(cyl(r * 1.18, r * 1.12, 0.45, 28), x, h - 0.1, z) });
  const n = Math.max(6, Math.round((Math.PI * 2 * r * 1.15) / 0.8));
  for (let i = 0; i < n; i += 2) {
    const a = (i / n) * Math.PI * 2;
    parts.push({ role: 'neutral', geo: place(roundedBox(0.4, 0.45, 0.4, 0.06), x + Math.cos(a) * r * 1.12, h + 0.3, z + Math.sin(a) * r * 1.12) });
  }
  const rh = r * 2.6;
  parts.push({ role: 'roofAlt', geo: place(cone(r * 1.22, rh), x, h + 0.3, z) });
  for (const yy of [h * 0.45, h * 0.75]) {
    parts.push({ role: 'dark', geo: place(roundedBox(0.32, 0.6, 0.2, 0.08), x, yy, z + r * 0.98) });
  }
  return h + 0.3 + rh;
}

/**
 * 성: 중앙 성채(높은 탑) + 모서리 원통 탑(라벤더 원뿔 지붕) + 톱니 성벽 + 아치 성문(+Z) + 깃발.
 * size 12, towers 4. update(t): 깃발 흔들림 (그룹 'flags')
 */
export const castle = defineElement({
  type: 'castle',
  create(ctx, params) {
    const S = Math.max(4, num(params.size, 12));
    const T = Math.max(0, Math.min(8, Math.round(num(params.towers, 4))));
    const parts: Part[] = [];
    const L = S * 0.8;
    const wallH = S * 0.32;
    const wt = 0.6;
    // 성채
    parts.push({ role: 'body', geo: roundedBox(S * 0.42, S * 0.5, S * 0.36, 0.25) });
    merlonsX(parts, S * 0.42, S * 0.5, S * 0.18, 0.2);
    const keepTop = tower(parts, S * 0.06, -S * 0.04, S * 0.1, S * 0.82);
    // 성벽 (앞면은 성문 자리를 비움)
    const gate = S * 0.18;
    const side = (L - gate) / 2;
    for (const s of [-1, 1]) {
      parts.push({ role: 'neutral', geo: place(roundedBox(side, wallH, wt, 0.12), s * (gate / 2 + side / 2), 0, L / 2) });
      merlonsX(parts, side, wallH, 0, wt, 0, s * (gate / 2 + side / 2), L / 2);
    }
    parts.push({ role: 'neutral', geo: place(roundedBox(L, wallH, wt, 0.12), 0, 0, -L / 2) });
    merlonsX(parts, L, wallH, 0, wt, 0, 0, -L / 2);
    for (const s of [-1, 1]) {
      parts.push({ role: 'neutral', geo: place(roundedBox(wt, wallH, L, 0.12), s * (L / 2), 0, 0) });
      merlonsX(parts, L, wallH, 0, wt, Math.PI / 2, s * (L / 2), 0);
    }
    // 성문: 아치 틀 + 어두운 문
    const gArch = arch(gate * 0.8, wallH * 0.55, gate * 0.1 + 0.25, wt + 0.3);
    gArch.translate(0, 0, L / 2);
    parts.push({ role: 'neutral', geo: gArch });
    parts.push({ role: 'dark', geo: place(roundedBox(gate * 0.8, wallH * 0.62, 0.2, 0.3), 0, 0, L / 2 - 0.05) });
    // 모서리 탑
    const tops: Array<[number, number, number]> = [[S * 0.06, keepTop, -S * 0.04]];
    for (let i = 0; i < T; i++) {
      const a = Math.PI / 4 + (i / Math.max(1, T)) * Math.PI * 2;
      const x = Math.cos(a) * (L / 2) * Math.SQRT2 * (T === 4 ? 1 : 0.85);
      const z = Math.sin(a) * (L / 2) * Math.SQRT2 * (T === 4 ? 1 : 0.85);
      tops.push([x, tower(parts, x, z, S * 0.085, wallH + S * 0.22), z]);
    }
    const built = buildByRole(ctx.style, parts);
    const group = new THREE.Group();
    group.add(built.group);
    // 깃발
    const flags = new THREE.Group();
    flags.name = 'flags';
    const owned: Array<{ dispose(): void }> = [built];
    tops.forEach(([x, y, z]) => {
      const f = buildByRole(ctx.style, [
        { role: 'trim', geo: cyl(0.04, 0.04, 1.0, 8) },
        { role: 'accent', geo: place(roundedBox(0.75, 0.42, 0.05, 0.02), 0.4, 0.55, 0) },
      ]);
      f.group.position.set(x, y - 0.1, z);
      flags.add(f.group);
      owned.push(f);
    });
    group.add(flags);
    return {
      object3d: group,
      update(t: number) {
        flags.children.forEach((c, i) => (c.rotation.y = 0.35 * Math.sin(2 * Math.PI * 0.6 * t + i)));
      },
      dispose: () => owned.forEach((o) => o.dispose()),
    };
  },
});
