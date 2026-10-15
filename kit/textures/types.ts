import type p5 from 'p5';
import type * as THREE from 'three';

/**
 * 표면 질감 정의: p5로 size×size 회색조(평균 ≈ 128) 반복 텍스처를 그린다.
 * 결정성: 호출 전에 randomSeed·noiseSeed가 설정된다. p.random·p.noise만 쓰고 frameCount·millis·Math.random 금지.
 * 이어짐: 가장자리를 넘는 획은 반대편에도 그린다(wrap 도우미 사용).
 */
export interface TextureDef {
  name: string;
  /** 한 장이 덮는 길이(m) 기본값 */
  tile: number;
  draw(p: p5, o: { seed: number; size: number }): void;
}

export type BackgroundKind = 'meshGradient';
export type BackgroundPreset = 'dawn' | 'day' | 'dusk' | 'sunset';
export interface BackgroundSpec {
  kind: BackgroundKind;
  preset?: BackgroundPreset;
  colors?: string[];
  sun?: boolean;
  seed?: number;
}

/** 렌더러가 world에 주입한다(브라우저 = p5, 노드 테스트 = 가짜). 텍스처는 provider 소유 */
export interface TextureProvider {
  surface(def: TextureDef, seed: number): THREE.Texture;
  background(spec: BackgroundSpec, colors: string[], aspect: number, seed: number): THREE.Texture;
  dispose(): void;
}

export function defineTexture(def: TextureDef): TextureDef {
  if (typeof def?.name !== 'string' || !/^[a-z0-9-]+$/.test(def.name)) throw new Error(`defineTexture: name은 영문 소문자·숫자·대시 (받은 값 ${String(def?.name)})`);
  if (typeof def.tile !== 'number' || !Number.isFinite(def.tile) || def.tile <= 0) throw new Error(`defineTexture(${def.name}): tile은 양수(m)`);
  if (typeof def.draw !== 'function') throw new Error(`defineTexture(${def.name}): draw(p, { seed, size }) 함수가 필요함`);
  return def;
}
