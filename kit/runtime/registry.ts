import { arrow } from '../modules/concept/arrow';
import { bars } from '../modules/concept/bars';
import { label } from '../modules/concept/label';
import { line } from '../modules/concept/line';
import { shape } from '../modules/concept/shape';
import type { ElementType } from './types';
import type { TypeInfo } from './validate';

export const BUILTIN_ELEMENTS: readonly ElementType[] = [shape, label, arrow, bars, line];

export function elementRegistry(custom: ElementType[] = []): Map<string, ElementType> {
  const m = new Map<string, ElementType>();
  for (const d of BUILTIN_ELEMENTS) m.set(d.type, d);
  for (const d of custom) {
    if (!d || typeof d.type !== 'string' || typeof d.create !== 'function') {
      throw new Error('custom 항목은 defineElement({ type, create })로 만든 값이어야 함');
    }
    if (m.has(d.type)) throw new Error(`커스텀 요소 type '${d.type}'이 기존 요소와 겹침`);
    m.set(d.type, d);
  }
  return m;
}

export function typeInfo(reg: Map<string, ElementType>): Map<string, TypeInfo> {
  return new Map([...reg].map(([k, d]) => [k, { supportsGrow: !!d.supportsGrow, animatable: d.animatable ?? [] }]));
}
