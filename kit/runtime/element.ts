import type { ElementType } from './types';

/** 커스텀 요소 정의. create는 ElementHandle을 반환하고, 상태는 t의 순수함수여야 한다. */
export function defineElement(def: ElementType): ElementType {
  return def;
}
