import { grassBrush } from './builtin/grass-brush';
import { paper } from './builtin/paper';
import { rockGrain } from './builtin/rock-grain';
import { roofTiles } from './builtin/roof-tiles';
import { soilPebbles } from './builtin/soil-pebbles';
import { waterRipple } from './builtin/water-ripple';
import { woodGrain } from './builtin/wood-grain';
import type { TextureDef } from './types';

export { defineTexture } from './types';
export type { BackgroundSpec, TextureDef, TextureProvider } from './types';
export { BUILTIN_TEXTURES, BACKGROUND_PRESETS } from './names';

/** 내장 텍스처 정의 (p5 런타임을 불러오지 않는다 — 그리기는 provider가) */
export const BUILTIN_TEXTURE_DEFS: readonly TextureDef[] = [grassBrush, rockGrain, roofTiles, soilPebbles, waterRipple, woodGrain, paper];

/** 내장 + 커스텀 정의 맵. 이름이 겹치면 오류 */
export function textureRegistry(custom: TextureDef[] = []): Map<string, TextureDef> {
  const m = new Map<string, TextureDef>();
  for (const d of BUILTIN_TEXTURE_DEFS) m.set(d.name, d);
  for (const d of custom) {
    if (m.has(d.name)) throw new Error(`커스텀 텍스처 '${d.name}'이 기존 이름과 겹침`);
    m.set(d.name, d);
  }
  return m;
}
