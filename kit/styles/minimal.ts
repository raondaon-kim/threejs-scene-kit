import * as THREE from 'three';
import { BASIC_LOOK, FONT_STACK, type MaterialOpts, type SkyColors, type Style } from '../runtime/style';
import type { Role, SkyPreset } from '../runtime/types';

const PALETTE: Record<Role, string> = {
  ground: '#e9e6df',
  foliage: '#9fb8a5',
  trunk: '#b8a99a',
  water: '#a8c5d6',
  accent: '#2f6df6',
  accent2: '#f2a541',
  accent3: '#16a085',
  neutral: '#ffffff',
  body: '#2f6df6',
  bodyLight: '#9cb8f7',
  trim: '#ffffff',
  dark: '#2a2d34',
  road: '#d5d2cb',
  cargo: '#cfa77a',
  wood: '#a88a6a',
  label: '#1d1d1f',
  rock: '#9aa3ab',
  roof: '#e74c3c',
  roofAlt: '#8e44ad',
};

const SKIES: Record<SkyPreset, SkyColors> = {
  dawn: { top: '#d9dcef', horizon: '#f6ece6', bottom: '#f7f3ef', sun: '#fff1e6', fog: '#efe9e4', ambient: '#e6e3f0', sunIntensity: 2.0, ambientIntensity: 1.4, sunDir: [-0.6, 0.4, 0.5] },
  day: { top: '#dce7f2', horizon: '#f4f6f8', bottom: '#fafafa', sun: '#ffffff', fog: '#eef1f4', ambient: '#eef2f7', sunIntensity: 2.4, ambientIntensity: 1.5, sunDir: [0.4, 0.8, 0.3] },
  dusk: { top: '#cfc8e0', horizon: '#f3dccf', bottom: '#f6e9e0', sun: '#ffe2cc', fog: '#eadbd3', ambient: '#ddd3e6', sunIntensity: 1.8, ambientIntensity: 1.3, sunDir: [0.7, 0.25, -0.3] },
  night: { top: '#1c2230', horizon: '#2c3444', bottom: '#343d4f', sun: '#c8d4ff', fog: '#2a3140', ambient: '#4a5468', sunIntensity: 1.0, ambientIntensity: 0.9, sunDir: [-0.3, 0.6, 0.4] },
};

export const minimal: Style = {
  name: 'minimal',
  look: BASIC_LOOK,
  palette: PALETTE,
  fogDensity: 0.008,
  labelFont: FONT_STACK,
  sky: (p) => SKIES[p],
  material(role: Role, o: MaterialOpts = {}) {
    return new THREE.MeshStandardMaterial({
      color: o.vertexColors ? '#ffffff' : PALETTE[role],
      roughness: 0.6,
      metalness: 0,
      vertexColors: !!o.vertexColors,
      transparent: !!o.transparent,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    });
  },
};
