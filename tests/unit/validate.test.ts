import { describe, it, expect } from 'vitest';
import { validateScene, type TypeInfo } from '../../kit/runtime/validate';

const types = new Map<string, TypeInfo>([
  ['shape', { supportsGrow: false }],
  ['arrow', { supportsGrow: true }],
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
  it('환경 수치 범위', () => {
    const s = good() as any;
    s.environment.trees = { count: 99999 };
    s.environment.terrain.roughness = 3;
    expect(paths(s)).toEqual(expect.arrayContaining(['environment.trees.count', 'environment.terrain.roughness']));
  });
});
