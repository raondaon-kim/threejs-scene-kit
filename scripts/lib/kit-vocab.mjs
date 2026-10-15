/** 스토리보드 프롬프트 제약: 키트로 만들 수 있는 것만, 렌더와 같은 아이소 카메라로 */
export const KIT_VOCAB = {
  warehouse: 'a warehouse with loading docks',
  truck: 'box trucks and vans',
  forklift: 'yellow forklifts',
  pallet: 'pallets with cardboard boxes or blue crates',
  container: 'shipping containers',
  road: 'roads with a dashed center line',
  lot: 'paved lots',
  tree: 'round lollipop trees and cone trees',
  pin: 'blue map pins',
  building: 'simple office buildings',
};
export const FORBIDDEN = 'cars, people, text, logos, distant towns, water, bridges';
/** scene의 아이소 방향 target + [45, 67, 78]: 방위 30°, 고도 약 37° */
export const CAMERA_ISO = 'Orthographic isometric view (no perspective distortion), looking from the front-right about 30° off the front face, elevated about 37°.';
export function vocabSentence() {
  return `Only depict objects from this list: ${Object.values(KIT_VOCAB).join(', ')}. Do not include: ${FORBIDDEN}.`;
}
