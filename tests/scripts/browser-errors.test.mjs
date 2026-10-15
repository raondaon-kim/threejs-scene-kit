import { describe, it, expect } from 'vitest';
import { explainLaunchError } from '../../scripts/lib/browser.mjs';

describe('explainLaunchError', () => {
  it('Chromium 미설치는 설치 명령을 안내', () => {
    const e = new Error("browserType.launch: Executable doesn't exist at C:\\Users\\x\\ms-playwright\\chromium-1243\\chrome.exe");
    const r = explainLaunchError(e, 'D:\\proj');
    expect(r.path).toBe('browser');
    expect(r.message).toContain('playwright install chromium');
    expect(r.message).toContain('D:\\proj');
  });
  it('그 밖의 오류는 원문 유지', () => {
    expect(explainLaunchError(new Error('boom'), 'D:\\p')).toBeNull();
  });
});
