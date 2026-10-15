import * as THREE from 'three';
import { defineElement } from '../../runtime/element';
import { num, role } from './params';

export interface LabelOptions {
  text: string;
  /** 한 줄의 월드 높이(m) */
  size: number;
  color: string;
  font: string;
  background: string | null;
}

/** 캔버스 2D로 그린 텍스트 평면. 브라우저 전용(document 필요). */
export function createLabelMesh(o: LabelOptions): { mesh: THREE.Mesh; dispose(): void } {
  const px = 128;
  const lineH = px * 1.25;
  const pad = px * 0.35;
  const lines = o.text.split('\n');
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas 2d 컨텍스트를 만들 수 없음');
  const font = `700 ${px}px ${o.font}`;
  g.font = font;
  const w = Math.ceil(Math.max(...lines.map((l) => g.measureText(l).width)) + pad * 2);
  const h = Math.ceil(lineH * lines.length + pad * 2);
  canvas.width = w;
  canvas.height = h;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (o.background) {
    const r = Math.min(h / 2, lineH * 0.6);
    g.fillStyle = o.background;
    g.beginPath();
    g.roundRect(0, 0, w, h, r);
    g.fill();
  }
  g.fillStyle = o.color;
  lines.forEach((l, i) => g.fillText(l, w / 2, pad + lineH * (i + 0.5)));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const planeH = o.size * (h / lineH);
  const geo = new THREE.PlaneGeometry(planeH * (w / h), planeH);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 10;
  return {
    mesh,
    dispose() {
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}

export const label = defineElement({
  type: 'label',
  supportsGrow: false,
  create(ctx, params) {
    const text = typeof params.text === 'string' ? params.text : '';
    if (!text) throw new Error('label.params.text가 필요함');
    const r = role(params.role, 'label');
    const { mesh, dispose } = createLabelMesh({
      text,
      size: num(params.size, 1),
      color: ctx.style.palette[r],
      font: ctx.style.labelFont,
      background: params.background === true ? ctx.style.palette.neutral : null,
    });
    const billboard = params.billboard !== false;
    const q = new THREE.Quaternion();
    return {
      object3d: mesh,
      update() {
        if (!billboard) return;
        const parent = mesh.parent;
        if (parent) {
          parent.updateWorldMatrix(true, false);
          parent.getWorldQuaternion(q).invert();
        } else {
          q.identity();
        }
        mesh.quaternion.copy(q.multiply(ctx.camera.quaternion));
      },
      dispose,
    };
  },
});
