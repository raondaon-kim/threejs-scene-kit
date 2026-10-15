// 테스트용 가짜 codex: 프롬프트의 "save it as <path>"에 유효한 160x90 PNG를 쓴다.
// FAKE_CODEX_MODE=nofile 이면 파일 없이 정상 종료(실패 감지 테스트용).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

function png(w, h, rgb) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(rgb, y * (w * 3 + 1) + 1 + x * 3);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const args = process.argv.slice(2);
const cwd = args[args.indexOf('-C') + 1];
const prompt = args[args.length - 1];
const m = prompt.match(/save it as (\S+\.png)/);
if (process.env.FAKE_CODEX_MODE !== 'nofile' && m) {
  const f = join(cwd, m[1]);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, png(160, 90, [90, 120, 230]));
}
console.log(m ? m[1] : 'no path');
