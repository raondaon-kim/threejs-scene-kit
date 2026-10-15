import { describe, it, expect } from 'vitest';
import { validateScene, type TypeInfo } from '../../kit/runtime/validate';

const types = new Map<string, TypeInfo>([
  ['shape', { supportsGrow: false, animatable: [] }],
  ['arrow', { supportsGrow: true, animatable: [] }],
]);
const cam = { move: 'static', pos: [0, 2, 10], target: [0, 0, 0] };
const good = () => ({
  meta: { width: 1080, height: 1920, fps: 30, duration: 10, seed: 1 },
  style: 'stylized',
  environment: { sky: { preset: 'dawn' }, terrain: { size: 100 } },
  elements: [
    { id: 'a', type: 'shape', at: [0, 1, 0], enter: { t: 1, anim: 'pop' } },
    { id: 'b', type: 'arrow', enter: { t: 2, anim: 'grow' }, tracks: { 'position.y': [[0, 0], [2, 3]] } },
  ],
  shots: [
    { id: 's1', start: 0, end: 4, camera: cam },
    { id: 's2', start: 4, end: 10, camera: { move: 'orbit', center: [0, 0, 0], radius: 10, height: 2, fromDeg: 0, toDeg: 30 } },
  ],
});
const paths = (s: unknown) => validateScene(s, types).map((i) => i.path);

describe('validateScene', () => {
  it('정상 장면은 이슈 없음', () => {
    expect(validateScene(good(), types)).toEqual([]);
  });
  it('meta 오류', () => {
    const s = good();
    (s.meta as any).fps = 0;
    (s.meta as any).seed = 1.5;
    (s.meta as any).width = 1081;
    expect(paths(s)).toEqual(expect.arrayContaining(['meta.fps', 'meta.seed', 'meta.width']));
  });
  it('알 수 없는 style·preset·type·anim·role', () => {
    const s = good() as any;
    s.style = 'anime';
    s.environment.sky.preset = 'noon';
    s.elements[0].type = 'cube';
    s.elements[1].enter.anim = 'spin';
    s.elements[1].params = { role: 'blue' };
    const p = paths(s);
    expect(p).toEqual(expect.arrayContaining(['style', 'environment.sky.preset', 'elements[0].type', 'elements[1].enter.anim', 'elements[1].params.role']));
    const msg = validateScene(s, types).find((i) => i.path === 'elements[1].enter.anim')!.message;
    expect(msg).toContain('none|fade|pop|rise|grow');
  });
  it('grow 미지원 요소', () => {
    const s = good() as any;
    s.elements[0].enter.anim = 'grow';
    expect(paths(s)).toContain('elements[0].enter.anim');
  });
  it('중복 id, exit가 enter보다 앞섬, 시간 범위 밖', () => {
    const s = good() as any;
    s.elements[1].id = 'a';
    s.elements[0].exit = { t: 0.5, anim: 'fade' };
    s.elements[1].enter.t = 11;
    expect(paths(s)).toEqual(expect.arrayContaining(['elements[1].id', 'elements[0].exit.t', 'elements[1].enter.t']));
  });
  it('tracks 경로·형식·정렬', () => {
    const s = good() as any;
    s.elements[1].tracks = { 'position.w': [[0, 1]], scale: [[2, 1], [1, 2]], opacity: 'x' };
    const p = paths(s);
    expect(p).toEqual(expect.arrayContaining(["elements[1].tracks['position.w']", "elements[1].tracks['scale']", "elements[1].tracks['opacity']"]));
  });
  it('샷 겹침·빈 구간·시작·끝·카메라 필드', () => {
    const s = good() as any;
    s.shots[1].start = 5;
    s.shots[1].end = 9;
    s.shots[0].camera = { move: 'dolly', from: [0, 0, 1], target: [0, 0, 0] };
    const p = paths(s);
    expect(p).toEqual(expect.arrayContaining(['shots[1].start', 'shots[1].end', 'shots[0].camera.to']));
  });
  it('첫 샷은 0초 시작, 샷 없음, 잘못된 move', () => {
    const s = good() as any;
    s.shots[0].start = 1;
    expect(paths(s)).toContain('shots[0].start');
    s.shots = [];
    expect(paths(s)).toContain('shots');
    s.shots = [{ id: 'x', start: 0, end: 10, camera: { move: 'zoom' } }];
    expect(paths(s)).toContain('shots[0].camera.move');
  });
  it('객체가 아니면 즉시 보고', () => {
    expect(paths(null)).toEqual(['']);
  });
  it('알 수 없는 키(오타)는 오류 — params 내부는 제외', () => {
    const s = good() as any;
    s.enviroment = {};
    s.environment.tree = { count: 10 };
    s.environment.terrain.hieght = 3;
    s.elements[0].enterr = { t: 1, anim: 'fade' };
    s.elements[0].enter.durr = 1;
    s.elements[0].params = { anything: 1 };
    s.shots[0].cam = {};
    s.shots[1].camera.raduis = 3;
    s.meta.fsp = 30;
    const p = paths(s);
    expect(p).toEqual(expect.arrayContaining([
      'enviroment', 'environment.tree', 'environment.terrain.hieght', 'elements[0].enterr',
      'elements[0].enter.durr', 'shots[0].cam', 'shots[1].camera.raduis', 'meta.fsp',
    ]));
    expect(p).not.toContain('elements[0].params.anything');
    const msg = validateScene(s, types).find((i) => i.path === 'environment.tree')!.message;
    expect(msg).toContain('trees');
  });
  it('환경 수치 범위', () => {
    const s = good() as any;
    s.environment.trees = { count: 99999 };
    s.environment.terrain.roughness = 3;
    expect(paths(s)).toEqual(expect.arrayContaining(['environment.trees.count', 'environment.terrain.roughness']));
  });
});

describe('v0.2 검증', () => {
  const types2 = new Map<string, TypeInfo>([
    ['shape', { supportsGrow: false, animatable: [] }],
    ['forklift', { supportsGrow: false, animatable: ['lift', 'travel'] }],
  ]);
  const base = () => ({
    meta: { width: 1920, height: 1080, fps: 30, duration: 10, seed: 1, projection: 'ortho' },
    style: 'clay',
    environment: { ground: { size: 300 } },
    elements: [
      { id: 'f', type: 'forklift', params: { role: 'body' }, tracks: { 'param.lift': [[1, 0], [2, 1]] },
        follow: { path: [[0, 0], [10, 0], [10, 10]], t0: 0, t1: 5 } },
    ],
    shots: [
      { id: 'a', start: 0, end: 5, camera: { move: 'static', pos: [20, 20, 20], target: [0, 0, 0], size: 30, sizeTo: 20 } },
      { id: 'b', start: 5, end: 10, camera: { move: 'path', points: [[20, 20, 20], [0, 25, 30]], target: [0, 0, 0] } },
    ],
  });
  it('정상 v0.2 장면', () => expect(validateScene(base(), types2)).toEqual([]));
  it('param 트랙은 animatable만', () => {
    const s = base() as any;
    s.elements[0].tracks = { 'param.height': [[0, 1]] };
    expect(validateScene(s, types2).map((i) => i.path)).toContain("elements[0].tracks['param.height']");
  });
  it('follow 형식과 position 트랙 충돌', () => {
    const s = base() as any;
    s.elements[0].follow = { path: [[0, 0]], t0: 3, t1: 2 };
    s.elements[0].tracks = { 'position.x': [[0, 1]] };
    const p = validateScene(s, types2).map((i) => i.path);
    expect(p).toEqual(expect.arrayContaining(['elements[0].follow.path', 'elements[0].follow.t1', "elements[0].tracks['position.x']"]));
  });
  it('projection·size·path 카메라', () => {
    const s = base() as any;
    s.meta.projection = 'iso';
    s.shots[0].camera.size = -1;
    s.shots[1].camera = { move: 'path', points: [[0, 0, 0]] };
    const p = validateScene(s, types2).map((i) => i.path);
    expect(p).toEqual(expect.arrayContaining(['meta.projection', 'shots[0].camera.size', 'shots[1].camera.points', 'shots[1].camera.target']));
  });
});

describe('v0.4 look 검증', () => {
  it('look.surfaces 역할·텍스처 이름·세기·형식 (Review Focus 3)', () => {
    const bad = { ...good(), look: { surfaces: { lava: 'grass-brush', ground: 'nope', roof: { texture: 'paper', tile: 0, strength: 3, flow: [1] }, rock: 5 }, strength: 2, gloss: 1 } };
    const p = paths(bad);
    expect(p).toEqual(expect.arrayContaining(['look.surfaces.lava', 'look.surfaces.ground', 'look.surfaces.roof.tile', 'look.surfaces.roof.strength', 'look.surfaces.roof.flow', 'look.surfaces.rock', 'look.strength', 'look.gloss']));
    const msg = validateScene(bad, types).find((i) => i.path === 'look.surfaces.ground')!.message;
    expect(msg).toMatch(/grass-brush/);
  });
  it('정상 look', () => {
    expect(paths({ ...good(), look: { surfaces: { ground: 'grass-brush', roof: 'none', water: { texture: 'water-ripple', flow: [0, 0.2] } }, strength: 0.4 } })).toEqual([]);
  });
});

