import { parseArgs } from './args.mjs';

/** 사용자에게 보여줄 오류. errors: string | {path,message} 배열 */
export class ScriptError extends Error {
  constructor(errors, extra = {}) {
    const list = (Array.isArray(errors) ? errors : [errors]).map((e) => (typeof e === 'string' ? { path: '', message: e } : e));
    super(list.map((e) => e.message).join('; '));
    this.errors = list;
    this.extra = extra;
  }
}

function print(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

/** 스크립트 진입점: --help 처리, 결과 JSON 한 줄 출력, 실패 시 exit 1 */
export async function run(fn, help) {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`${help.trim()}\n`);
    return;
  }
  try {
    const result = await fn(parseArgs(argv));
    print({ ok: true, ...result });
  } catch (e) {
    if (e instanceof ScriptError) print({ ok: false, errors: e.errors, ...e.extra });
    else print({ ok: false, errors: [{ path: '', message: String(e?.stack ?? e) }] });
    process.exitCode = 1;
  }
}
