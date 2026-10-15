import * as THREE from 'three';
import { clamp01, ease } from '../../runtime/easing';
import { defineElement } from '../../runtime/element';
import { ELEMENT_ROLES, type Role } from '../../runtime/types';
import { createLabelMesh } from './label';
import { num } from './params';

export const bars = defineElement({
  type: 'bars',
  supportsGrow: true,
  create(ctx, params) {
    const values = params.values;
    if (!Array.isArray(values) || values.length === 0 || !values.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      throw new Error('bars.params.values는 숫자 배열이어야 함 (1개 이상)');
    }
    const labels = params.labels;
    if (labels !== undefined && (!Array.isArray(labels) || labels.length !== values.length)) {
      throw new Error('bars.params.labels는 values와 길이가 같은 문자열 배열이어야 함');
    }
    const roles: Role[] = Array.isArray(params.roles) && params.roles.every((r) => ELEMENT_ROLES.includes(r as Role))
      ? (params.roles as Role[])
      : ['accent', 'accent2', 'accent3'];
    const w = num(params.width, 1);
    const gap = num(params.gap, 0.4);
    const maxH = num(params.maxHeight, 5);
    const n = values.length;
    const max = Math.max(...values.map((v) => Math.abs(v)), 1e-6);
    const total = n * w + (n - 1) * gap;
    const geo = new THREE.BoxGeometry(w, 1, w);
    geo.translate(0, 0.5, 0);
    const group = new THREE.Group();
    const mats: THREE.Material[] = [];
    const meshes: THREE.Mesh[] = [];
    const heights: number[] = [];
    values.forEach((v, i) => {
      const mat = ctx.style.material(roles[i % roles.length]);
      mats.push(mat);
      const m = new THREE.Mesh(geo, mat);
      m.position.x = -total / 2 + w / 2 + i * (w + gap);
      group.add(m);
      meshes.push(m);
      heights.push(Math.max(1e-4, (Math.abs(v) / max) * maxH));
    });
    const labelParts = (labels as string[] | undefined)?.map((text, i) => {
      const l = createLabelMesh({ text: String(text), size: w * 0.45, color: ctx.style.palette.label, font: ctx.style.labelFont, background: null });
      l.mesh.position.set(meshes[i].position.x, -w * 0.4, w * 0.6);
      group.add(l.mesh);
      return l;
    }) ?? [];
    const s = n > 1 ? 0.5 / (n - 1) : 0;
    const setProgress = (p: number) => {
      meshes.forEach((b, i) => {
        const pi = clamp01(p * (1 + s * (n - 1)) - i * s);
        b.scale.y = Math.max(1e-4, heights[i] * ease('out', pi));
        b.visible = pi > 0;
      });
    };
    setProgress(1);
    return {
      object3d: group,
      setProgress,
      dispose() {
        geo.dispose();
        mats.forEach((m) => m.dispose());
        labelParts.forEach((l) => l.dispose());
      },
    };
  },
});
