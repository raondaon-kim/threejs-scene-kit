import type { ElementType } from '../../runtime/types';
import { building } from './building';
import { container } from './container';
import { forklift } from './forklift';
import { lot } from './lot';
import { pallet } from './pallet';
import { pin } from './pin';
import { road } from './road';
import { tree } from './tree';
import { truck } from './truck';
import { warehouse } from './warehouse';

export const LOGISTICS_ELEMENTS: readonly ElementType[] = [warehouse, truck, forklift, pallet, container, road, lot, tree, pin, building];
