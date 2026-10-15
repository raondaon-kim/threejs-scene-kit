import type { ElementType } from '../../runtime/types';
import { arrow } from './arrow';
import { bars } from './bars';
import { label } from './label';
import { line } from './line';
import { shape } from './shape';

export const CONCEPT_ELEMENTS: readonly ElementType[] = [shape, label, arrow, bars, line];
