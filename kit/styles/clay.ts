import * as THREE from 'three';
import { FONT_STACK, type Look, type MaterialOpts, type SkyColors, type Style } from '../runtime/style';
import type { Role, SkyPreset } from '../runtime/types';

/** movie2 계열: 아이소메트릭 클레이, 파랑·흰색 단색 팔레트 */
const PALETTE: Record<Role, string> = {
  ground: '#e6e9fb',
  road: '#d0d8f4',
  body: '#3f6cf0',
  bodyLight: '#94adf7',
  trim: '#ffffff',
  dark: '#27315c',
  accent: '#ffb020',
  accent2: '#3f6cf0',
  accent3: '#9fd4bd',
  cargo: '#d2a679',
  wood: '#b98a5e',
  foliage: '#6f8ff0',
  trunk: '#8a93c2',
  water: '#9db8f5',
  neutral: '#ffffff',
  label: '#1d2550',
};

const BASE: SkyColors = {
  top: '#d9def8',
  horizon: '#eceefc',
  bottom: '#e6e9fb',
  sun: '#ffffff',
  fog: '#e8eafb',
  ambient: '#eef0ff',
  sunIntensity: 2.6,
  ambientIntensity: 1.25,
  sunDir: [0.55, 0.85, 0.35],
};

const SKIES: Record<SkyPreset, SkyColors> = {
  dawn: { ...BASE, sun: '#fff1e2', sunDir: [-0.6, 0.6, 0.45] },
  day: BASE,
  dusk: { ...BASE, top: '#c9c3ea', horizon: '#ece0f2', sun: '#ffe2c8', sunIntensity: 2.2, sunDir: [0.7, 0.45, -0.35] },
  night: { ...BASE, top: '#283463', horizon: '#3b4780', bottom: '#2f3a6c', fog: '#2f3a6c', ambient: '#8c9be0', sun: '#c8d4ff', sunIntensity: 1.1, ambientIntensity: 0.8 },
};

const LOOK: Look = {
  shadows: true,
  ao: { intensity: 1, radius: 0.9 },
  bloom: { strength: 0.25, radius: 0.4, threshold: 0.9 },
  toneMapping: 'neutral',
  envIntensity: 0.45,
};

export const clay: Style = {
  name: 'clay',
  look: LOOK,
  palette: PALETTE,
  fogDensity: 0.0025,
  labelFont: FONT_STACK,
  sky: (p) => SKIES[p],
  material(role: Role, o: MaterialOpts = {}) {
    return new THREE.MeshStandardMaterial({
      color: o.vertexColors ? '#ffffff' : PALETTE[role],
      roughness: role === 'dark' ? 0.4 : role === 'trim' ? 0.5 : 0.62,
      metalness: 0,
      vertexColors: !!o.vertexColors,
      transparent: !!o.transparent,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    });
  },
};
