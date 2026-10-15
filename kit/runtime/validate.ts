import { EASES } from './easing';
import { ANIMS, CAMERA_MOVES, ELEMENT_ROLES, SKY_PRESETS, STYLE_NAMES, TRACK_PATHS, type TrackPath } from './types';

export interface Issue {
  path: string;
  message: string;
}
export interface TypeInfo {
  supportsGrow: boolean;
  animatable: string[];
}

type Err = (path: string, message: string) => void;
type Obj = Record<string, any>;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v: unknown): boolean => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (xs: readonly string[]) => xs.join('|');
const VEC = '[x, y, z] 숫자 3개여야 함';

function oneOf(err: Err, path: string, v: unknown, allowed: readonly string[]) {
  if (!allowed.includes(v as string)) err(path, `'${String(v)}'은 지원하지 않음. 가능: ${list(allowed)}`);
}

/** 오타로 인해 조용히 무시되는 설정을 막는다. params 내부는 요소마다 다르므로 검사하지 않는다. */
function knownKeys(err: Err, o: Obj, base: string, allowed: readonly string[]) {
  for (const k of Object.keys(o)) {
    if (!allowed.includes(k)) err(base ? `${base}.${k}` : k, `'${k}'은 알 수 없는 항목 (오타?). 가능: ${list(allowed)}`);
  }
}

const KEYS = {
  root: ['meta', 'style', 'environment', 'elements', 'shots', 'custom'],
  meta: ['width', 'height', 'fps', 'duration', 'seed', 'projection'],
  environment: ['sky', 'terrain', 'trees', 'water', 'ground'],
  ground: ['size'],
  sky: ['preset'],
  terrain: ['size', 'height', 'roughness', 'flatRadius'],
  trees: ['count', 'area', 'avoidCenter'],
  water: ['level', 'size'],
  element: ['id', 'type', 'at', 'rotation', 'scale', 'params', 'enter', 'exit', 'tracks', 'follow'],
  follow: ['path', 't0', 't1', 'ease'],
  cue: ['t', 'anim', 'dur'],
  shot: ['id', 'start', 'end', 'camera'],
  static: ['move', 'pos', 'target', 'fov', 'size', 'sizeTo'],
  dolly: ['move', 'from', 'to', 'target', 'targetTo', 'ease', 'fov', 'size', 'sizeTo'],
  orbit: ['move', 'center', 'radius', 'height', 'fromDeg', 'toDeg', 'ease', 'fov', 'size', 'sizeTo'],
  path: ['move', 'points', 'target', 'targets', 'ease', 'fov', 'size', 'sizeTo'],
} as const;

function numIn(err: Err, o: Obj | undefined, base: string, key: string, min: number, max: number, integer = false) {
  if (!o || o[key] === undefined) return;
  const v = o[key];
  if (!isNum(v) || v < min || v > max || (integer && !Number.isInteger(v))) {
    err(`${base}.${key}`, `${integer ? '정수' : '숫자'} ${min} ~ ${max} 범위여야 함`);
  }
}

function validateEnvironment(env: unknown, err: Err) {
  if (env === undefined) return;
  if (!isObj(env)) return err('environment', '객체여야 함');
  knownKeys(err, env, 'environment', KEYS.environment);
  for (const k of ['sky', 'terrain', 'trees', 'water', 'ground'] as const) {
    if (isObj(env[k])) knownKeys(err, env[k], `environment.${k}`, KEYS[k]);
  }
  if (env.sky !== undefined) {
    if (!isObj(env.sky)) err('environment.sky', '객체여야 함');
    else if (env.sky.preset !== undefined) oneOf(err, 'environment.sky.preset', env.sky.preset, SKY_PRESETS);
  }
  for (const k of ['terrain', 'trees', 'water', 'ground'] as const) {
    if (env[k] !== undefined && !isObj(env[k])) err(`environment.${k}`, '객체여야 함');
  }
  const t = isObj(env.terrain) ? env.terrain : undefined;
  numIn(err, t, 'environment.terrain', 'size', 10, 2000);
  numIn(err, t, 'environment.terrain', 'height', 0, 200);
  numIn(err, t, 'environment.terrain', 'roughness', 0, 1);
  numIn(err, t, 'environment.terrain', 'flatRadius', 0, 500);
  const tr = isObj(env.trees) ? env.trees : undefined;
  numIn(err, tr, 'environment.trees', 'count', 0, 5000, true);
  numIn(err, tr, 'environment.trees', 'area', 10, 2000);
  numIn(err, tr, 'environment.trees', 'avoidCenter', 0, 500);
  const w = isObj(env.water) ? env.water : undefined;
  numIn(err, w, 'environment.water', 'level', -100, 100);
  numIn(err, w, 'environment.water', 'size', 10, 4000);
  const gr = isObj(env.ground) ? env.ground : undefined;
  numIn(err, gr, 'environment.ground', 'size', 10, 4000);
}

function validateElements(els: unknown, types: Map<string, TypeInfo>, duration: number, err: Err) {
  if (els === undefined) return;
  if (!Array.isArray(els)) return err('elements', '배열이어야 함');
  const ids = new Set<string>();
  els.forEach((e: unknown, i) => {
    const p = `elements[${i}]`;
    if (!isObj(e)) return err(p, '객체여야 함');
    knownKeys(err, e, p, KEYS.element);
    if (typeof e.id !== 'string' || !e.id) err(`${p}.id`, '비어 있지 않은 문자열이어야 함');
    else if (ids.has(e.id)) err(`${p}.id`, `'${e.id}' 중복`);
    else ids.add(e.id);
    const info = types.get(e.type);
    if (!info) err(`${p}.type`, `'${String(e.type)}'은 알 수 없는 요소. 가능: ${list([...types.keys()])}`);
    if (e.at !== undefined && !isVec3(e.at)) err(`${p}.at`, VEC);
    if (e.rotation !== undefined && !isVec3(e.rotation)) err(`${p}.rotation`, '[x, y, z] 도(degree) 숫자 3개여야 함');
    if (e.scale !== undefined && (!isNum(e.scale) || e.scale <= 0)) err(`${p}.scale`, '0보다 큰 숫자여야 함');
    if (e.params !== undefined) {
      if (!isObj(e.params)) err(`${p}.params`, '객체여야 함');
      else if (e.params.role !== undefined) oneOf(err, `${p}.params.role`, e.params.role, ELEMENT_ROLES);
    }
    for (const key of ['enter', 'exit'] as const) {
      const c = e[key];
      if (c === undefined) continue;
      const cp = `${p}.${key}`;
      if (!isObj(c)) {
        err(cp, '객체여야 함');
        continue;
      }
      knownKeys(err, c, cp, KEYS.cue);
      if (!isNum(c.t) || c.t < 0 || c.t > duration) err(`${cp}.t`, `0 ~ ${duration}초 사이여야 함`);
      if (!ANIMS.includes(c.anim)) oneOf(err, `${cp}.anim`, c.anim, ANIMS);
      else if (c.anim === 'grow' && info && !info.supportsGrow) err(`${cp}.anim`, `'${e.type}'은 grow를 지원하지 않음`);
      if (c.dur !== undefined && (!isNum(c.dur) || c.dur <= 0)) err(`${cp}.dur`, '0보다 큰 숫자여야 함');
    }
    if (isObj(e.enter) && isObj(e.exit) && isNum(e.enter.t) && isNum(e.exit.t) && e.exit.t < e.enter.t) {
      err(`${p}.exit.t`, 'enter.t보다 앞설 수 없음');
    }
    if (e.follow !== undefined) {
      const fp = `${p}.follow`;
      const f = e.follow;
      if (!isObj(f)) err(fp, '객체여야 함');
      else {
        knownKeys(err, f, fp, KEYS.follow);
        const okPath = Array.isArray(f.path) && f.path.length >= 2 &&
          f.path.every((pt: unknown) => Array.isArray(pt) && pt.length === 2 && isNum(pt[0]) && isNum(pt[1]));
        if (!okPath) err(`${fp}.path`, '[[x, z], ...] 점 2개 이상이어야 함');
        if (!isNum(f.t0) || f.t0 < 0) err(`${fp}.t0`, '0 이상의 숫자여야 함');
        if (!isNum(f.t1) || f.t1 > duration || (isNum(f.t0) && f.t1 <= f.t0)) err(`${fp}.t1`, `t0보다 크고 ${duration}초 이하여야 함`);
        if (f.ease !== undefined) oneOf(err, `${fp}.ease`, f.ease, EASES);
      }
    }
    if (e.tracks !== undefined) {
      if (!isObj(e.tracks)) err(`${p}.tracks`, '객체여야 함');
      else {
        for (const [k, keys] of Object.entries(e.tracks)) {
          const tp = `${p}.tracks['${k}']`;
          if (k.startsWith('param.')) {
            const name = k.slice(6);
            const allowed = info?.animatable ?? [];
            if (!allowed.includes(name)) {
              err(tp, `'${e.type}'의 애니메이션 파라미터가 아님. 가능: ${allowed.length ? allowed.map((a) => `param.${a}`).join('|') : '(없음)'}`);
              continue;
            }
          } else if (!TRACK_PATHS.includes(k as TrackPath)) {
            err(tp, `알 수 없는 경로. 가능: ${list(TRACK_PATHS)}|param.<이름>`);
            continue;
          } else if (e.follow !== undefined && (k === 'position.x' || k === 'position.z')) {
            err(tp, 'follow가 있으면 position.x/z 트랙을 쓸 수 없음 (follow가 x·z를 정함)');
            continue;
          }
          const okShape = Array.isArray(keys) && keys.length > 0 &&
            keys.every((kv: unknown) => Array.isArray(kv) && kv.length === 2 && isNum(kv[0]) && isNum(kv[1]));
          if (!okShape) {
            err(tp, '[[시간, 값], ...] 형식이어야 함');
            continue;
          }
          for (let j = 1; j < keys.length; j++) {
            if (keys[j][0] <= keys[j - 1][0]) {
              err(tp, '키프레임 시간은 오름차순이어야 함');
              break;
            }
          }
        }
      }
    }
  });
}

function validateCamera(c: unknown, p: string, err: Err) {
  if (!isObj(c)) return err(p, '필수 항목 누락');
  const need = (k: string, ok: (v: unknown) => boolean, msg: string) => {
    if (!ok(c[k])) err(`${p}.${k}`, msg);
  };
  switch (c.move) {
    case 'static':
      need('pos', isVec3, VEC);
      need('target', isVec3, VEC);
      break;
    case 'dolly':
    case 'crane':
      need('from', isVec3, VEC);
      need('to', isVec3, VEC);
      need('target', isVec3, VEC);
      if (c.targetTo !== undefined) need('targetTo', isVec3, VEC);
      break;
    case 'path': {
      const okPts = Array.isArray(c.points) && c.points.length >= 2 && c.points.every(isVec3);
      if (!okPts) err(`${p}.points`, '[x, y, z] 점 2개 이상이어야 함');
      if (c.targets !== undefined) {
        const okT = Array.isArray(c.targets) && c.targets.every(isVec3) && Array.isArray(c.points) && c.targets.length === c.points.length;
        if (!okT) err(`${p}.targets`, 'points와 같은 개수의 [x, y, z] 목록이어야 함');
      } else if (!isVec3(c.target)) {
        err(`${p}.target`, 'target([x, y, z]) 또는 targets가 필요함');
      }
      break;
    }
    case 'orbit':
      need('center', isVec3, VEC);
      need('radius', (v) => isNum(v) && v > 0, '0보다 큰 숫자여야 함');
      need('height', isNum, '숫자여야 함');
      need('fromDeg', isNum, '숫자여야 함');
      need('toDeg', isNum, '숫자여야 함');
      break;
    default:
      return oneOf(err, `${p}.move`, c.move, CAMERA_MOVES);
  }
  knownKeys(err, c, p, c.move === 'static' ? KEYS.static : c.move === 'orbit' ? KEYS.orbit : c.move === 'path' ? KEYS.path : KEYS.dolly);
  for (const k of ['size', 'sizeTo'] as const) {
    if (c[k] !== undefined && (!isNum(c[k]) || c[k] <= 0)) err(`${p}.${k}`, '0보다 큰 숫자여야 함 (ortho 화면 세로 높이, m)');
  }
  if (c.ease !== undefined) oneOf(err, `${p}.ease`, c.ease, EASES);
  if (c.fov !== undefined && (!isNum(c.fov) || c.fov < 10 || c.fov > 120)) err(`${p}.fov`, '10 ~ 120 사이여야 함');
}

function validateShots(shots: unknown, duration: number, err: Err) {
  if (!Array.isArray(shots) || shots.length === 0) return err('shots', '샷이 1개 이상 필요');
  const ids = new Set<string>();
  shots.forEach((sh: unknown, i) => {
    const p = `shots[${i}]`;
    if (!isObj(sh)) return err(p, '객체여야 함');
    knownKeys(err, sh, p, KEYS.shot);
    if (typeof sh.id !== 'string' || !sh.id) err(`${p}.id`, '비어 있지 않은 문자열이어야 함');
    else if (ids.has(sh.id)) err(`${p}.id`, `'${sh.id}' 중복`);
    else ids.add(sh.id);
    if (!isNum(sh.start) || !isNum(sh.end) || sh.end <= sh.start) {
      err(p, 'start < end인 숫자여야 함');
    } else {
      const prev = i === 0 ? 0 : (shots[i - 1] as Obj)?.end;
      if (isNum(prev) && Math.abs(sh.start - prev) > 1e-6) {
        err(`${p}.start`, i === 0 ? '첫 샷은 0초에서 시작해야 함' : `이전 샷 끝(${prev})과 이어져야 함 (겹침·빈 구간 금지)`);
      }
    }
    validateCamera(sh.camera, `${p}.camera`, err);
  });
  const lastIdx = shots.length - 1;
  const last = shots[lastIdx] as Obj;
  if (isObj(last) && isNum(last.end) && Number.isFinite(duration) && Math.abs(last.end - duration) > 1e-6) {
    err(`shots[${lastIdx}].end`, `마지막 샷은 meta.duration(${duration})에서 끝나야 함`);
  }
}

export function validateScene(input: unknown, types: Map<string, TypeInfo>): Issue[] {
  const issues: Issue[] = [];
  const err: Err = (path, message) => {
    issues.push({ path, message });
  };
  if (!isObj(input)) {
    err('', '장면 정의가 객체가 아님 (export default defineScene({...}) 확인)');
    return issues;
  }
  knownKeys(err, input, '', KEYS.root);
  let duration = Infinity;
  const m = input.meta;
  if (!isObj(m)) err('meta', '필수 항목 누락');
  else {
    knownKeys(err, m, 'meta', KEYS.meta);
    for (const k of ['width', 'height', 'fps', 'duration'] as const) {
      if (!isNum(m[k]) || m[k] <= 0) err(`meta.${k}`, '0보다 큰 숫자여야 함');
    }
    if (!Number.isInteger(m.seed)) err('meta.seed', '정수여야 함');
    if (isNum(m.width) && isNum(m.height) && (m.width % 2 !== 0 || m.height % 2 !== 0)) {
      err('meta.width', '가로·세로는 짝수여야 함 (H.264 인코딩 조건)');
    }
    if (isNum(m.duration) && m.duration > 0) duration = m.duration;
    if (m.projection !== undefined) oneOf(err, 'meta.projection', m.projection, ['perspective', 'ortho']);
  }
  oneOf(err, 'style', input.style, STYLE_NAMES);
  validateEnvironment(input.environment, err);
  validateElements(input.elements, types, duration, err);
  validateShots(input.shots, duration, err);
  if (input.custom !== undefined && !Array.isArray(input.custom)) err('custom', '배열이어야 함');
  return issues;
}
