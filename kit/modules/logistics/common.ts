export { num } from '../concept/params';

/** 허용값 중 하나인지 확인. 기본값 d. 아니면 오류 */
export function pick<T extends string>(type: string, key: string, v: unknown, allowed: readonly T[], d: T): T {
  if (v === undefined) return d;
  if (!allowed.includes(v as T)) throw new Error(`${type}.params.${key} '${String(v)}'은 지원하지 않음. 가능: ${allowed.join('|')}`);
  return v as T;
}
