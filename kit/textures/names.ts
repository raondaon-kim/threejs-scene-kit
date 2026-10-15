/** 내장 텍스처 이름 (p5를 불러오지 않는 검증기용 목록) */
export const BUILTIN_TEXTURES = ['grass-brush', 'rock-grain', 'roof-tiles', 'soil-pebbles', 'water-ripple', 'wood-grain', 'paper'] as const;
export type BuiltinTexture = (typeof BUILTIN_TEXTURES)[number];

export const BACKGROUND_PRESETS = ['dawn', 'day', 'dusk', 'sunset'] as const;
