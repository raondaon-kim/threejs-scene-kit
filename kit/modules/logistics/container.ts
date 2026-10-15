import { buildByRole, place, roundedBox, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num } from './common';

/** 해운 컨테이너: 길이 6(20ft) | 12(40ft) m, 측면 리브, 뒷문(-Z) */
export const container = defineElement({
  type: 'container',
  create(ctx, params) {
    const L = num(params.length, 12);
    if (L !== 6 && L !== 12) throw new Error(`container.params.length ${L}은 지원하지 않음. 가능: 6|12`);
    const parts: Part[] = [{ role: 'bodyLight', geo: roundedBox(2.44, 2.6, L, 0.08) }];
    const n = Math.floor(L / 0.7);
    for (let i = 1; i < n; i++) {
      parts.push({ role: 'bodyLight', geo: place(roundedBox(2.56, 2.3, 0.12, 0.03), 0, 0.15, -L / 2 + i * (L / n)) });
    }
    parts.push({ role: 'dark', geo: place(roundedBox(2.2, 2.3, 0.06, 0.02), 0, 0.15, -L / 2 - 0.02) });
    const built = buildByRole(ctx.style, parts);
    return { object3d: built.group, dispose: built.dispose };
  },
});
