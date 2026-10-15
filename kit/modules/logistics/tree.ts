import { buildByRole, cone, cyl, place, sphere, type Part } from '../../parts';
import { defineElement } from '../../runtime/element';
import { num, pick } from './common';

/** 나무: round(막대사탕) | cone(침엽수), 선택적 둥근 화단(pad) */
export const tree = defineElement({
  type: 'tree',
  create(ctx, params) {
    const kind = pick('tree', 'kind', params.kind, ['round', 'cone'] as const, 'round');
    const H = num(params.height, 3);
    const parts: Part[] = [{ role: 'trunk', geo: cyl(0.12, 0.16, H * 0.45, 12) }];
    if (kind === 'round') parts.push({ role: 'foliage', geo: place(sphere(H * 0.3), 0, H * 0.38, 0) });
    else parts.push({ role: 'foliage', geo: place(cone(H * 0.28, H * 0.7), 0, H * 0.3, 0) });
    if (params.pad !== false) parts.push({ role: 'accent3', geo: cyl(0.85, 0.85, 0.1, 32) });
    const built = buildByRole(ctx.style, parts);
    return { object3d: built.group, dispose: built.dispose };
  },
});
