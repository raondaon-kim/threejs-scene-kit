import * as THREE from 'three';
import { FONT_STACK, type MaterialOpts, type SkyColors, type Style } from '../runtime/style';
import type { Role, SkyPreset } from '../runtime/types';

const PALETTE: Record<Role, string> = {
  ground: '#7bb661',
  foliage: '#3f8f4f',
  trunk: '#7a5236',
  water: '#4fa3c7',
  accent: '#ff7a59',
  accent2: '#ffd166',
  accent3: '#5ec2b7',
  neutral: '#f2efe9',
  label: '#2b2d42',
};

const SKIES: Record<SkyPreset, SkyColors> = {
  dawn: { top: '#7f8fd6', horizon: '#ffc4a3', bottom: '#ffe1c6', sun: '#ffd2a1', fog: '#f6c9b0', ambient: '#c9b6e4', sunIntensity: 2.2, ambientIntensity: 1.1, sunDir: [-0.6, 0.35, 0.5] },
  day: { top: '#4f9be8', horizon: '#bfe3ff', bottom: '#e8f6ff', sun: '#fff3d6', fog: '#cfe8fa', ambient: '#bcdcff', sunIntensity: 2.8, ambientIntensity: 1.2, sunDir: [0.4, 0.8, 0.3] },
  dusk: { top: '#3b3b7a', horizon: '#ff8a5c', bottom: '#ffb38a', sun: '#ff9a5c', fog: '#d98a7a', ambient: '#8a6fb3', sunIntensity: 2.0, ambientIntensity: 0.9, sunDir: [0.7, 0.2, -0.3] },
  night: { top: '#0b1030', horizon: '#26305e', bottom: '#323d73', sun: '#9fb4ff', fog: '#1e2650', ambient: '#3a4a8a', sunIntensity: 0.9, ambientIntensity: 0.7, sunDir: [-0.3, 0.6, 0.4] },
};

let gradient: THREE.DataTexture | null = null;
function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export const stylized: Style = {
  name: 'stylized',
  palette: PALETTE,
  fogDensity: 0.012,
  labelFont: FONT_STACK,
  sky: (p) => SKIES[p],
  material(role: Role, o: MaterialOpts = {}) {
    return new THREE.MeshToonMaterial({
      color: o.vertexColors ? '#ffffff' : PALETTE[role],
      gradientMap: toonGradient(),
      vertexColors: !!o.vertexColors,
      transparent: !!o.transparent,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    });
  },
};
