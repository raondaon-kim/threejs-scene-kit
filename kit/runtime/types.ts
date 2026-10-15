import type * as THREE from 'three';
import type { EaseName } from './easing';
import type { Style } from './style';

export type Vec3 = [number, number, number];

export type Role = 'ground' | 'foliage' | 'trunk' | 'water' | 'accent' | 'accent2' | 'accent3' | 'neutral' | 'label';
/** 장면 요소(params.role)에 쓸 수 있는 역할 */
export const ELEMENT_ROLES: readonly Role[] = ['accent', 'accent2', 'accent3', 'neutral', 'label'];

export type StyleName = 'stylized' | 'minimal';
export const STYLE_NAMES: readonly StyleName[] = ['stylized', 'minimal'];

export type SkyPreset = 'dawn' | 'day' | 'dusk' | 'night';
export const SKY_PRESETS: readonly SkyPreset[] = ['dawn', 'day', 'dusk', 'night'];

export type AnimName = 'none' | 'fade' | 'pop' | 'rise' | 'grow';
export const ANIMS: readonly AnimName[] = ['none', 'fade', 'pop', 'rise', 'grow'];

export type TrackPath =
  | 'position.x' | 'position.y' | 'position.z'
  | 'rotation.x' | 'rotation.y' | 'rotation.z'
  | 'scale' | 'opacity';
export const TRACK_PATHS: readonly TrackPath[] = [
  'position.x', 'position.y', 'position.z', 'rotation.x', 'rotation.y', 'rotation.z', 'scale', 'opacity',
];

export interface Cue {
  t: number;
  anim: AnimName;
  dur?: number;
}

export interface ElementDef {
  id: string;
  type: string;
  at?: Vec3;
  rotation?: Vec3;
  scale?: number;
  params?: Record<string, unknown>;
  enter?: Cue;
  exit?: Cue;
  /** 값은 절대값: position/rotation(도)/scale은 덮어쓰기, opacity는 곱하기 */
  tracks?: Partial<Record<TrackPath, Array<[number, number]>>>;
}

export type CameraMove =
  | { move: 'static'; pos: Vec3; target: Vec3; fov?: number }
  | { move: 'dolly' | 'crane'; from: Vec3; to: Vec3; target: Vec3; targetTo?: Vec3; ease?: EaseName; fov?: number }
  | { move: 'orbit'; center: Vec3; radius: number; height: number; fromDeg: number; toDeg: number; ease?: EaseName; fov?: number };
export const CAMERA_MOVES = ['static', 'dolly', 'orbit', 'crane'] as const;

export interface ShotDef {
  id: string;
  start: number;
  end: number;
  camera: CameraMove;
}

export interface EnvironmentDef {
  sky?: { preset?: SkyPreset };
  terrain?: { size?: number; height?: number; roughness?: number; flatRadius?: number };
  trees?: { count?: number; area?: number; avoidCenter?: number };
  water?: { level?: number; size?: number };
}

export interface SceneMeta {
  width: number;
  height: number;
  fps: number;
  duration: number;
  seed: number;
}

export interface SceneDef {
  meta: SceneMeta;
  style: StyleName;
  environment?: EnvironmentDef;
  elements?: ElementDef[];
  shots: ShotDef[];
  custom?: ElementType[];
}

export type Quality = 'preview' | 'final';

/** 모든 요소·환경 모듈이 반환하는 핸들. 상태는 절대시간 t의 순수함수여야 한다. */
export interface ElementHandle {
  object3d: THREE.Object3D;
  update?(t: number): void;
  setProgress?(p: number): void;
  setOpacity?(o: number): void;
  dispose(): void;
}

export interface KitContext {
  style: Style;
  rng(salt: string): () => number;
  heightAt(x: number, z: number): number;
  quality: Quality;
  camera: THREE.PerspectiveCamera;
}

export interface ElementType {
  type: string;
  supportsGrow?: boolean;
  create(ctx: KitContext, params: Record<string, unknown>): ElementHandle;
}
