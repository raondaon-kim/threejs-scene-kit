---
name: scene-modules
description: threejs-scene-kit 장면에 넣을 수 있는 요소와 환경의 카탈로그. scene.ts의 elements나 environment를 작성·수정할 때 type과 params를 확인하는 용도. 도형(shape), 텍스트 라벨(label, 한글 지원), 화살표(arrow), 막대그래프(bars), 곡선(line), 지형·하늘·나무·물.
---

# 모듈 카탈로그

모든 요소는 검증된 코드로 이미 프로젝트 `kit/`에 들어 있다. 소스를 읽지 말고 아래 표와 references만 본다.

## 요소 (elements[].type)

| type | 용도 | 주요 params | grow |
|---|---|---|---|
| shape | 기본 도형 | kind(box, sphere, cylinder, cone, torus), size, role | ✗ |
| label | 텍스트(한글·여러 줄) | text(`\n` 줄바꿈), size(한 줄 높이 m), background, billboard, role | ✗ |
| arrow | 화살표 | to(상대 좌표), thickness, role | ✓ |
| bars | 막대그래프 | values, labels, maxHeight, width, gap, roles | ✓ |
| line | 곡선 튜브 | points(상대 좌표 2개 이상), radius, role | ✓ |

- `role` 값: accent, accent2, accent3, neutral, label. 실제 색은 스타일이 정한다.
- grow ✓ 요소만 `anim: 'grow'`를 쓸 수 있다.
- 상세 params: `references/<type>.md`

## 환경 (environment)

| 키 | 내용 |
|---|---|
| sky | 그라데이션 하늘. preset: dawn, day, dusk, night |
| terrain | 시드 기반 지형. 중앙 flatRadius는 평평한 무대 |
| trees | 로우폴리 나무 숲. 바람에 흔들림 |
| water | 물결치는 수면 |

상세: `references/environment.md`

## 스타일별 색 (role → 색)

| role | stylized | minimal |
|---|---|---|
| accent | 주황 #ff7a59 | 파랑 #2f6df6 |
| accent2 | 노랑 #ffd166 | 주황 #f2a541 |
| accent3 | 청록 #5ec2b7 | 초록 #16a085 |
| neutral | 아이보리 #f2efe9 | 흰색 #ffffff |
| label | 남색 #2b2d42 | 검정 #1d1d1f |

없는 요소가 필요하면 scene-custom 스킬을 쓴다.
