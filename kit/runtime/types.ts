import type * as THREE from 'three';
import type { EaseName } from './easing';
import type { Style } from './style';
import type { TextureDef } from '../textures/types';

export type Vec3 = [number, number, number];

export type Role =
  | 'ground' | 'foliage' | 'trunk' | 'water' | 'accent' | 'accent2' | 'accent3' | 'neutral' | 'label'
  | 'body' | 'bodyLight' | 'trim' | 'dark' | 'road' | 'cargo' | 'wood'
  | 'rock' | 'roof' | 'roofAlt';
export const ALL_ROLES: readonly Role[] = [
  'ground', 'foliage', 'trunk', 'water', 'accent', 'accent2', 'accent3', 'neutral', 'label',
  'body', 'bodyLight', 'trim', 'dark', 'road', 'cargo', 'wood',
  'rock', 'roof', 'roofAlt',
];
/** 장면 요소(params.role)에 쓸 수 있는 역할 */
export const ELEMENT_ROLES: readonly Role[] = ALL_ROLES;

export type StyleName = 'stylized' | 'minimal' | 'clay' | 'pastel';
export const STYLE_NAMES: readonly StyleName[] = ['stylized', 'minimal', 'clay', 'pastel'];

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

/** 'param.<name>': 요소가 animatable로 선언한 파라미터 */
export type TrackKey = TrackPath | `param.${string}`;

export interface FollowDef {
  /** [x, z] 점 목록 (2개 이상). centripetal Catmull-Rom, 호 길이 기준 진행 */
  path: Array<[number, number]>;
  t0: number;
  t1: number;
  ease?: EaseName;
}

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
  /** 값은 절대값: position/rotation(도)/scale은 덮어쓰기, opacity는 곱하기, param.*는 setParam */
  tracks?: Partial<Record<TrackKey, Array<[number, number]>>>;
  /** 경로 이동: x·z와 방향(yaw)을 덮어쓰고 이동 거리를 setParam('travel')로 전달 */
  follow?: FollowDef;
}

/** size·sizeTo: ortho 카메라의 화면 세로 높이(m). 샷 안에서 같은 ease로 보간 */
interface CameraCommon {
  fov?: number;
  size?: number;
  sizeTo?: number;
}
export type CameraMove =
  | ({ move: 'static'; pos: Vec3; target: Vec3 } & CameraCommon)
  | ({ move: 'dolly' | 'crane'; from: Vec3; to: Vec3; target: Vec3; targetTo?: Vec3; ease?: EaseName } & CameraCommon)
  | ({ move: 'orbit'; center: Vec3; radius: number; height: number; fromDeg: number; toDeg: number; ease?: EaseName } & CameraCommon)
  | ({ move: 'path'; points: Vec3[]; target?: Vec3; targets?: Vec3[]; ease?: EaseName } & CameraCommon);
export const CAMERA_MOVES = ['static', 'dolly', 'orbit', 'crane', 'path'] as const;

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
  /** 평평한 바닥판 (clay 장면용) */
  ground?: { size?: number };
}

export interface SceneMeta {
  width: number;
  height: number;
  fps: number;
  duration: number;
  seed: number;
  projection?: 'perspective' | 'ortho';
}

/** 표면 질감 지정: 텍스처 이름 | 상세 | 'none'(끔) */
export interface SurfaceSpec {
  texture: string;
  /** 한 장이 덮는 길이(m). 없으면 텍스처 기본값 */
  tile?: number;
  /** 0~1 */
  strength?: number;
  /** 흐름 속도 [x, z] m/s (윗면 투영에만) */
  flow?: [number, number];
}
export type SurfaceRef = string | SurfaceSpec;

/** 장면 단위 룩 조정 (스타일 기본값을 덮어씀) */
export interface LookDef {
  surfaces?: Partial<Record<Role, SurfaceRef>>;
  strength?: number;
}

export interface SceneDef {
  meta: SceneMeta;
  style: StyleName;
  environment?: EnvironmentDef;
  elements?: ElementDef[];
  shots: ShotDef[];
  custom?: ElementType[];
  look?: LookDef;
  /** 프로젝트 custom/textures의 defineTexture 결과 */
  customTextures?: TextureDef[];
}

export type Quality = 'preview' | 'final';

/** 모든 요소·환경 모듈이 반환하는 핸들. 상태는 절대시간 t의 순수함수여야 한다. */
export interface ElementHandle {
  object3d: THREE.Object3D;
  update?(t: number): void;
  setProgress?(p: number): void;
  setOpacity?(o: number): void;
  /** animatable 파라미터(예: lift, travel). 값만으로 상태가 결정되어야 한다 */
  setParam?(name: string, value: number): void;
  dispose(): void;
}

export interface KitContext {
  style: Style;
  rng(salt: string): () => number;
  heightAt(x: number, z: number): number;
  quality: Quality;
  camera: THREE.Camera;
}

export interface ElementType {
  type: string;
  supportsGrow?: boolean;
  /** tracks의 'param.<name>'과 follow(travel)로 움직일 수 있는 파라미터 */
  animatable?: string[];
  create(ctx: KitContext, params: Record<string, unknown>): ElementHandle;
}
