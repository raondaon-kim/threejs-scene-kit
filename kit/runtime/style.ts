import * as THREE from 'three';
import type { Role, SkyPreset, StyleName, Vec3 } from './types';

export interface SkyColors {
  top: string;
  horizon: string;
  bottom: string;
  sun: string;
  fog: string;
  ambient: string;
  sunIntensity: number;
  ambientIntensity: number;
  sunDir: Vec3;
}

export interface MaterialOpts {
  vertexColors?: boolean;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
}

/** 렌더 파이프라인 설정 (pipeline.ts가 사용) */
export interface Look {
  shadows: boolean;
  ao: { intensity: number; radius: number } | null;
  bloom: { strength: number; radius: number; threshold: number } | null;
  toneMapping: 'none' | 'neutral';
  /** RoomEnvironment IBL 세기. 0이면 끔 */
  envIntensity: number;
}

export const BASIC_LOOK: Look = { shadows: true, ao: { intensity: 0.6, radius: 0.6 }, bloom: null, toneMapping: 'none', envIntensity: 0 };

export interface Style {
  name: StyleName;
  look: Look;
  palette: Record<Role, string>;
  fogDensity: number;
  /** CSS font-family 스택 (라벨용) */
  labelFont: string;
  sky(preset: SkyPreset): SkyColors;
  /** 호출마다 새 인스턴스. 호출자가 dispose 책임. */
  material(role: Role, opts?: MaterialOpts): THREE.Material;
}

export const FONT_STACK = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans CJK KR", sans-serif';

export function createLights(sky: SkyColors, style: Style): THREE.Light[] {
  const hemi = new THREE.HemisphereLight(sky.ambient, style.palette.ground, sky.ambientIntensity);
  const sun = new THREE.DirectionalLight(sky.sun, sky.sunIntensity);
  const d = new THREE.Vector3(...sky.sunDir).normalize().multiplyScalar(100);
  sun.position.copy(d);
  return [hemi, sun];
}
