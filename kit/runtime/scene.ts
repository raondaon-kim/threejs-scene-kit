import type { SceneDef } from './types';

export type { SceneDef } from './types';

/** 장면 정의. 타입 검사와 자동완성을 위한 항등 함수. */
export function defineScene(def: SceneDef): SceneDef {
  return def;
}
