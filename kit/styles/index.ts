import type { Style } from '../runtime/style';
import type { StyleName } from '../runtime/types';
import { clay } from './clay';
import { minimal } from './minimal';
import { pastel } from './pastel';
import { stylized } from './stylized';

const STYLES: Record<StyleName, Style> = { stylized, minimal, clay, pastel };

export function getStyle(name: StyleName): Style {
  const s = STYLES[name];
  if (!s) throw new Error(`알 수 없는 스타일: ${name}`);
  return s;
}
