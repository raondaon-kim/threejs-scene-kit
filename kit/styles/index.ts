import type { Style } from '../runtime/style';
import type { StyleName } from '../runtime/types';
import { minimal } from './minimal';
import { stylized } from './stylized';

const STYLES: Record<StyleName, Style> = { stylized, minimal };

export function getStyle(name: StyleName): Style {
  const s = STYLES[name];
  if (!s) throw new Error(`알 수 없는 스타일: ${name}`);
  return s;
}
