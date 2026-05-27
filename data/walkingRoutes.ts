export type WalkingRoute = {
  id: string;
  name: string;
  district: string;
  distanceKm: number;
  durationMin: number;
  surface: string;
  tip: string;
};

/** 서울 시내 고혈압 관리용 산책 예시 (완만·저강도 위주) */
export const WALKING_ROUTES: WalkingRoute[] = [
  {
    id: "1",
    name: "청계천 광통교~세운교 구간",
    district: "종로·중구",
    distanceKm: 2.4,
    durationMin: 35,
    surface: "평지·포장",
    tip: "왕복 30~40분, 중간에 벤치에서 호흡 쉬기 좋습니다.",
  },
  {
    id: "2",
    name: "한강공원 여의도 북단 산책로",
    district: "영등포구",
    distanceKm: 3.0,
    durationMin: 45,
    surface: "평지·자전거·보행 분리",
    tip: "바람이 시원해 여름 산책에도 무난합니다. 수분 섭취를 챙기세요.",
  },
  {
    id: "3",
    name: "서울숲 공원 순환로",
    district: "성동구",
    distanceKm: 2.8,
    durationMin: 40,
    surface: "완만한 오르막 소량",
    tip: "나무 그늘이 많아 낮 시간대에도 걷기 편합니다.",
  },
  {
    id: "4",
    name: "올림픽공원 장미광장~호수 산책로",
    district: "송파구",
    distanceKm: 3.5,
    durationMin: 50,
    surface: "평지 위주",
    tip: "넓은 광장에서 스트레칭 후 시작하면 무릎 부담이 줄어듭니다.",
  },
  {
    id: "5",
    name: "남산 순환로 (백범광장 출발)",
    district: "중구·용산",
    distanceKm: 2.2,
    durationMin: 40,
    surface: "완만한 경사",
    tip: "경사가 있으니 속도보다 호흡을 일정하게 유지하세요.",
  },
  {
    id: "6",
    name: "북서울꿈의숲 맑은숲길",
    district: "강북구",
    distanceKm: 2.6,
    durationMin: 45,
    surface: "숲길·완만한 오르막",
    tip: "공기가 좋아 스트레스 완화에 도움이 됩니다. 미끄럼에 주의하세요.",
  },
  {
    id: "7",
    name: "월드컵공원 하늘공원 평지 둘레",
    district: "마포구",
    distanceKm: 3.2,
    durationMin: 48,
    surface: "평지·잔디·포장",
    tip: "해질녘 산책 시 안전을 위해 밝은 복장을 권장합니다.",
  },
  {
    id: "8",
    name: "안양천 서울대입구~보라매 구간",
    district: "관악·동작",
    distanceKm: 2.5,
    durationMin: 38,
    surface: "평지·자전거·보행 분리",
    tip: "왕복 2km부터 시작해 체력에 맞게 늘리기 좋습니다.",
  },
  {
    id: "9",
    name: "선유도 한강 산책로",
    district: "영등포구",
    distanceKm: 2.0,
    durationMin: 30,
    surface: "평지",
    tip: "짧은 코스로 시작하기 좋아 고혈압 초기 운동 연습에 적합합니다.",
  },
  {
    id: "10",
    name: "석촌호수 둘레길",
    district: "송파구",
    distanceKm: 2.7,
    durationMin: 40,
    surface: "평지·호수 둘레",
    tip: "호수 주변 바람이 있어 사계절 내내 걷기 무난합니다.",
  },
];
