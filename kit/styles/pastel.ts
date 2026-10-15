import * as THREE from 'three';
import { FONT_STACK, type Look, type MaterialOpts, type SkyColors, type Style } from '../runtime/style';
import type { Role, SkyPreset } from '../runtime/types';

/** 동화 디오라마: 파스텔 클레이 (clay와 같은 렌더 룩, 따뜻한 동화 팔레트) */
const PALETTE: Record<Role, string> = {
  ground: '#9cc97a',
  foliage: '#86bf6a',
  trunk: '#9a6b4f',
  water: '#8ed6f2',
  rock: '#c9b9ae',
  road: '#ead2a8',
  body: '#f6ead6',
  bodyLight: '#fbf3e6',
  trim: '#ffffff',
  dark: '#5b4a5e',
  roof: '#f2a48a',
  roofAlt: '#a98ae0',
  accent: '#f6d26b',
  accent2: '#ec7b74',
  accent3: '#c7a6ec',
  cargo: '#f0c95e',
  wood: '#b98b62',
  neutral: '#ddd3c8',
  label: '#4a3a55',
};

const BASE: SkyColors = {
  top: '#a9b8ee',
  horizon: '#f6c9d6',
  bottom: '#c9cff2',
  sun: '#fff0d6',
  fog: '#f3d9e4',
  ambient: '#fff4ec',
  sunIntensity: 2.4,
  ambientIntensity: 0.6,
  sunDir: [-0.6, 0.55, 0.35],
};

const SKIES: Record<SkyPreset, SkyColors> = {
  dawn: { ...BASE, top: '#b7c4f2', sun: '#fff3e6' },
  day: BASE,
  dusk: { ...BASE, top: '#b3a6e6', horizon: '#ffc6a8', sun: '#ffd9b0', sunIntensity: 2.2, sunDir: [-0.7, 0.4, 0.3] },
  night: { ...BASE, top: '#2e3266', horizon: '#5a4d8a', bottom: '#3b3770', fog: '#3b3770', ambient: '#9c94d8', sun: '#cfd6ff', sunIntensity: 1.1, ambientIntensity: 0.8 },
};

const LOOK: Look = {
  shadows: true,
  ao: { intensity: 1, radius: 0.9 },
  bloom: null,
  toneMapping: 'neutral',
  envIntensity: 0.22,
};

const ROUGH: Partial<Record<Role, number>> = { dark: 0.4, trim: 0.5, water: 0.25, rock: 0.8 };

export const pastel: Style = {
  name: 'pastel',
  look: LOOK,
  surfaces: {
    ground: 'grass-brush',
    rock: 'rock-grain',
    roof: 'roof-tiles',
    roofAlt: 'roof-tiles',
    road: 'soil-pebbles',
    water: { texture: 'water-ripple', flow: [0, 0.25] },
    wood: 'wood-grain',
    body: 'paper',
    bodyLight: 'paper',
  },
  surfaceStrength: 0.35,
  palette: PALETTE,
  fogDensity: 0.0008,
  labelFont: FONT_STACK,
  sky: (p) => SKIES[p],
  material(role: Role, o: MaterialOpts = {}) {
    return new THREE.MeshStandardMaterial({
      color: o.vertexColors ? '#ffffff' : PALETTE[role],
      roughness: ROUGH[role] ?? 0.62,
      metalness: 0,
      vertexColors: !!o.vertexColors,
      transparent: !!o.transparent,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    });
  },
};
