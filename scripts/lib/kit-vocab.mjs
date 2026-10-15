import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 스토리보드 프롬프트 제약. 키트별 문구는 kit/modules/<kit>/vocab.json (키트 추가 시 이 파일은 고치지 않는다) */
export const KIT_ROOT = fileURLToPath(new URL('../../kit/modules/', import.meta.url));
/** scene의 아이소 방향 target + [45, 67, 78]: 방위 30°, 고도 약 37° */
export const CAMERA_ISO = 'Orthographic isometric view (no perspective distortion), looking from the front-right about 30° off the front face, elevated about 37°.';

/** 원근 디오라마(동화 키트 등): 높은 3/4 앵글의 미니어처 모형 */
export const CAMERA_DIORAMA = 'Perspective miniature diorama view from a high three-quarter angle, the whole scene reads like a small handcrafted model, gentle tilt-shift depth of field.';

const isStr = (v) => typeof v === 'string' && v.length > 0;

export function loadKits(root = KIT_ROOT) {
  const kits = new Map();
  for (const name of readdirSync(root).sort()) {
    const file = join(root, name, 'vocab.json');
    if (!existsSync(file)) continue;
    const where = `${name}/vocab.json`;
    let v;
    try {
      v = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      throw new Error(`${where}: JSON 형식 오류 (${e.message})`);
    }
    if (!isStr(v?.label)) throw new Error(`${where}: label은 비어 있지 않은 문자열`);
    if (typeof v.objects !== 'object' || v.objects === null || Array.isArray(v.objects) || !Object.keys(v.objects).length || !Object.values(v.objects).every(isStr)) {
      throw new Error(`${where}: objects는 { type: 구문 } 1개 이상`);
    }
    if (!Array.isArray(v.avoid) || !v.avoid.every(isStr)) throw new Error(`${where}: avoid는 문자열 배열`);
    kits.set(name, { label: v.label, objects: v.objects, avoid: v.avoid });
  }
  return kits;
}

const pick = (kits, root) => {
  const all = loadKits(root);
  return kits.map((k) => {
    const v = all.get(k);
    if (!v) throw new Error(`알 수 없는 키트 '${k}'. 사용 가능: ${[...all.keys()].join(', ')}`);
    return v;
  });
};

export function vocabSentence(kits = ['logistics'], root = KIT_ROOT) {
  const sel = pick(kits, root);
  const objects = [...new Set(sel.flatMap((v) => Object.values(v.objects)))];
  const avoid = sel[0].avoid.filter((a) => sel.every((v) => v.avoid.includes(a)));
  return `Only depict objects from this list: ${objects.join(', ')}.${avoid.length ? ` Do not include: ${avoid.join(', ')}.` : ''}`;
}

export function kitTypes(kits, root = KIT_ROOT) {
  return [...new Set(pick(kits, root).flatMap((v) => Object.keys(v.objects)))];
}
