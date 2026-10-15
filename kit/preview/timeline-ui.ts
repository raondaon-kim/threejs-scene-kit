import type { SceneDef } from '../runtime/types';

const COLORS = ['#ff7a59', '#5ec2b7', '#ffd166', '#8e7cc3', '#4f9be8', '#e56b9f'];

/** 미리보기 전용 UI. 재생 루프만 실시간을 쓰고, 그리기는 항상 renderAt(t)로 seek한다. */
export function createTimelineUI(opts: {
  root: HTMLElement;
  stage: HTMLElement;
  def: SceneDef;
  renderAt: (t: number) => Promise<void>;
}) {
  const { duration, fps } = opts.def.meta;
  const bar = document.createElement('div');
  bar.className = 'kit-timeline';
  const track = document.createElement('div');
  track.className = 'kit-track';
  opts.def.shots.forEach((s, i) => {
    const b = document.createElement('div');
    b.className = 'kit-shot';
    b.style.left = `${(s.start / duration) * 100}%`;
    b.style.width = `${((s.end - s.start) / duration) * 100}%`;
    b.style.background = COLORS[i % COLORS.length];
    b.textContent = s.id;
    track.appendChild(b);
  });
  for (const el of opts.def.elements ?? []) {
    for (const [kind, cue] of [['enter', el.enter], ['exit', el.exit]] as const) {
      if (!cue) continue;
      const m = document.createElement('div');
      m.className = `kit-marker kit-${kind}`;
      m.style.left = `${(cue.t / duration) * 100}%`;
      m.title = `${el.id} ${kind} ${cue.t}s (${cue.anim})`;
      track.appendChild(m);
    }
  }
  const head = document.createElement('div');
  head.className = 'kit-head';
  track.appendChild(head);
  const range = document.createElement('input');
  range.type = 'range';
  range.min = '0';
  range.max = String(duration);
  range.step = String(1 / fps);
  range.value = '0';
  const play = document.createElement('button');
  play.textContent = '▶';
  const readout = document.createElement('span');
  readout.className = 'kit-readout';
  const controls = document.createElement('div');
  controls.className = 'kit-controls';
  controls.append(play, range, readout);
  bar.append(track, controls);
  opts.root.appendChild(bar);

  let t = 0;
  let playing = false;
  let last = 0;
  const shotAt = (time: number) => {
    let id = opts.def.shots[0].id;
    for (const s of opts.def.shots) if (time >= s.start) id = s.id;
    return id;
  };
  const show = async (time: number) => {
    t = Math.min(Math.max(time, 0), duration);
    range.value = String(t);
    head.style.left = `${(t / duration) * 100}%`;
    readout.textContent = `${t.toFixed(2)} / ${duration}s · frame ${Math.round(t * fps)} · shot ${shotAt(t)}`;
    await opts.renderAt(t);
  };
  const loop = (now: number) => {
    if (!playing) return;
    const dt = (now - last) / 1000;
    last = now;
    let next = t + dt;
    if (next >= duration) next = 0;
    void show(next).then(() => requestAnimationFrame(loop));
  };
  const toggle = () => {
    playing = !playing;
    play.textContent = playing ? '❚❚' : '▶';
    if (playing) {
      last = performance.now();
      requestAnimationFrame(loop);
    }
  };
  play.addEventListener('click', toggle);
  range.addEventListener('input', () => {
    if (playing) toggle();
    void show(Number(range.value));
  });
  track.addEventListener('click', (e) => {
    const r = track.getBoundingClientRect();
    if (playing) toggle();
    void show(((e.clientX - r.left) / r.width) * duration);
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      toggle();
    } else if (e.code === 'ArrowRight') void show(t + 1 / fps);
    else if (e.code === 'ArrowLeft') void show(t - 1 / fps);
  });
  void show(0);
}
