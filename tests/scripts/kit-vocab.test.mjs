import { describe, it, expect } from 'vitest';
import { LOGISTICS_ELEMENTS } from '../../kit/modules/logistics/index.ts';
import { KIT_VOCAB, vocabSentence, CAMERA_ISO } from '../../scripts/lib/kit-vocab.mjs';

describe('kit-vocab', () => {
  it('물류 키트의 모든 type에 문구가 있음 (키트가 늘면 실패로 알림)', () => {
    for (const { type } of LOGISTICS_ELEMENTS) expect(KIT_VOCAB[type], type).toBeTruthy();
  });
  it('vocabSentence는 모든 문구와 금지 목록을 포함', () => {
    const s = vocabSentence();
    for (const v of Object.values(KIT_VOCAB)) expect(s).toContain(v);
    expect(s).toMatch(/^Only depict objects from this list: .+\. Do not include: cars, people, text, logos, distant towns, water, bridges\.$/);
  });
  it('CAMERA_ISO는 스펙 문장 그대로', () => {
    expect(CAMERA_ISO).toBe('Orthographic isometric view (no perspective distortion), looking from the front-right about 30° off the front face, elevated about 37°.');
  });
});
