/*
  에너지 도시 설계 게임 — 게임 데이터
  ------------------------------------------------
  선생님이 숫자를 바꿔 난이도를 조절할 수 있어요.
  cost  : 짓는 데 드는 돈(코인)
  pop   : 사는 사람 수
  gen   : 만드는 전기
  use   : 쓰는 전기
  co2   : 탄소(+ 나옴, − 줄여 줌)
  happy : 주민 행복
  money : 벌어 오는 돈 (공장)
  ※ 수치는 게임용 어림값이에요.
*/

window.EC_TILES = {
  house:   { code: "h", e: "🏠", n: "주택",       group: "live",  cost: 20, pop: 10, use: 3,  co2: 1,  happy: 0,
             desc: "10명이 살아요. 자동차를 타서 탄소가 조금 나와요." },
  apt:     { code: "a", e: "🏢", n: "아파트",     group: "live",  cost: 50, pop: 30, use: 8,  co2: 3,  happy: 0,
             desc: "30명이 살아요. 좁은 땅에 많은 사람이 살 수 있어요." },
  school:  { code: "s", e: "🏫", n: "학교",       group: "live",  cost: 40, use: 3, happy: 8,
             desc: "주민들이 아주 좋아해요." },
  factory: { code: "f", e: "⚙️", n: "공장",       group: "live",  cost: 0,  money: 60, use: 10, co2: 8, happy: -2,
             desc: "돈을 60코인 벌어 와요. 대신 전기를 많이 쓰고 탄소가 나와요.",
             rule: "집 옆에 있으면 시끄러워서 행복 −2" },

  coal:    { code: "c", e: "🏭", n: "석탄 발전소", group: "power", cost: 60, gen: 40, co2: 20, happy: -6,
             desc: "전기를 아주 많이 만들어요. 하지만 탄소가 가장 많이 나와요.",
             rule: "집 옆에 있으면 매연 때문에 행복 −4" },
  gas:     { code: "g", e: "🔥", n: "가스 발전소", group: "power", cost: 70, gen: 30, co2: 10, happy: -3,
             desc: "석탄보다 탄소가 적게 나오지만, 그래도 나와요." },
  solar:   { code: "o", e: "☀️", n: "태양광",     group: "power", cost: 40, gen: 8,
             desc: "햇빛으로 전기를 만들어요. 탄소가 안 나와요!",
             rule: "흐린 날에는 전기가 절반만 나와요" },
  wind:    { code: "w", e: "🌬️", n: "풍력",       group: "power", cost: 60, gen: 12, happy: -1,
             desc: "바람으로 전기를 만들어요. 탄소가 안 나와요!",
             rule: "지도 가장자리에 지으면 바람이 세서 전기 +4 · 바람이 약한 날에는 절반만" },
  hydro:   { code: "y", e: "💧", n: "수력 발전소", group: "power", cost: 90, gen: 20,
             desc: "흐르는 강물로 전기를 만들어요. 날씨가 나빠도 괜찮아요.",
             rule: "강 바로 옆에만 지을 수 있어요" },
  battery: { code: "b", e: "🔋", n: "전기 저장소", group: "power", cost: 50,
             desc: "맑은 날 남는 전기를 모아 두었다가 흐린 날에 써요.",
             rule: "흐린 날 전기 +10" },

  park:    { code: "p", e: "🌳", n: "숲·공원",   group: "green", cost: 15, co2: -4, happy: 4,
             desc: "나무가 탄소를 빨아들여요.",
             rule: "집 옆에 있으면 행복 +2" },
  bike:    { code: "k", e: "🚲", n: "자전거길",   group: "green", cost: 10, co2: -2, happy: 2,
             desc: "자동차 대신 자전거를 타요." },
  bus:     { code: "u", e: "🚌", n: "버스 정류장", group: "green", cost: 25, use: 1, co2: -3, happy: 3,
             desc: "여러 사람이 함께 타서 자동차가 줄어요." },
  recycle: { code: "r", e: "♻️", n: "재활용 센터", group: "green", cost: 35, use: 2, co2: -5, happy: 1,
             desc: "쓰레기를 다시 자원으로 만들어요." }
};

window.EC_GROUPS = [
  { id: "live",  icon: "🏘️", name: "사는 곳" },
  { id: "power", icon: "⚡",  name: "전기 만들기" },
  { id: "green", icon: "🌿", name: "초록 도시" }
];

/* 지도 크기와 강 위치 (행, 열) */
window.EC_MAP = {
  size: 8,
  river: [[0,5],[1,5],[2,4],[3,4],[4,4],[5,5],[6,5],[7,6]]
};

/*
  미션
  ⭐     주민 수 채우기 + 전기 부족하지 않기 + 예산 남기기
  ⭐⭐   + 탄소를 목표보다 적게
  ⭐⭐⭐ + 행복 목표 + 흐린 날에도 전기 충분
*/
window.EC_MISSIONS = [
  { id: "m1", e: "🌱", name: "새싹 마을",     budget: 400,  pop: 100, co2: 10, happy: 55,
    desc: "주민 100명이 사는 작은 마을을 만들어요." },
  { id: "m2", e: "🌿", name: "푸른 도시",     budget: 1000, pop: 250, co2: 5,  happy: 60,
    desc: "주민 250명! 탄소를 줄이면서 전기도 넉넉하게." },
  { id: "m3", e: "🌍", name: "탄소 제로 도시", budget: 1600, pop: 400, co2: 0,  happy: 65,
    desc: "주민 400명이 살면서 탄소는 0! 가장 어려운 도전이에요." },
  { id: "free", e: "🎨", name: "자유 설계",   budget: 3000, pop: 0,   co2: 0,  happy: 60,
    desc: "돈 걱정 없이 내가 꿈꾸는 미래도시를 만들어요." }
];
