import { defineScene } from './kit/runtime/scene';

export default defineScene({
  meta: { width: 1080, height: 1920, fps: 30, duration: 12, seed: 7 },
  style: 'stylized',
  environment: {
    sky: { preset: 'dawn' },
    terrain: { size: 200, height: 10, roughness: 0.5, flatRadius: 15 },
    trees: { count: 220, area: 170, avoidCenter: 18 },
    water: { level: -1.5 },
  },
  elements: [
    { id: 'title', type: 'label', at: [0, 10, 0], params: { text: '빛은 어떻게\n에너지가 될까?', size: 1.3, background: true },
      enter: { t: 0.5, anim: 'rise', dur: 0.8 }, exit: { t: 3.6, anim: 'fade', dur: 0.4 } },
    { id: 'sun', type: 'shape', at: [-5, 9, -2], params: { kind: 'sphere', size: 2.4, role: 'accent2' },
      enter: { t: 4.2, anim: 'pop', dur: 0.6 } },
    { id: 'ray', type: 'arrow', at: [-3.9, 8, -1.5], params: { to: [4.6, -5.6, 1.5], thickness: 0.1, role: 'accent2' },
      enter: { t: 4.8, anim: 'grow', dur: 1.2 } },
    { id: 'leaf', type: 'shape', at: [1.2, 1.2, 0], rotation: [0, 0, -15], params: { kind: 'cone', size: 2.6, role: 'accent3' },
      enter: { t: 5.4, anim: 'pop', dur: 0.6 } },
    { id: 'chartTitle', type: 'label', at: [0, 7.4, 2], params: { text: '시간대별 광합성량', size: 0.8 },
      enter: { t: 8.1, anim: 'fade', dur: 0.5 } },
    { id: 'chart', type: 'bars', at: [0, 0.6, 2], params: { values: [2, 5, 8], labels: ['아침', '정오', '오후'], maxHeight: 5 },
      enter: { t: 8.3, anim: 'grow', dur: 1.4 } },
  ],
  shots: [
    { id: 'open', start: 0, end: 4, camera: { move: 'dolly', from: [0, 10, 44], to: [0, 9, 26], target: [0, 7, 0] } },
    { id: 'concept', start: 4, end: 8, camera: { move: 'orbit', center: [-1, 5, 0], radius: 17, height: 2, fromDeg: -25, toDeg: 15 } },
    { id: 'chart', start: 8, end: 12, camera: { move: 'dolly', from: [0, 5, 19], to: [0, 4.6, 14], target: [0, 3.4, 2] } },
  ],
});
