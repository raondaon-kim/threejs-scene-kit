/** 도크 x 위치(로컬): 중심 대칭, 양 끝 ±0.36w. warehouse 메시와 anchors가 공유한다 */
export function dockPositions(w: number, docks: number): number[] {
  if (docks <= 0) return [];
  if (docks === 1) return [0];
  return Array.from({ length: docks }, (_, i) => -w * 0.36 + (i * w * 0.72) / (docks - 1));
}
