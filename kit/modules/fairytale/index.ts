import type { ElementType } from '../../runtime/types';
import { bridge } from './bridge';
import { castle } from './castle';
import { cloud } from './cloud';
import { cottage } from './cottage';
import { fairytree } from './fairytree';
import { fence } from './fence';
import { field } from './field';
import { flowers } from './flowers';
import { island } from './island';
import { mushroom } from './mushroom';
import { path } from './path';
import { plateau } from './plateau';
import { river } from './river';
import { rock } from './rock';
import { waterfall } from './waterfall';
import { windmill } from './windmill';

/** 동화 키트: pastel 스타일과 함께 쓰는 동화 디오라마 */
export const FAIRYTALE_ELEMENTS: readonly ElementType[] = [
  island, plateau, rock, river, waterfall, path, bridge,
  castle, cottage, mushroom, windmill,
  fairytree, flowers, field, fence, cloud,
];
