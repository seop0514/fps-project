// 총기 밸런스 데이터 (플레이어 체력 100 기준으로 조정)
//
// damage   : 몸통 기준 1발(1타) 데미지
// rpm      : 분당 발사 속도
// magSize  : 탄창 용량
// reloadTime : 재장전 시간(초)
// spread   : 탄 퍼짐(라디안). 클수록 부정확
// range    : 유효 사거리(미터)
// headshot : 헤드샷 데미지 배율
// pellets  : 산탄총처럼 1회에 여러 발 나가는 수
// auto     : 자동 연사 여부(false면 반자동)
// speedMultiplier : 칼을 들었을 때 이동속도 배수

export const WEAPONS = [
  {
    id: 'knife',
    name: '전투용 칼',
    kind: 'melee',
    damage: 55,            // 2타 킬
    attackInterval: 0.5,   // 초
    range: 2.6,            // 미터
    speedMultiplier: 1.35, // 칼을 들었을 때만 속도 증가
  },
  {
    id: 'pistol',
    name: 'P9 권총',
    kind: 'gun',
    damage: 24,            // 몸통 5발
    rpm: 300,
    magSize: 12,
    reloadTime: 1.4,
    spread: 0.012,
    range: 60,
    headshot: 2.0,
    pellets: 1,
    auto: false,
  },
  {
    id: 'smg',
    name: 'MP7 기관단총',
    kind: 'gun',
    damage: 15,            // 몸통 7발
    rpm: 750,
    magSize: 30,
    reloadTime: 1.8,
    spread: 0.026,
    range: 45,
    headshot: 1.5,
    pellets: 1,
    auto: true,
  },
  {
    id: 'rifle',
    name: 'M4 소총',
    kind: 'gun',
    damage: 26,            // 몸통 4발
    rpm: 600,
    magSize: 30,
    reloadTime: 2.0,
    spread: 0.015,
    range: 90,
    headshot: 2.0,
    pellets: 1,
    auto: true,
  },
  {
    id: 'shotgun',
    name: 'M870 산탄총',
    kind: 'gun',
    damage: 12,            // 펠릿당 (9발 = 근접 108)
    rpm: 70,
    magSize: 6,
    reloadTime: 2.6,
    spread: 0.08,
    range: 18,
    headshot: 1.0,
    pellets: 9,
    auto: false,
  },
  {
    id: 'sniper',
    name: 'AWM 저격총',
    kind: 'gun',
    damage: 110,           // 몸통 1발 킬 (연사 느림)
    rpm: 42,
    magSize: 5,
    reloadTime: 3.0,
    spread: 0.0015,
    range: 300,
    headshot: 1.5,
    pellets: 1,
    auto: false,
  },
  {
    id: 'lmg',
    name: 'M249 경기관총',
    kind: 'gun',
    damage: 20,            // 몸통 5발
    rpm: 640,
    magSize: 100,
    reloadTime: 3.4,
    spread: 0.03,
    range: 75,
    headshot: 1.5,
    pellets: 1,
    auto: true,
  },
];

export function getKnife() {
  return WEAPONS.find((w) => w.kind === 'melee');
}

// 라운드마다 랜덤 총 지급 (칼 제외)
export function randomGun() {
  const guns = WEAPONS.filter((w) => w.kind === 'gun');
  return guns[Math.floor(Math.random() * guns.length)];
}

export function weaponById(id) {
  return WEAPONS.find((w) => w.id === id) || null;
}
