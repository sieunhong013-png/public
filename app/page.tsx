"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

import { KCHS_SEOUL_2024 } from "@/data/kchsSeoulBenchmark";
import {
  buildAppUrl,
  EXTERNAL_URLS,
  getAppTabLinks,
  readAppTabFromUrl,
  syncAppTabUrl,
} from "@/data/siteUrls";
import { PUBLIC_HEALTH_CENTERS } from "@/data/publicHealthCenters";
import { WALKING_ROUTES } from "@/data/walkingRoutes";
import {
  buildPersonalDiagnosis,
  type KnowledgeAnswer,
  type PersonalDiagnosisForm,
  type PersonalDiagnosisResult,
} from "@/lib/personalDiagnosis";
import {
  canEarnPointsToday,
  earnPoints,
  formatPointDate,
  getRule,
  getTreatmentLevel,
  HYPERTENSION_POINT_RULES,
  parseStoredPoints,
  POINTS_STORAGE_KEY,
  WRIST_DOCTOR_9988_LABEL,
  WRIST_DOCTOR_9988_PHONE,
  type PointCategory,
  type PointsWallet,
} from "@/lib/points";

type ContentFilter = "medicationVerbal" | "walking";

type Hospital = {
  name: string;
  address: string;
  detailAddress: string;
  phoneNumber: string;
  verbalEducation: string[];
  serviceType?: "medication" | "verbalRehab";
  isCurrentlyAvailable: boolean;
  openTime: string;
  closeTime: string;
  educationPrograms?: string[];
};

/** 저염·채소·통곡·생선 중심 예시 (개인별 질환·복약은 담당 의료진 상담) */
const HYPERTENSION_WEEKLY_MEAL_PLAN = [
  {
    day: "월",
    breakfast: "귀리죽, 삶은 달걀 1개, 방울토마토, 무가당 두유",
    lunch: "현미밥, 닭가슴살 구이, 미역국(간장·소금 최소), 겉절이 나물",
    dinner: "고등어구이, 잡곡밥, 애호박볶음, 배추김치(물에 살짝 헹굼)",
  },
  {
    day: "화",
    breakfast: "통밀식빵 1장, 저지방 우유, 아보카도·상추 샐러드",
    lunch: "보리밥, 동태찜, 도토리묵무침, 콩나물무침, 된장찌개(담백)",
    dinner: "두부스테이크, 브로콜리·당근 볶음, 현미밥, 미역국",
  },
  {
    day: "수",
    breakfast: "팥죽(설탕 없이), 계란말이(소금 적게), 오이생채",
    lunch: "메밀소바(육수 조금), 두부구이, 깻잎·상추 쌈, 무생채",
    dinner: "조기구이, 뿌리채소 볶음, 잡곡밥, 시래기된장국",
  },
  {
    day: "목",
    breakfast: "그릭요거트(무가당), 오트밀, 사과·블루베리",
    lunch: "비빔밥(현미·나물 위주, 고추장·참기름 절반), 계란후라이",
    dinner: "수육(삶은 삼겹 소량), 쌈채소, 된장찌개, 잡곡밥",
  },
  {
    day: "금",
    breakfast: "찐 고구마, 삶은 달걀, 방울토마토, 저지방 우유",
    lunch: "현미밥, 생선조림(간장·설탕 줄임), 시금치 나물, 무국",
    dinner: "닭가슴살 샤브(육수 담백), 버섯·배추·두부 푸짐하게, 당면 소량",
  },
  {
    day: "토",
    breakfast: "야채죽, 김구이, 무생채",
    lunch: "잡곡밥, 생선구이, 잡채(당면·고기 줄이고 채소 늘리기), 나물",
    dinner: "순두부찌개(달걀), 애호박전, 현미밥",
  },
  {
    day: "일",
    breakfast: "콩나물국밥(밥 반 공기), 깍두기 소량",
    lunch: "보리밥, 갈치구이, 콩자반, 시금치나물, 맑은 미역국",
    dinner: "들깨 칼국수(국물 조금만 마시기), 김치, 오이생채",
  },
] as const;

const HOSPITALS: Hospital[] = [
  {
    name: "강남구 서울강남내과의원",
    address: "서울특별시 강남구 테헤란로 212",
    detailAddress: "서울특별시 강남구 테헤란로 212, 3층",
    phoneNumber: "02-501-1001",
    verbalEducation: ["맞춤형 운동 처방", "저염식 가이드"],
    isCurrentlyAvailable: true,
    openTime: "09:00",
    closeTime: "18:30",
    educationPrograms: ["식단상담", "운동상담"],
  },
  {
    name: "강동구 바른내과의원",
    address: "서울특별시 강동구 천호대로 1095",
    detailAddress: "서울특별시 강동구 천호대로 1095, 4층",
    phoneNumber: "02-482-1002",
    verbalEducation: ["혈압 일지 작성 교육", "생활습관 코칭"],
    isCurrentlyAvailable: true,
    openTime: "08:30",
    closeTime: "17:30",
    educationPrograms: ["복약상담", "생활습관 코칭"],
  },
  {
    name: "강북구 미아내과의원",
    address: "서울특별시 강북구 도봉로 346",
    detailAddress: "서울특별시 강북구 도봉로 346, 2층",
    phoneNumber: "02-989-1003",
    verbalEducation: ["맞춤형 운동 처방", "가정혈압 측정법"],
    isCurrentlyAvailable: true,
    openTime: "09:30",
    closeTime: "18:00",
    educationPrograms: ["식이교육", "운동상담"],
  },
  {
    name: "강서구 공항내과의원",
    address: "서울특별시 강서구 공항대로 247",
    detailAddress: "서울특별시 강서구 공항대로 247, 5층",
    phoneNumber: "02-2662-1004",
    verbalEducation: ["저염식 가이드", "복약 순응도 교육"],
    isCurrentlyAvailable: true,
    openTime: "09:00",
    closeTime: "17:00",
    educationPrograms: ["복약상담", "혈압기 사용법"],
  },
  {
    name: "관악구 서울관악내과",
    address: "서울특별시 관악구 남부순환로 1820",
    detailAddress: "서울특별시 관악구 남부순환로 1820, 3층",
    phoneNumber: "02-877-1005",
    verbalEducation: ["맞춤형 운동 처방", "저염식 가이드"],
    isCurrentlyAvailable: true,
    openTime: "09:00",
    closeTime: "18:00",
    educationPrograms: ["식단상담", "생활습관 코칭"],
  },
  {
    name: "광진구 자양내과의원",
    address: "서울특별시 광진구 아차산로 355",
    detailAddress: "서울특별시 광진구 아차산로 355, 4층",
    phoneNumber: "02-446-1006",
    verbalEducation: ["혈압 일지 작성 교육", "가정혈압 측정법"],
    isCurrentlyAvailable: true,
    openTime: "08:30",
    closeTime: "17:30",
    educationPrograms: ["운동상담", "복약상담"],
  },
  {
    name: "구로구 신도림내과",
    address: "서울특별시 구로구 경인로 661",
    detailAddress: "서울특별시 구로구 경인로 661, 6층",
    phoneNumber: "02-2632-1007",
    verbalEducation: ["저염식 가이드", "체중관리 교육"],
    isCurrentlyAvailable: true,
    openTime: "09:00",
    closeTime: "18:30",
    educationPrograms: ["식이교육", "운동상담"],
  },
  {
    name: "금천구 시흥내과의원",
    address: "서울특별시 금천구 시흥대로 403",
    detailAddress: "서울특별시 금천구 시흥대로 403, 2층",
    phoneNumber: "02-896-1008",
    verbalEducation: ["맞춤형 운동 처방", "생활습관 코칭"],
    isCurrentlyAvailable: true,
    openTime: "09:30",
    closeTime: "18:00",
    educationPrograms: ["운동상담", "생활습관 코칭"],
  },
  {
    name: "노원구 상계내과센터",
    address: "서울특별시 노원구 동일로 1405",
    detailAddress: "서울특별시 노원구 동일로 1405, 5층",
    phoneNumber: "02-938-1009",
    verbalEducation: ["저염식 가이드", "복약 순응도 교육"],
    isCurrentlyAvailable: true,
    openTime: "09:00",
    closeTime: "17:30",
    educationPrograms: ["복약상담", "혈압기 사용법"],
  },
  {
    name: "도봉구 창동내과의원",
    address: "서울특별시 도봉구 마들로 657",
    detailAddress: "서울특별시 도봉구 마들로 657, 3층",
    phoneNumber: "02-993-1010",
    verbalEducation: ["맞춤형 운동 처방", "저염식 가이드"],
    isCurrentlyAvailable: true,
    openTime: "09:00",
    closeTime: "18:00",
    educationPrograms: ["식단상담", "운동상담"],
  },
  {
    name: "동대문구 청량리내과",
    address: "서울특별시 동대문구 왕산로 214",
    detailAddress: "서울특별시 동대문구 왕산로 214, 7층",
    phoneNumber: "02-962-1011",
    verbalEducation: ["혈압 일지 작성 교육", "가정혈압 측정법"],
    isCurrentlyAvailable: true,
    openTime: "08:30",
    closeTime: "17:30",
    educationPrograms: ["복약상담", "생활습관 코칭"],
  },
  {
    name: "동작구 사당내과의원",
    address: "서울특별시 동작구 동작대로 89",
    detailAddress: "서울특별시 동작구 동작대로 89, 4층",
    phoneNumber: "02-595-1012",
    verbalEducation: ["저염식 가이드", "체중관리 교육"],
    isCurrentlyAvailable: true,
    openTime: "09:00",
    closeTime: "18:00",
    educationPrograms: ["식이교육", "운동상담"],
  },
  {
    name: "마포구 합정내과센터",
    address: "서울특별시 마포구 양화로 45",
    detailAddress: "서울특별시 마포구 양화로 45, 5층",
    phoneNumber: "02-334-1013",
    verbalEducation: ["맞춤형 운동 처방", "저염식 가이드"],
    isCurrentlyAvailable: true,
    openTime: "09:00",
    closeTime: "18:30",
    educationPrograms: ["식단상담", "운동상담"],
  },
  {
    name: "서대문구 신촌내과의원",
    address: "서울특별시 서대문구 신촌로 109",
    detailAddress: "서울특별시 서대문구 신촌로 109, 2층",
    phoneNumber: "02-312-1014",
    verbalEducation: ["생활습관 코칭", "가정혈압 측정법"],
    isCurrentlyAvailable: true,
    openTime: "09:30",
    closeTime: "18:00",
    educationPrograms: ["복약상담", "생활습관 코칭"],
  },
  {
    name: "서초구 교대내과센터",
    address: "서울특별시 서초구 서초대로 301",
    detailAddress: "서울특별시 서초구 서초대로 301, 6층",
    phoneNumber: "02-585-1015",
    verbalEducation: ["저염식 가이드", "복약 순응도 교육"],
    isCurrentlyAvailable: true,
    openTime: "08:30",
    closeTime: "17:30",
    educationPrograms: ["식이교육", "복약상담"],
  },
  {
    name: "성동구 왕십리내과의원",
    address: "서울특별시 성동구 왕십리로 315",
    detailAddress: "서울특별시 성동구 왕십리로 315, 3층",
    phoneNumber: "02-2292-1016",
    verbalEducation: ["맞춤형 운동 처방", "혈압 일지 작성 교육"],
    isCurrentlyAvailable: true,
    openTime: "09:00",
    closeTime: "18:00",
    educationPrograms: ["운동상담", "생활습관 코칭"],
  },
  {
    name: "성북구 길음내과의원",
    address: "서울특별시 성북구 도봉로 17",
    detailAddress: "서울특별시 성북구 도봉로 17, 4층",
    phoneNumber: "02-915-1017",
    verbalEducation: ["저염식 가이드", "가정혈압 측정법"],
    isCurrentlyAvailable: true,
    openTime: "09:00",
    closeTime: "17:30",
    educationPrograms: ["복약상담", "혈압기 사용법"],
  },
  {
    name: "송파구 잠실내과센터",
    address: "서울특별시 송파구 올림픽로 300",
    detailAddress: "서울특별시 송파구 올림픽로 300, 8층",
    phoneNumber: "02-421-1018",
    verbalEducation: ["맞춤형 운동 처방", "저염식 가이드"],
    isCurrentlyAvailable: true,
    openTime: "09:00",
    closeTime: "18:30",
    educationPrograms: ["식단상담", "운동상담"],
  },
  {
    name: "양천구 목동내과의원",
    address: "서울특별시 양천구 목동동로 223",
    detailAddress: "서울특별시 양천구 목동동로 223, 5층",
    phoneNumber: "02-2643-1019",
    verbalEducation: ["생활습관 코칭", "체중관리 교육"],
    isCurrentlyAvailable: true,
    openTime: "09:30",
    closeTime: "18:00",
    educationPrograms: ["생활습관 코칭", "식이교육"],
  },
  {
    name: "영등포구 여의도내과",
    address: "서울특별시 영등포구 국제금융로 10",
    detailAddress: "서울특별시 영등포구 국제금융로 10, 4층",
    phoneNumber: "02-786-1020",
    verbalEducation: ["저염식 가이드", "복약 순응도 교육"],
    isCurrentlyAvailable: true,
    openTime: "08:30",
    closeTime: "17:30",
    educationPrograms: ["복약상담", "운동상담"],
  },
  {
    name: "용산구 이태원내과의원",
    address: "서울특별시 용산구 이태원로 179",
    detailAddress: "서울특별시 용산구 이태원로 179, 2층",
    phoneNumber: "02-794-1021",
    verbalEducation: ["맞춤형 운동 처방", "가정혈압 측정법"],
    isCurrentlyAvailable: true,
    openTime: "09:00",
    closeTime: "18:00",
    educationPrograms: ["운동상담", "혈압기 사용법"],
  },
  {
    name: "은평구 불광내과센터",
    address: "서울특별시 은평구 통일로 856",
    detailAddress: "서울특별시 은평구 통일로 856, 4층",
    phoneNumber: "02-356-1022",
    verbalEducation: ["저염식 가이드", "혈압 일지 작성 교육"],
    isCurrentlyAvailable: true,
    openTime: "09:00",
    closeTime: "17:30",
    educationPrograms: ["식이교육", "복약상담"],
  },
  {
    name: "종로구 광화문내과의원",
    address: "서울특별시 종로구 종로 33",
    detailAddress: "서울특별시 종로구 종로 33, 6층",
    phoneNumber: "02-732-1023",
    verbalEducation: ["맞춤형 운동 처방", "생활습관 코칭"],
    isCurrentlyAvailable: true,
    openTime: "09:00",
    closeTime: "18:00",
    educationPrograms: ["생활습관 코칭", "운동상담"],
  },
  {
    name: "중구 명동내과센터",
    address: "서울특별시 중구 명동길 26",
    detailAddress: "서울특별시 중구 명동길 26, 5층",
    phoneNumber: "02-777-1024",
    verbalEducation: ["저염식 가이드", "복약 순응도 교육"],
    isCurrentlyAvailable: true,
    openTime: "08:30",
    closeTime: "17:30",
    educationPrograms: ["복약상담", "식단상담"],
  },
  {
    name: "중랑구 상봉내과의원",
    address: "서울특별시 중랑구 망우로 353",
    detailAddress: "서울특별시 중랑구 망우로 353, 3층",
    phoneNumber: "02-434-1025",
    verbalEducation: ["맞춤형 운동 처방", "가정혈압 측정법"],
    isCurrentlyAvailable: true,
    openTime: "09:00",
    closeTime: "18:00",
    educationPrograms: ["운동상담", "혈압기 사용법"],
  },
];

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function isHospitalOpenNow(openTime: string, closeTime: string) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes >= toMinutes(openTime) && currentMinutes <= toMinutes(closeTime);
}

const PARTNER_LOGO_ITEMS = [
  { name: "질병관리청", src: "/kdca.png", width: 145, height: 42 },
  { name: "서울특별시", src: "/seoul.png", width: 145, height: 42 },
  { name: "인제대학교", src: "/inje.png", width: 147, height: 43, slightlyLarger: true },
  { name: "서울대학교", src: "/seoul%20uni.png", width: 145, height: 42 },
  { name: "경희대학교", src: "/kh.png", width: 145, height: 42 },
] as const;

function PartnerLogosRow() {
  return (
    <div
      className="partner-logos-row inline-flex max-w-full flex-row flex-nowrap items-center justify-center gap-5 sm:gap-7 md:gap-9"
      role="group"
      aria-label="협력 기관: 질병관리청, 서울특별시, 인제대학교, 서울대학교, 경희대학교"
    >
      {PARTNER_LOGO_ITEMS.map((item) => (
        <span
          key={item.name}
          className="inline-flex shrink-0 items-center rounded-md bg-white px-2.5 py-1.5 shadow-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.src}
            alt={item.name}
            width={item.width}
            height={item.height}
            className={
              "slightlyLarger" in item && item.slightlyLarger
                ? "h-8 w-auto max-w-[5.75rem] object-contain sm:h-9 sm:max-w-[6.5rem]"
                : "h-7 w-auto max-w-[5rem] object-contain sm:h-8 sm:max-w-[5.75rem]"
            }
          />
        </span>
      ))}
    </div>
  );
}

type ViewTab =
  | "meal"
  | "medicationVerbal"
  | "walking"
  | "map"
  | "noTreatment"
  | "personalDiagnosis"
  | "points"
  | "chsWebsite";

const NO_TREATMENT_REASONS_KEY = "final-no-treatment-reasons-v1";
const PERSONAL_DIAGNOSIS_KEY = "final-personal-diagnosis-v1";

const HYPERTENSION_KNOWLEDGE_QUESTIONS = [
  {
    id: "bp_normal",
    question: "정상 혈압은 대략 수축기 120mmHg 미만, 이완기 80mmHg 미만임을 알고 계신가요?",
  },
  {
    id: "salt",
    question: "나트륨(소금) 줄이기가 고혈압 관리에 중요하다는 것을 알고 계신가요?",
  },
  {
    id: "asymptomatic",
    question: "고혈압은 증상이 없어도 꾸준한 치료·관리가 필요하다는 것을 알고 계신가요?",
  },
  {
    id: "lifestyle",
    question: "체중·운동·금연·절주 등 생활습관이 혈압에 영향을 준다는 것을 알고 계신가요?",
  },
  {
    id: "home_bp",
    question: "가정혈압을 정기적으로 측정·기록하는 것이 중요하다는 것을 알고 계신가요?",
  },
  {
    id: "inbody_role",
    question: "체성분(체지방·근육량 등) 관리가 혈압·대사 건강에 도움이 될 수 있음을 알고 계신가요?",
  },
] as const;

const EMPTY_PERSONAL_DIAGNOSIS_FORM: PersonalDiagnosisForm = {
  name: "",
  gender: "",
  age: "",
  hypertensionDiagnosed: "unsure",
  medications: "",
  weightKg: "",
  inbodyLinked: "no",
  knowledgeAnswers: Object.fromEntries(
    HYPERTENSION_KNOWLEDGE_QUESTIONS.map((q) => [q.id, "unsure" as KnowledgeAnswer]),
  ),
};

const formFieldClass =
  "w-full rounded-[12px] border border-[var(--dark-border)] bg-[var(--dark)] px-3 py-2.5 text-base text-white outline-none placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--stat-blue)]";

function parseStoredDiagnosis(raw: string | null): PersonalDiagnosisResult | null {
  if (!raw) {
    return null;
  }
  try {
    const data = JSON.parse(raw) as Partial<PersonalDiagnosisResult>;
    if (!data || typeof data !== "object" || typeof data.summary !== "string") {
      return null;
    }
    return {
      submittedAt: data.submittedAt ?? Date.now(),
      level: data.level ?? "caution",
      levelLabel: data.levelLabel ?? "참고",
      knowledgeScore: data.knowledgeScore ?? 0,
      summary: data.summary,
      recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
      benchmarkSource:
        data.benchmarkSource ??
        `${KCHS_SEOUL_2024.surveyLabel} N=${KCHS_SEOUL_2024.sampleSize.toLocaleString("ko-KR")}`,
      cohortSegment: data.cohortSegment ?? "집단 비교 정보 없음(재진단 권장)",
      segmentKey: data.segmentKey ?? "prevention",
      cohortComparisons: Array.isArray(data.cohortComparisons) ? data.cohortComparisons : [],
    };
  } catch {
    return null;
  }
}

type NoTreatmentReasonStat = {
  text: string;
  count: number;
  lastSubmittedAt: number;
};

function parseStoredReasons(raw: string | null): NoTreatmentReasonStat[] {
  if (!raw) {
    return [];
  }
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const o = item as Record<string, unknown>;
        const text = typeof o.text === "string" ? o.text.trim() : "";
        const count = typeof o.count === "number" && Number.isFinite(o.count) ? Math.max(1, Math.floor(o.count)) : 1;
        const lastSubmittedAt =
          typeof o.lastSubmittedAt === "number" && Number.isFinite(o.lastSubmittedAt)
            ? o.lastSubmittedAt
            : Date.now();
        if (text.length < 1 || text.length > 500) {
          return null;
        }
        return { text, count, lastSubmittedAt };
      })
      .filter((x): x is NoTreatmentReasonStat => x !== null);
  } catch {
    return [];
  }
}

export default function Home() {
  const [showHospitalList, setShowHospitalList] = useState(false);
  const [contentFilter, setContentFilter] = useState<ContentFilter>("medicationVerbal");
  const [showMap, setShowMap] = useState(true);
  const [progressWidth, setProgressWidth] = useState(0);
  const [showMealPlan, setShowMealPlan] = useState(false);
  const [mealPlanDayIndex, setMealPlanDayIndex] = useState(0);
  const [healthCenterQuery, setHealthCenterQuery] = useState("");
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [showNoTreatmentModal, setShowNoTreatmentModal] = useState(false);
  const [showPersonalDiagnosisModal, setShowPersonalDiagnosisModal] = useState(false);
  const [noTreatmentDraft, setNoTreatmentDraft] = useState("");
  const [totalCount, setTotalCount] = useState<number>(0);
  const [noTreatmentReasons, setNoTreatmentReasons] = useState<NoTreatmentReasonStat[]>([]);

  useEffect(() => {
    supabase.from('reasons').select('reason', { count: 'exact' }).then(({ data, count }) => {
      setTotalCount(count || 0);
      if (!data) return;
      const map: Record<string, number> = {};
      data.forEach(({ reason }: { reason: string }) => { map[reason] = (map[reason] || 0) + 1; });
      setNoTreatmentReasons(
        Object.entries(map).map(([text, count]) => ({ text, count, lastSubmittedAt: Date.now() }))
      );
    });
  }, []);
  const [personalDiagnosisForm, setPersonalDiagnosisForm] = useState<PersonalDiagnosisForm>(
    EMPTY_PERSONAL_DIAGNOSIS_FORM,
  );
  const [personalDiagnosisResult, setPersonalDiagnosisResult] = useState<PersonalDiagnosisResult | null>(
    null,
  );
  const [personalDiagnosisStep, setPersonalDiagnosisStep] = useState<"form" | "result">("form");
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [pointsWallet, setPointsWallet] = useState<PointsWallet>({ total: 0, entries: [] });
  const [pointNotes, setPointNotes] = useState<Record<PointCategory, string>>({
    meal: "",
    hospital: "",
    walking: "",
    wristDoctor: "",
  });
  const [pointMessage, setPointMessage] = useState<string | null>(null);
  const [showChsStats, setShowChsStats] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const hospitalList = useMemo(() => HOSPITALS, []);
  const appTabLinks = useMemo(() => getAppTabLinks(), []);
  const categorizedHospitals = useMemo(
    () =>
      hospitalList.map((hospital, index) => ({
        ...hospital,
        serviceType: (index % 2 === 0 ? "medication" : "verbalRehab") as NonNullable<
          Hospital["serviceType"]
        >,
      })),
    [hospitalList],
  );

  const filteredHospitals = useMemo(() => {
    return categorizedHospitals.filter(
      (hospital) =>
        hospital.serviceType === "medication" || hospital.serviceType === "verbalRehab",
    );
  }, [categorizedHospitals]);

  const mealPlanRow = HYPERTENSION_WEEKLY_MEAL_PLAN[mealPlanDayIndex];

  const filteredHealthCenters = useMemo(() => {
    const q = healthCenterQuery.trim();
    if (!q) {
      return PUBLIC_HEALTH_CENTERS;
    }
    const lower = q.toLowerCase();
    return PUBLIC_HEALTH_CENTERS.filter(
      (c) =>
        c.name.includes(q) ||
        c.region.includes(q) ||
        c.address.includes(q) ||
        c.nutritionPhone.includes(q) ||
        c.name.toLowerCase().includes(lower) ||
        c.region.toLowerCase().includes(lower) ||
        c.address.toLowerCase().includes(lower),
    );
  }, [healthCenterQuery]);

  useEffect(() => {
    setNoTreatmentReasons(parseStoredReasons(localStorage.getItem(NO_TREATMENT_REASONS_KEY)));
    setPersonalDiagnosisResult(parseStoredDiagnosis(localStorage.getItem(PERSONAL_DIAGNOSIS_KEY)));
    setPointsWallet(parseStoredPoints(localStorage.getItem(POINTS_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setProgressWidth(92.3), 150);
    return () => window.clearTimeout(id);
  }, []);

  const activeViewTab: ViewTab = showMealPlan
    ? "meal"
    : showPointsModal
      ? "points"
      : showPersonalDiagnosisModal
        ? "personalDiagnosis"
        : showNoTreatmentModal
          ? "noTreatment"
          : showChsStats
            ? "chsWebsite"
            : showMap
              ? "map"
              : contentFilter === "walking"
                ? "walking"
                : "medicationVerbal";

  const selectViewTab = (tab: ViewTab) => {
    syncAppTabUrl(tab);
    if (tab === "meal") {
      setMealPlanDayIndex(0);
      setShowMealPlan(true);
      setShowChsStats(false);
      return;
    }
    setShowMealPlan(false);
    if (tab === "noTreatment") {
      setShowNoTreatmentModal(true);
      setShowPersonalDiagnosisModal(false);
      setShowPointsModal(false);
      setShowChsStats(false);
      return;
    }
    if (tab === "personalDiagnosis") {
      setShowPersonalDiagnosisModal(true);
      setShowNoTreatmentModal(false);
      setShowPointsModal(false);
      setShowChsStats(false);
      setPersonalDiagnosisStep("form");
      return;
    }
    if (tab === "points") {
      setShowPointsModal(true);
      setShowNoTreatmentModal(false);
      setShowPersonalDiagnosisModal(false);
      setShowChsStats(false);
      setPointMessage(null);
      return;
    }
    setShowNoTreatmentModal(false);
    setShowPersonalDiagnosisModal(false);
    setShowPointsModal(false);
    if (tab === "chsWebsite") {
      setShowChsStats(true);
      setShowMap(false);
      setShowHospitalList(false);
      return;
    }
    setShowChsStats(false);
    if (tab === "map") {
      setShowMap(true);
      setShowHospitalList(false);
      return;
    }
    setShowMap(false);
    setShowHospitalList(true);
    setContentFilter(tab === "walking" ? "walking" : "medicationVerbal");
  };

  useEffect(() => {
    const tab = readAppTabFromUrl();
    if (tab) {
      selectViewTab(tab);
    }
    // 최초 로드 시 URL ?tab= 만 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      window.setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      setCopiedUrl(null);
    }
  };

  const tabClass = (tab: ViewTab) =>
    `rounded-full border px-4 py-2.5 text-base font-medium transition ${
      activeViewTab === tab
        ? tab === "map"
          ? "border-[var(--seoul-blue)] bg-[var(--seoul-blue)] text-white shadow-[0_0_20px_rgba(0,82,164,0.45)]"
          : "border-[var(--stat-blue)]/40 bg-[var(--seoul-blue)]/20 text-[var(--stat-blue)]"
        : "border-[var(--dark-border)] text-[var(--text-secondary)] hover:border-white/20 hover:text-white"
    }`;

  const submitPersonalDiagnosis = () => {
    const result = buildPersonalDiagnosis(
      personalDiagnosisForm,
      HYPERTENSION_KNOWLEDGE_QUESTIONS.length,
    );
    if (!result) {
      return;
    }
    setPersonalDiagnosisResult(result);
    setPersonalDiagnosisStep("result");
    try {
      localStorage.setItem(PERSONAL_DIAGNOSIS_KEY, JSON.stringify(result));
    } catch {
      /* ignore quota */
    }
  };

  const resetPersonalDiagnosisForm = () => {
    setPersonalDiagnosisForm(EMPTY_PERSONAL_DIAGNOSIS_FORM);
    setPersonalDiagnosisStep("form");
  };

  const treatmentLevel = useMemo(() => getTreatmentLevel(pointsWallet.total), [pointsWallet.total]);

  const persistPoints = (wallet: PointsWallet) => {
    setPointsWallet(wallet);
    try {
      localStorage.setItem(POINTS_STORAGE_KEY, JSON.stringify(wallet));
    } catch {
      /* ignore quota */
    }
  };

  const submitPointEarn = (category: PointCategory) => {
    const result = earnPoints(pointsWallet, category, pointNotes[category]);
    if ("error" in result) {
      setPointMessage(result.error);
      return;
    }
    persistPoints(result.wallet);
    setPointNotes((prev) => ({ ...prev, [category]: "" }));
    setPointMessage(`${getRule(category).title} +${result.entry.points}P 적립되었습니다.`);
  };

  const rankedNoTreatmentReasons = useMemo(() => {
    return [...noTreatmentReasons].sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return b.lastSubmittedAt - a.lastSubmittedAt;
    });
  }, [noTreatmentReasons]);

  const submitNoTreatmentReason = () => {
    const text = noTreatmentDraft.replace(/\s+/g, " ").trim().slice(0, 280);
    if (text.length < 2) {
      return;
    }
    const now = Date.now();
    setNoTreatmentReasons((prev) => {
      const idx = prev.findIndex((r) => r.text === text);
      const next: NoTreatmentReasonStat[] =
        idx >= 0
          ? prev.map((r, i) =>
              i === idx ? { ...r, count: r.count + 1, lastSubmittedAt: now } : r,
            )
          : [...prev, { text, count: 1, lastSubmittedAt: now }];
      // Supabase에 저장
      supabase.from('reasons').insert({ reason: text }).then(() => {});
      return next;
    });
    setNoTreatmentDraft("");
  };

  return (
    <div className="relative z-10 flex min-h-screen flex-col text-[var(--text-primary)]">
      <header className="sticky top-0 z-40 border-b border-[var(--dark-border)] bg-[var(--dark)]/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-white px-2 py-1">
              <Image
                src="/seoul.png"
                alt="서울특별시"
                width={120}
                height={36}
                className="h-8 w-auto object-contain"
                priority
              />
            </div>
            <span className="text-xs font-medium text-[var(--text-secondary)] whitespace-nowrap">
              고혈압 치료 연계
            </span>
            <button
              type="button"
              onClick={() => selectViewTab("chsWebsite")}
              className={`rounded-full border px-2 py-1 text-xs font-medium transition whitespace-nowrap ${
                activeViewTab === "chsWebsite"
                  ? "border-[var(--stat-blue)]/40 bg-[var(--seoul-blue)]/20 text-[var(--stat-blue)]"
                  : "border-[var(--dark-border)] text-[var(--text-secondary)] hover:border-white/20 hover:text-white"
              }`}
            >
              누리집 연결하기
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-md border border-[var(--dark-border)] bg-white px-2 py-1">
              <img src="/chs.png" alt="지역사회건강조사" className="h-8 w-auto object-contain" />
            </div>
            <span className="rounded-full border border-[var(--dark-border)] px-2 py-1 text-xs text-[var(--text-secondary)] whitespace-nowrap">
              2026 캠페인 | 5월 16일 ~ 7월 31일
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-12 pt-8 sm:px-6">
        <section className="animate-fade-up mb-6">
          <div className="relative overflow-hidden rounded-3xl px-6 py-4 mb-6" style={{background:"linear-gradient(135deg,#fce4ec 0%,#fdf0f5 60%,#fce4ec 100%)"}}>
            <div className="absolute right-[-20px] top-[-20px] w-32 h-32 rounded-full opacity-20" style={{background:"#d63384"}}></div>
            <div className="absolute right-[30px] bottom-[-30px] w-20 h-20 rounded-full opacity-10" style={{background:"#d63384"}}></div>
            <div className="relative z-10 text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white px-3 py-1 text-sm font-medium text-pink-600 mb-4">
                2026 서울 건강 캠페인
              </span>
              <h1 className="text-lg font-medium leading-snug tracking-tight text-[#1a1a2e] sm:text-2xl mb-2 whitespace-nowrap">
                나머지 <span className="text-[#d63384]">7.7%</span>의 서울시민 건강을 <span className="text-[#2d6a4f]">함께 찾습니다</span>
              </h1>
              <p className="text-sm text-[#888] mb-5">고혈압 치료율 92.3% → 100% 목표</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="rounded-2xl bg-white border border-pink-100 p-3 text-center shadow-sm">
              <p className="text-xs text-[#888] mb-1">치료율</p>
              <p className="text-2xl font-medium text-[#1565c0]">92.3%</p>
            </div>
            <div className="rounded-2xl bg-white border border-pink-100 p-3 text-center shadow-sm">
              <p className="text-xs text-[#888] mb-1">미치료율</p>
              <p className="text-2xl font-medium text-[#d63384]">7.7%</p>
            </div>
            <div className="rounded-2xl bg-white border border-pink-100 p-3 text-center shadow-sm">
              <p className="text-xs text-[#888] mb-1">목표</p>
              <p className="text-2xl font-medium text-[#c62828]">100%</p>
            </div>
          </div>
        </section>

        <section className="card-surface mb-6 flex overflow-hidden" style={{display:"none"}}>
          <div className="flex flex-1 flex-col items-center border-r border-[var(--dark-border)] px-4 py-5 sm:px-6">
            <p className="text-sm text-[var(--text-secondary)]">2024 지역사회건강조사</p>
            <p className="font-display mt-1 text-4xl text-[var(--stat-blue)] sm:text-5xl">92.3%</p>
            <p className="mt-1 text-center text-base text-[var(--text-secondary)]">고혈압 치료율 표준화율</p>
          </div>
          <div className="flex flex-1 flex-col items-center border-r border-[var(--dark-border)] px-4 py-5 sm:px-6">
            <p className="text-sm text-[var(--text-secondary)]">2024 지역사회건강조사</p>
            <p className="font-display mt-1 text-4xl text-[var(--accent)] sm:text-5xl">7.7%</p>
            <p className="mt-1 text-center text-base text-[var(--text-secondary)]">미치료율 추정 비율</p>
          </div>
          <div className="flex flex-1 flex-col items-center px-4 py-5 sm:px-6">
            <p className="text-sm text-[var(--text-secondary)]">목표</p>
            <p className="font-display mt-1 text-4xl text-[var(--seoul-red)] sm:text-5xl">100%</p>
            <p className="mt-1 text-center text-base text-[var(--text-secondary)]">치료 연계율 달성</p>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-2 flex items-center justify-between text-sm text-[var(--text-secondary)]">
            <span>치료율 진행</span>
            <span className="font-display text-lg text-[var(--accent)]">{progressWidth.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="progress-bar-fill" style={{ width: `${progressWidth}%` }} />
          </div>
        </section>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button type="button" className={tabClass("meal")} onClick={() => selectViewTab("meal")}>
            고혈압 일주일 식단 추천
          </button>
          <button type="button" className={tabClass("medicationVerbal")} onClick={() => selectViewTab("medicationVerbal")}>
            약물·구두 치료
          </button>
          <button type="button" className={tabClass("walking")} onClick={() => selectViewTab("walking")}>
            산책로 추천
          </button>
          <button type="button" className={tabClass("map")} onClick={() => selectViewTab("map")}>
            지도 보기
          </button>
          <button type="button" className={tabClass("noTreatment")} onClick={() => selectViewTab("noTreatment")}>
            치료하지 않는 이유
          </button>
          <button
            type="button"
            className={tabClass("personalDiagnosis")}
            onClick={() => selectViewTab("personalDiagnosis")}
          >
            개인진단
          </button>
          <button type="button" className={tabClass("points")} onClick={() => selectViewTab("points")}>
            포인트 적립
          </button>
        </div>

        {showChsStats && (
          <section className="card-surface animate-fade-up mb-6 overflow-hidden p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
              <div className="flex h-[72px] w-[200px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-[var(--dark-border)] bg-white px-2 sm:h-20 sm:w-[220px]">
                <Image
                  src="/chs.png"
                  alt="지역사회건강조사"
                  width={512}
                  height={128}
                  className="h-full w-full object-contain object-center"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-medium">지역사회건강조사 통계집</h2>
                <p className="mt-2 text-base leading-relaxed text-[var(--text-secondary)]">
                  질병관리청 지역사회건강조사 누리집에서 2024년 통계집·지역별
                  건강통계(PDF)를 확인할 수 있습니다. 본 캠페인의 92.3%·7.7% 수치도 이 조사 결과를
                  바탕으로 합니다.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
                  <li>· 누리집 접속 후 「지역사회건강통계」 메뉴 선택</li>
                  <li>· 조사연도 2024 선택 → 서울특별시·보건소별 통계집 다운로드</li>
                  <li>· 전국 표본 약 {KCHS_SEOUL_2024.sampleSize.toLocaleString("ko-KR")}명 규모 자료</li>
                </ul>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a
                    href={EXTERNAL_URLS.chsHealthStats}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-[var(--seoul-blue)] bg-[var(--seoul-blue)] px-5 py-3 text-base font-medium text-white hover:bg-[var(--seoul-blue-light)]"
                  >
                    통계집 누리집 열기
                  </a>
                  <a
                    href={EXTERNAL_URLS.chsHome}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-[var(--dark-border)] px-5 py-3 text-base font-medium text-[var(--text-secondary)] hover:border-white/20 hover:text-white"
                  >
                    지역사회건강조사 홈
                  </a>
                </div>
                <div className="mt-6 rounded-[12px] border border-[var(--dark-border)] bg-[var(--dark)]/50 p-4">
                  <h3 className="text-sm font-medium text-white">연결 URL</h3>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    공식 통계 누리집과, 이 사이트 메뉴별 바로가기 주소입니다.
                  </p>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[var(--text-secondary)]">지역사회건강통계 (통계집)</span>
                      <div className="flex min-w-0 items-center gap-2">
                        <code className="truncate text-xs text-[var(--stat-blue)] sm:text-sm">
                          {EXTERNAL_URLS.chsHealthStats}
                        </code>
                        <button
                          type="button"
                          className="shrink-0 rounded-full border border-[var(--dark-border)] px-2 py-0.5 text-xs hover:bg-white/10"
                          onClick={() => copyUrl(EXTERNAL_URLS.chsHealthStats)}
                        >
                          {copiedUrl === EXTERNAL_URLS.chsHealthStats ? "복사됨" : "복사"}
                        </button>
                      </div>
                    </li>
                    <li className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[var(--text-secondary)]">이 페이지 · 누리집 연결</span>
                      <div className="flex min-w-0 items-center gap-2">
                        <code className="truncate text-xs text-[var(--accent)] sm:text-sm">
                          {buildAppUrl("chsWebsite")}
                        </code>
                        <button
                          type="button"
                          className="shrink-0 rounded-full border border-[var(--dark-border)] px-2 py-0.5 text-xs hover:bg-white/10"
                          onClick={() => copyUrl(buildAppUrl("chsWebsite"))}
                        >
                          {copiedUrl === buildAppUrl("chsWebsite") ? "복사됨" : "복사"}
                        </button>
                      </div>
                    </li>
                  </ul>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-[var(--stat-blue)]">
                      메뉴별 사이트 URL 모두 보기
                    </summary>
                    <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                      {appTabLinks.map((item) => (
                        <li
                          key={item.tab}
                          className="flex flex-col gap-1 border-t border-[var(--dark-border)] pt-2 first:border-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="text-[var(--text-muted)]">{item.label}</span>
                          <div className="flex min-w-0 items-center gap-2">
                            <code className="truncate text-xs text-[var(--text-secondary)]">{item.url}</code>
                            <button
                              type="button"
                              className="shrink-0 rounded-full border border-[var(--dark-border)] px-2 py-0.5 text-xs hover:bg-white/10"
                              onClick={() => copyUrl(item.url)}
                            >
                              {copiedUrl === item.url ? "복사됨" : "복사"}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              </div>
            </div>
          </section>
        )}

        {showHospitalList && contentFilter === "medicationVerbal" && (
          <section className="animate-fade-up mb-6">
            <div className="rounded-3xl overflow-hidden" style={{background:"linear-gradient(135deg,#fce4ec 0%,#fdf0f5 60%,#e8f5e9 100%)"}}>
              <div className="px-5 pt-5 pb-4">
                <span className="text-xs font-medium text-pink-500 bg-pink-50 border border-pink-100 rounded-full px-3 py-1">내 주변 치료기관 찾기</span>
                <h2 className="mt-2 text-lg font-medium text-[#1a1a2e]">내가 있는 지역은?</h2>
                <p className="text-sm text-[#888] mt-1">지역을 입력하면 주변 약물·구두 치료 가능 병원을 추천해드려요</p>
                <div className="mt-4 flex gap-2">
                  <input
                    id="region-input"
                    type="text"
                    placeholder="예: 강남구, 마포구, 송파구..."
                    className="flex-1 rounded-2xl border border-pink-100 bg-white px-4 py-3 text-sm text-[#1a1a2e] outline-none focus:border-pink-300"
                  />
                  <button
                    onClick={() => {
                      const region = (document.getElementById("region-input") as HTMLInputElement)?.value.trim();
                      const result = document.getElementById("hospital-result");
                      if (!region) { if(result) result.innerHTML = "<p style=\'color:#d63384;font-size:13px;padding:12px\'>지역을 입력해주세요.</p>"; return; }
                      const allHospitals = [
                        {name:"강남구 서울강남내과",addr:"테헤란로 212",phone:"02-501-1001",review:"혈압약 처방 꼼꼼. 대기 짧아요",stars:5,tag:"약물치료"},
                        {name:"강남구 대치미래내과",addr:"대치동 은마로 201",phone:"02-554-2020",review:"식단 상담도 해줘요",stars:5,tag:"구두교육"},
                        {name:"강남구 역삼파크내과",addr:"역삼로 153",phone:"02-563-1234",review:"예약 빠르고 친절해요",stars:4,tag:"약물치료"},
                        {name:"강남구 압구정연세내과",addr:"압구정로 165",phone:"02-548-3300",review:"혈압 전문의 상주",stars:5,tag:"구두교육"},
                        {name:"강남구 도곡내과클리닉",addr:"도곡로 173",phone:"02-572-5500",review:"생활습관 코칭 최고",stars:4,tag:"약물치료"},
                        {name:"서초구 교대내과센터",addr:"서초대로 301",phone:"02-585-1015",review:"식단 상담 자세해요",stars:4,tag:"구두교육"},
                        {name:"서초구 반포내과의원",addr:"반포대로 58",phone:"02-533-2200",review:"복약 상담 꼼꼼해요",stars:5,tag:"약물치료"},
                        {name:"서초구 방배연세내과",addr:"방배로 192",phone:"02-591-3300",review:"운동처방 병행해줘요",stars:4,tag:"구두교육"},
                        {name:"서초구 서초한내과",addr:"서초중앙로 148",phone:"02-587-7700",review:"혈압 모니터링 철저",stars:5,tag:"약물치료"},
                        {name:"서초구 양재메디내과",addr:"양재대로 201",phone:"02-579-5500",review:"정기검진 추천해요",stars:4,tag:"구두교육"},
                        {name:"마포구 합정내과센터",addr:"양화로 45",phone:"02-334-1013",review:"가깝고 예약 빠름",stars:5,tag:"구두교육"},
                        {name:"마포구 홍대연세내과",addr:"홍익로 15",phone:"02-323-3030",review:"젊은 의사 친절해요",stars:4,tag:"약물치료"},
                        {name:"마포구 공덕한내과",addr:"마포대로 86",phone:"02-711-5500",review:"대기 짧고 설명 자세",stars:5,tag:"구두교육"},
                        {name:"마포구 신촌세브란스내과",addr:"신촌로 52",phone:"02-392-7700",review:"혈압약 맞춤 처방",stars:5,tag:"약물치료"},
                        {name:"마포구 상암연세내과",addr:"상암산로 34",phone:"02-305-3300",review:"저염식 가이드 줘요",stars:4,tag:"구두교육"},
                        {name:"송파구 잠실내과센터",addr:"올림픽로 300",phone:"02-421-1018",review:"운동 처방도 해줘요",stars:5,tag:"구두교육"},
                        {name:"송파구 방이동내과",addr:"백제고분로 36",phone:"02-416-7700",review:"저염식 레시피 카드 줘요",stars:4,tag:"약물치료"},
                        {name:"송파구 문정연세내과",addr:"문정로 58",phone:"02-407-3300",review:"혈압일지 교육해줘요",stars:5,tag:"구두교육"},
                        {name:"송파구 가락메디내과",addr:"가락로 108",phone:"02-449-5500",review:"복약 상담 꼼꼼해요",stars:4,tag:"약물치료"},
                        {name:"송파구 위례내과클리닉",addr:"위례성대로 14",phone:"02-431-7700",review:"신규 시설 깨끗해요",stars:5,tag:"구두교육"},
                        {name:"성동구 왕십리내과의원",addr:"왕십리로 315",phone:"02-2292-1016",review:"친절하고 설명 자세함",stars:4,tag:"약물치료"},
                        {name:"성동구 성수내과클리닉",addr:"성수이로 78",phone:"02-466-3300",review:"혈압일지 작성 교육",stars:5,tag:"구두교육"},
                        {name:"성동구 행당연세내과",addr:"행당로 76",phone:"02-2294-5500",review:"혈압약 처방 빠르고 친절",stars:4,tag:"약물치료"},
                        {name:"성동구 뚝섬내과의원",addr:"자동차시장길 48",phone:"02-464-3300",review:"생활습관 코칭 좋아요",stars:5,tag:"구두교육"},
                        {name:"성동구 마장메디내과",addr:"마장로 210",phone:"02-2293-7700",review:"운동처방 연계해줘요",stars:4,tag:"약물치료"},
                        {name:"노원구 상계내과센터",addr:"동일로 1405",phone:"02-938-1009",review:"대기없이 빨리 봐줌",stars:5,tag:"구두교육"},
                        {name:"노원구 중계우리내과",addr:"동일로 1318",phone:"02-951-2200",review:"혈압약 맞춤 처방",stars:4,tag:"약물치료"},
                        {name:"노원구 공릉연세내과",addr:"공릉로 232",phone:"02-978-3300",review:"저염식 가이드 자세해요",stars:5,tag:"구두교육"},
                        {name:"노원구 월계내과의원",addr:"월계로 45",phone:"02-945-5500",review:"어르신 친절 대응",stars:4,tag:"약물치료"},
                        {name:"노원구 하계메디내과",addr:"한글비석로 76",phone:"02-933-7700",review:"혈압 모니터링 철저",stars:5,tag:"구두교육"},
                        {name:"은평구 불광내과센터",addr:"통일로 856",phone:"02-356-1022",review:"저염식 가이드 좋아요",stars:4,tag:"약물치료"},
                        {name:"은평구 응암연세내과",addr:"응암로 74",phone:"02-388-1004",review:"생활습관 개선 프로그램",stars:5,tag:"구두교육"},
                        {name:"은평구 녹번내과의원",addr:"은평로 149",phone:"02-352-3300",review:"복약 교육 꼼꼼해요",stars:4,tag:"약물치료"},
                        {name:"은평구 진관내과클리닉",addr:"진관길 82",phone:"02-357-5500",review:"새 시설 깨끗해요",stars:5,tag:"구두교육"},
                        {name:"은평구 구산메디내과",addr:"갈현로 115",phone:"02-383-7700",review:"혈압약 처방 전문",stars:4,tag:"약물치료"},
                        {name:"강서구 공항내과의원",addr:"공항대로 247",phone:"02-2662-1004",review:"복약 상담 친절해요",stars:5,tag:"구두교육"},
                        {name:"강서구 화곡튼튼내과",addr:"화곡로 68",phone:"02-2601-7700",review:"혈압 모니터링 잘해줘요",stars:4,tag:"약물치료"},
                        {name:"강서구 등촌연세내과",addr:"등촌로 88",phone:"02-2655-3300",review:"식단상담 자세히 해줘요",stars:5,tag:"구두교육"},
                        {name:"강서구 발산내과의원",addr:"발산역로 56",phone:"02-2668-5500",review:"운동처방 병행해줘요",stars:4,tag:"약물치료"},
                        {name:"강서구 마곡메디내과",addr:"마곡중앙로 155",phone:"02-2669-7700",review:"신규 시설 깨끗해요",stars:5,tag:"구두교육"},
                        {name:"관악구 서울관악내과",addr:"남부순환로 1820",phone:"02-877-1005",review:"혈압약 맞춤 처방",stars:4,tag:"약물치료"},
                        {name:"관악구 신림중앙내과",addr:"신림로 254",phone:"02-856-3300",review:"식이교육 자세해요",stars:5,tag:"구두교육"},
                        {name:"관악구 봉천연세내과",addr:"봉천로 456",phone:"02-885-3300",review:"친절하고 꼼꼼해요",stars:4,tag:"약물치료"},
                        {name:"관악구 낙성대내과",addr:"관악로 268",phone:"02-873-5500",review:"혈압일지 교육 좋아요",stars:5,tag:"구두교육"},
                        {name:"관악구 서울대입구메디내과",addr:"남부순환로 1600",phone:"02-876-7700",review:"대학병원급 전문성",stars:5,tag:"약물치료"},
                        {name:"구로구 신도림내과",addr:"경인로 661",phone:"02-2632-1007",review:"체중 관리 함께 도와줌",stars:5,tag:"구두교육"},
                        {name:"구로구 고려대구로내과",addr:"구로동로 148",phone:"02-2626-1500",review:"혈압 전문 클리닉",stars:5,tag:"약물치료"},
                        {name:"구로구 개봉연세내과",addr:"개봉로 130",phone:"02-2614-3300",review:"복약 교육 꼼꼼",stars:4,tag:"구두교육"},
                        {name:"구로구 오류내과의원",addr:"오류로 78",phone:"02-2614-5500",review:"친절하고 대기 짧아요",stars:4,tag:"약물치료"},
                        {name:"구로구 온수메디내과",addr:"경인로 727",phone:"02-2611-7700",review:"생활습관 코칭 해줘요",stars:5,tag:"구두교육"},
                        {name:"양천구 목동내과의원",addr:"목동동로 223",phone:"02-2643-1019",review:"생활습관 코칭 최고",stars:5,tag:"약물치료"},
                        {name:"양천구 신정연세내과",addr:"신목로 32",phone:"02-2643-5500",review:"혈압 관리 전문",stars:4,tag:"구두교육"},
                        {name:"양천구 목동한내과",addr:"목동로 309",phone:"02-2647-3300",review:"정기 모니터링 해줘요",stars:5,tag:"약물치료"},
                        {name:"양천구 신월내과클리닉",addr:"신월로 267",phone:"02-2606-5500",review:"혈압약 처방 빠르고 친절",stars:4,tag:"구두교육"},
                        {name:"양천구 목동메디내과",addr:"목동중앙북로 56",phone:"02-2645-7700",review:"운동처방 연계해줘요",stars:5,tag:"약물치료"},
                        {name:"영등포구 여의도내과",addr:"국제금융로 10",phone:"02-786-1020",review:"직장인 점심 진료 가능",stars:4,tag:"구두교육"},
                        {name:"영등포구 당산서울내과",addr:"당산로 121",phone:"02-2637-7500",review:"혈압약 설명 자세해요",stars:5,tag:"약물치료"},
                        {name:"영등포구 영등포연세내과",addr:"영등포로 246",phone:"02-2634-3300",review:"식단 상담 좋아요",stars:4,tag:"구두교육"},
                        {name:"영등포구 문래내과의원",addr:"문래로 20",phone:"02-2677-5500",review:"복약 순응도 교육 잘해요",stars:5,tag:"약물치료"},
                        {name:"영등포구 대림메디내과",addr:"도림로 142",phone:"02-2636-7700",review:"저염식 가이드 줘요",stars:4,tag:"구두교육"},
                        {name:"동작구 사당내과의원",addr:"동작대로 89",phone:"02-595-1012",review:"체중관리 교육 좋아요",stars:4,tag:"약물치료"},
                        {name:"동작구 노량진메디내과",addr:"노량진로 93",phone:"02-814-2200",review:"구두교육 프로그램 운영",stars:5,tag:"구두교육"},
                        {name:"동작구 상도연세내과",addr:"상도로 328",phone:"02-823-3300",review:"혈압약 처방 꼼꼼해요",stars:4,tag:"약물치료"},
                        {name:"동작구 이수내과클리닉",addr:"동작대로 204",phone:"02-597-5500",review:"운동처방 병행해줘요",stars:5,tag:"구두교육"},
                        {name:"동작구 흑석메디내과",addr:"흑석로 58",phone:"02-813-7700",review:"생활습관 코칭 좋아요",stars:4,tag:"약물치료"},
                        {name:"종로구 광화문내과의원",addr:"종로 33",phone:"02-732-1023",review:"운동 처방 전문",stars:5,tag:"구두교육"},
                        {name:"종로구 혜화연세내과",addr:"창경궁로 254",phone:"02-742-3300",review:"혈압일지 꼼꼼히 봐줘요",stars:4,tag:"약물치료"},
                        {name:"종로구 경복궁내과",addr:"자하문로 36",phone:"02-722-5500",review:"친절하고 설명 자세해요",stars:5,tag:"구두교육"},
                        {name:"종로구 종로연세내과",addr:"종로 156",phone:"02-734-3300",review:"복약 교육 꼼꼼해요",stars:4,tag:"약물치료"},
                        {name:"종로구 인사동메디내과",addr:"인사동길 42",phone:"02-725-7700",review:"저염식 가이드 줘요",stars:5,tag:"구두교육"},
                        {name:"중구 명동내과센터",addr:"명동길 26",phone:"02-777-1024",review:"접근성 최고",stars:4,tag:"약물치료"},
                        {name:"중구 을지로내과클리닉",addr:"을지로 66",phone:"02-2266-5500",review:"직장인 혈압 관리",stars:5,tag:"구두교육"},
                        {name:"중구 충무로연세내과",addr:"퇴계로 263",phone:"02-2274-3300",review:"혈압약 처방 빠르고 친절",stars:4,tag:"약물치료"},
                        {name:"중구 동대문내과의원",addr:"장충단로 244",phone:"02-2252-5500",review:"운동처방 연계해줘요",stars:5,tag:"구두교육"},
                        {name:"중구 서울역메디내과",addr:"한강대로 405",phone:"02-754-7700",review:"생활습관 코칭 해줘요",stars:4,tag:"약물치료"},
                        {name:"강북구 미아내과의원",addr:"도봉로 346",phone:"02-989-1003",review:"가정혈압 측정법 교육",stars:5,tag:"구두교육"},
                        {name:"강북구 수유연세내과",addr:"한천로 897",phone:"02-901-7700",review:"혈압약 처방 꼼꼼해요",stars:4,tag:"약물치료"},
                        {name:"강북구 번동내과클리닉",addr:"번동로 58",phone:"02-985-3300",review:"저염식 가이드 좋아요",stars:5,tag:"구두교육"},
                        {name:"강북구 우이메디내과",addr:"우이천로 245",phone:"02-993-5500",review:"친절하고 대기 짧아요",stars:4,tag:"약물치료"},
                        {name:"강북구 삼양내과의원",addr:"삼양로 267",phone:"02-988-7700",review:"복약 교육 꼼꼼해요",stars:5,tag:"구두교육"},
                        {name:"도봉구 창동내과의원",addr:"마들로 657",phone:"02-993-1010",review:"저염식 레시피도 줘요",stars:4,tag:"약물치료"},
                        {name:"도봉구 방학우리내과",addr:"방학로 142",phone:"02-955-3300",review:"혈압 모니터링 잘해줘요",stars:5,tag:"구두교육"},
                        {name:"도봉구 도봉연세내과",addr:"도봉로 576",phone:"02-957-3300",review:"운동처방 병행해줘요",stars:4,tag:"약물치료"},
                        {name:"도봉구 쌍문내과클리닉",addr:"도봉로 464",phone:"02-902-5500",review:"혈압약 처방 빠르고 친절",stars:5,tag:"구두교육"},
                        {name:"도봉구 북한산메디내과",addr:"시루봉로 36",phone:"02-954-7700",review:"생활습관 코칭 좋아요",stars:4,tag:"약물치료"},
                        {name:"중랑구 상봉내과의원",addr:"망우로 353",phone:"02-434-1025",review:"혈압기 사용법 가르쳐줌",stars:5,tag:"구두교육"},
                        {name:"중랑구 면목연세내과",addr:"용마산로 105",phone:"02-493-5500",review:"복약 순응도 교육",stars:4,tag:"약물치료"},
                        {name:"중랑구 신내메디내과",addr:"신내역로 38",phone:"02-438-3300",review:"새 시설 깨끗해요",stars:5,tag:"구두교육"},
                        {name:"중랑구 묵동내과의원",addr:"중랑천로 235",phone:"02-436-5500",review:"저염식 가이드 자세해요",stars:4,tag:"약물치료"},
                        {name:"중랑구 망우연세내과",addr:"망우로 491",phone:"02-432-7700",review:"친절하고 꼼꼼해요",stars:5,tag:"구두교육"},
                        {name:"성북구 길음내과의원",addr:"도봉로 17",phone:"02-915-1017",review:"저염식 가이드 자세해요",stars:4,tag:"구두교육"},
                        {name:"성북구 돈암서울내과",addr:"동소문로 133",phone:"02-927-3300",review:"혈압약 처방 빠르고 친절",stars:5,tag:"약물치료"},
                        {name:"성북구 정릉연세내과",addr:"정릉로 241",phone:"02-916-3300",review:"운동처방 병행해줘요",stars:4,tag:"구두교육"},
                        {name:"성북구 석계내과클리닉",addr:"화랑로 152",phone:"02-918-5500",review:"복약 교육 꼼꼼해요",stars:5,tag:"약물치료"},
                        {name:"성북구 장위메디내과",addr:"장위로 45",phone:"02-913-7700",review:"생활습관 코칭 좋아요",stars:4,tag:"구두교육"},
                        {name:"동대문구 청량리내과",addr:"왕산로 214",phone:"02-962-1011",review:"가정혈압 측정법 교육",stars:5,tag:"약물치료"},
                        {name:"동대문구 장안연세내과",addr:"장한로 74",phone:"02-2244-5500",review:"혈압 전문 클리닉",stars:4,tag:"구두교육"},
                        {name:"동대문구 회기내과의원",addr:"회기로 121",phone:"02-966-3300",review:"혈압약 처방 꼼꼼해요",stars:5,tag:"약물치료"},
                        {name:"동대문구 답십리메디내과",addr:"답십리로 78",phone:"02-2213-5500",review:"저염식 가이드 줘요",stars:4,tag:"구두교육"},
                        {name:"동대문구 이문내과클리닉",addr:"이문로 56",phone:"02-967-7700",review:"친절하고 대기 짧아요",stars:5,tag:"약물치료"},
                        {name:"광진구 자양내과의원",addr:"아차산로 355",phone:"02-446-1006",review:"운동 상담 병행해줘요",stars:5,tag:"구두교육"},
                        {name:"광진구 건대연세내과",addr:"능동로 120",phone:"02-457-3300",review:"혈압약 맞춤 처방 전문",stars:4,tag:"약물치료"},
                        {name:"광진구 구의내과의원",addr:"구의강변로 48",phone:"02-453-3300",review:"복약 교육 꼼꼼해요",stars:5,tag:"구두교육"},
                        {name:"광진구 중곡메디내과",addr:"중곡로 58",phone:"02-493-5500",review:"저염식 가이드 자세해요",stars:4,tag:"약물치료"},
                        {name:"광진구 화양내과클리닉",addr:"화양리로 24",phone:"02-458-7700",review:"생활습관 코칭 좋아요",stars:5,tag:"구두교육"},
                        {name:"금천구 시흥내과의원",addr:"시흥대로 403",phone:"02-896-1008",review:"생활습관 코칭 좋아요",stars:4,tag:"구두교육"},
                        {name:"금천구 가산메디내과",addr:"디지털로 130",phone:"02-806-5500",review:"IT단지 직장인 혈압 전문",stars:5,tag:"약물치료"},
                        {name:"금천구 독산연세내과",addr:"독산로 288",phone:"02-858-3300",review:"혈압약 처방 꼼꼼해요",stars:4,tag:"구두교육"},
                        {name:"금천구 시흥내과클리닉",addr:"금하로 302",phone:"02-805-5500",review:"복약 교육 자세해요",stars:5,tag:"약물치료"},
                        {name:"금천구 박미내과의원",addr:"박미로 234",phone:"02-807-7700",review:"친절하고 대기 짧아요",stars:4,tag:"구두교육"},
                        {name:"강동구 바른내과의원",addr:"천호대로 1095",phone:"02-482-1002",review:"혈압 일지 작성 교육",stars:5,tag:"구두교육"},
                        {name:"강동구 천호연세내과",addr:"천호대로 1007",phone:"02-473-3300",review:"복약 교육 꼼꼼해요",stars:4,tag:"약물치료"},
                        {name:"강동구 암사내과의원",addr:"암사대로 48",phone:"02-442-3300",review:"저염식 가이드 자세해요",stars:5,tag:"구두교육"},
                        {name:"강동구 성내메디내과",addr:"성내로 58",phone:"02-474-5500",review:"혈압약 처방 빠르고 친절",stars:4,tag:"약물치료"},
                        {name:"강동구 길동내과클리닉",addr:"길동로 68",phone:"02-478-7700",review:"생활습관 코칭 해줘요",stars:5,tag:"구두교육"},
                        {name:"용산구 이태원내과의원",addr:"이태원로 179",phone:"02-794-1021",review:"외국어 가능. 혈압 전문",stars:4,tag:"약물치료"},
                        {name:"용산구 삼각지서울내과",addr:"한강대로 320",phone:"02-793-5500",review:"혈압 모니터링 철저해요",stars:5,tag:"구두교육"},
                        {name:"용산구 한남연세내과",addr:"한남대로 36",phone:"02-797-3300",review:"식단상담 자세해요",stars:4,tag:"약물치료"},
                        {name:"용산구 후암내과클리닉",addr:"후암로 52",phone:"02-753-5500",review:"복약 교육 꼼꼼해요",stars:5,tag:"구두교육"},
                        {name:"용산구 효창메디내과",addr:"효창원로 66",phone:"02-715-7700",review:"운동처방 병행해줘요",stars:4,tag:"약물치료"},
                        {name:"서대문구 신촌내과의원",addr:"신촌로 109",phone:"02-312-1014",review:"생활습관 코칭. 친절",stars:5,tag:"약물치료"},
                        {name:"서대문구 홍제연세내과",addr:"통일로 484",phone:"02-392-3300",review:"가정혈압 교육 잘해줘요",stars:4,tag:"구두교육"},
                        {name:"서대문구 연희내과의원",addr:"연희로 136",phone:"02-333-3300",review:"혈압약 처방 꼼꼼해요",stars:5,tag:"약물치료"},
                        {name:"서대문구 북가좌메디내과",addr:"가좌로 48",phone:"02-376-5500",review:"저염식 가이드 자세해요",stars:4,tag:"구두교육"},
                        {name:"서대문구 남가좌내과클리닉",addr:"증가로 68",phone:"02-374-7700",review:"친절하고 대기 짧아요",stars:5,tag:"약물치료"},
                      ];
                      const matched = allHospitals.filter(h => h.name.includes(region) || h.addr.includes(region) || region.includes(h.name.split(" ")[0]));
                      if (matched.length === 0) {
                        if(result) result.innerHTML = "<div style=\'padding:20px;text-align:center\'><p style=\'color:#d63384;font-size:14px;font-weight:500\'>해당 지역 병원을 찾지 못했어요</p><p style=\'color:#888;font-size:13px;margin-top:4px\'>강남구, 마포구, 송파구 등 구 이름으로 검색해보세요</p></div>";
                        return;
                      }
                      const stars = (n: number) => "★".repeat(n) + "☆".repeat(5-n);
                      const cards = matched.map(h => "<div style=\'padding:14px;border-radius:16px;background:white;border:1px solid #f0e0e8;margin-bottom:10px\'><div style=\'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px\'><div><p style=\'font-weight:500;color:#1a1a2e;font-size:14px\'>" + h.name + "</p><p style=\'font-size:12px;color:#888;margin-top:2px\'>" + h.addr + "</p></div><span style=\'font-size:11px;background:#fce4ec;color:#d63384;padding:3px 10px;border-radius:999px;white-space:nowrap\'>" + h.tag + "</span></div><div style=\'display:flex;justify-content:space-between;align-items:center\'><div><p style=\'font-size:12px;color:#f59e0b\'>" + stars(h.stars) + "</p><p style=\'font-size:12px;color:#555;margin-top:2px\'>" + h.review + "</p></div><a href=\'tel:" + h.phone.replace(/-/g,"") + "\' style=\'font-size:12px;color:#d63384;border:1px solid #f8bbd0;border-radius:999px;padding:4px 12px;text-decoration:none\'>전화하기</a></div></div>").join("");
                      if(result) result.innerHTML = "<div style=\'margin-top:4px\'><p style=\'font-size:13px;color:#888;margin-bottom:12px\'>" + region + " 주변 추천 병원 " + matched.length + "곳 (후기 좋은 순)</p>" + cards + "</div>";
                    }}
                    className="rounded-2xl px-5 py-3 text-sm font-medium text-white whitespace-nowrap"
                    style={{background:"#d63384"}}
                  >
                    찾기
                  </button>
                </div>
                <div id="hospital-result" className="mt-2"></div>
              </div>
            </div>
            <ul className="hidden">
              {filteredHospitals.map((hospital) => {
                const isOpenNow =
                  hospital.isCurrentlyAvailable &&
                  isHospitalOpenNow(hospital.openTime, hospital.closeTime);

                return (
                  <li
                    key={hospital.name}
                    className="card-surface group cursor-pointer p-4 transition-all duration-200 hover:translate-x-1 hover:border-[var(--stat-blue)]/50"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <button
                          type="button"
                          className="text-left text-base text-[var(--stat-blue)] hover:underline"
                          onClick={() => setSelectedHospital(hospital)}
                          aria-label={`${hospital.name} 상세 정보`}
                        >
                          {hospital.address}
                        </button>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{hospital.detailAddress}</p>
                        <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                          진료시간: {hospital.openTime} ~ {hospital.closeTime}
                        </p>
                      </div>
                      <div className="flex flex-col items-start gap-2 md:items-end">
                        <span
                          className={`text-sm font-medium ${isOpenNow ? "text-[var(--accent)]" : "text-[var(--seoul-red)]"}`}
                        >
                          {isOpenNow ? "진료 중" : "진료 종료"}
                        </span>
                        {hospital.educationPrograms && (
                          <>
                            <span className="rounded-full border border-[var(--dark-border)] bg-white/5 px-2.5 py-0.5 text-sm text-[var(--text-secondary)]">
                              구두 교육 우수 기관
                            </span>
                            <p className="max-w-xs text-sm text-[var(--text-muted)] md:text-right">
                              {hospital.educationPrograms.join(", ")}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

        )}

        {showHospitalList && contentFilter === "walking" && (
          <section className="animate-fade-up mb-6 space-y-4">

                                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-medium text-[#1a1a2e]">AI 맞춤 산책 코스 추천</h2>
                      <span className="text-xs text-pink-400 bg-pink-50 px-2 py-1 rounded-full">혈압 맞춤</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="text-xs text-[#888] mb-1 block">나이</label>
                        <input id="ai-age" type="number" placeholder="예: 45" className="w-full rounded-xl border border-pink-100 bg-pink-50/30 px-3 py-2 text-sm text-[#1a1a2e]" />
                      </div>
                      <div>
                        <label className="text-xs text-[#888] mb-1 block">수축기 혈압</label>
                        <input id="ai-bp" type="number" placeholder="예: 135" className="w-full rounded-xl border border-pink-100 bg-pink-50/30 px-3 py-2 text-sm text-[#1a1a2e]" />
                      </div>
                      <div>
                        <label className="text-xs text-[#888] mb-1 block">운동 강도</label>
                        <select id="ai-level" className="w-full rounded-xl border border-pink-100 bg-white px-3 py-2 text-sm text-[#1a1a2e]">
                          <option value="easy">가볍게</option>
                          <option value="medium">보통</option>
                          <option value="hard">강하게</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-[#888] mb-1 block">가능 시간</label>
                        <select id="ai-time" className="w-full rounded-xl border border-pink-100 bg-white px-3 py-2 text-sm text-[#1a1a2e]">
                          <option value="20">20분</option>
                          <option value="30">30분</option>
                          <option value="60">1시간</option>
                          <option value="90">1시간 30분</option>
                        </select>
                      </div>
                    </div>
                    <button onClick={() => {
                      const age = (document.getElementById("ai-age") as HTMLInputElement)?.value;
                      const bp = parseInt((document.getElementById("ai-bp") as HTMLInputElement)?.value);
                      const time = (document.getElementById("ai-time") as HTMLSelectElement)?.value;
                      const result = document.getElementById("ai-result");
                      if (!age || !bp) { if(result) result.innerHTML = "<p style=\'color:#d63384;font-size:13px\'>나이와 혈압을 입력해주세요.</p>"; return; }
                      const ageNum = parseInt(age);
                      const level = (document.getElementById("ai-level") as HTMLSelectElement)?.value;
                      const timeNum = parseInt(time);
                      type Course = {name:string;loc:string;dist:string;desc:string;tag:string};
                      const flat:Course[] = [
                        {name:"한강공원 여의도 북단",loc:"서울 영등포",dist:"3km",desc:"완전 평지, 자전거도로와 분리돼 안전하게 걷기 좋아요. 벤치도 많아요.",tag:"초보"},
                        {name:"청계천 광통교~세운교",loc:"서울 종로·중구",dist:"2.4km",desc:"도심 속 하천길, 그늘 많고 중간 쉼터 풍부. 혈압 높을 때 최적.",tag:"초보"},
                        {name:"올림픽공원 평지 순환",loc:"서울 송파",dist:"3.5km",desc:"넓은 잔디광장, 완전 평지. 스트레칭 후 천천히 걷기에 완벽.",tag:"초보"},
                        {name:"석촌호수 둘레길",loc:"서울 송파",dist:"2.7km",desc:"호수 바람이 시원해요. 사계절 언제나 쾌적하게 걸을 수 있어요.",tag:"초보"},
                        {name:"양재천 산책로",loc:"서울 강남·서초",dist:"4km",desc:"평지 하천길, 봄엔 벚꽃 명소. 중간 중간 운동 기구도 있어요.",tag:"초보"},
                      ];
                      const moderate:Course[] = [
                        {name:"서울숲 둘레길",loc:"서울 성동",dist:"3.2km",desc:"완만한 오르막 포함, 숲 속 피톤치드로 스트레스 해소에도 좋아요.",tag:"중급"},
                        {name:"남산 순환로 (하단)",loc:"서울 중구·용산",dist:"4km",desc:"완만한 경사, 도심 전망 최고. 케이블카 탑승지점까지 걸어도 OK.",tag:"중급"},
                        {name:"북악산 성곽길 (하단부)",loc:"서울 종로",dist:"3.5km",desc:"역사적인 성곽을 따라 걷는 코스. 경사 완만한 하단부만 추천.",tag:"중급"},
                        {name:"관악산 둘레길",loc:"서울 관악",dist:"5km",desc:"산 중턱 둘레길로 험하지 않아요. 도시 속 자연을 느끼기 좋아요.",tag:"중급"},
                        {name:"아차산 생태공원",loc:"서울 광진",dist:"4.5km",desc:"완만한 숲길, 한강 조망 포인트 있음. 초보~중급 딱 맞는 코스.",tag:"중급"},
                        {name:"용마산~망우산 둘레길",loc:"서울 중랑",dist:"5.5km",desc:"능선 따라 걷는 숲길, 중간 쉬는 곳 많아 무리 없이 걸 수 있어요.",tag:"중급"},
                      ];
                      const hard:Course[] = [
                        {name:"북한산 둘레길 1구간",loc:"서울·경기",dist:"4.5km",desc:"숲길 파워워킹, 심폐 기능 강화에 최적. 혈압 안정적일 때 추천.",tag:"상급"},
                        {name:"도봉산 도봉탐방지원센터~마당바위",loc:"서울 도봉",dist:"4km",desc:"완만한 계곡길, 여름엔 시원하고 가을 단풍 명소. 중간 하산 가능.",tag:"상급"},
                        {name:"수락산 기차바위 코스",loc:"서울 노원·경기 의정부",dist:"6km",desc:"능선 조망 훌륭, 바위 지대 있어 집중력 필요. 체력 충분할 때 도전.",tag:"상급"},
                        {name:"청계산 원터골~매봉",loc:"경기 성남·과천",dist:"6.5km",desc:"서울 근교 인기 산, 주말 트레킹 명소. 정상 조망 탁월.",tag:"상급"},
                        {name:"관악산 연주대 코스",loc:"서울 관악·경기 안양",dist:"7km",desc:"서울 대표 도심 산, 정상 연주대까지 도전. 체력 충분해야 OK.",tag:"상급"},
                        {name:"설악산 권금성 케이블카~울산바위",loc:"강원 속초",dist:"4km",desc:"전국 최고 절경. 당일 여행 코스로 추천. 혈압 안정 후 도전하세요.",tag:"전국"},
                        {name:"지리산 둘레길 1구간",loc:"전남 구례",dist:"11km",desc:"전국 최고의 둘레길. 완만하고 숲 깊어 힐링 만점. 1박2일 추천.",tag:"전국"},
                        {name:"한라산 영실 코스",loc:"제주",dist:"6km",desc:"제주 오름 너머 영실 기암절벽. 혈압 안정 후 도전. 절경 보장.",tag:"전국"},
                      ];
                      let candidates:Course[] = [];
                      if (bp >= 150) { candidates = flat.slice(0,3); }
                      else if (bp >= 140) { candidates = flat; }
                      else if (bp >= 130) { candidates = level==="easy" ? flat : [...flat.slice(0,2), ...moderate.slice(0,3)]; }
                      else if (bp >= 120) { candidates = level==="easy" ? flat : level==="medium" ? moderate : [...moderate, ...hard.slice(0,3)]; }
                      else { candidates = level==="easy" ? flat : level==="medium" ? moderate : hard; }
                      if (timeNum <= 20) { candidates = candidates.slice(0,2); }
                      else if (timeNum <= 30) { candidates = candidates.slice(0,3); }
                      else if (timeNum <= 60) { candidates = candidates.slice(0,4); }
                      const tagColor:Record<string,string> = {초보:"#d63384",중급:"#2d6a4f",상급:"#1565c0",전국:"#b45309"};
                      const cards = candidates.map(c => "<div style=\'padding:12px;border-radius:12px;background:white;border:1px solid #f0e0e8;margin-bottom:8px\'><div style=\'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px\'><p style=\'font-weight:500;color:#1a1a2e;font-size:14px\'>" + c.name + "</p><span style=\'font-size:11px;background:#fce4ec;color:" + (tagColor[c.tag]||"#888") + ";padding:2px 8px;border-radius:999px\'>" + c.tag + " · " + c.dist + "</span></div><p style=\'font-size:12px;color:#888;margin-bottom:2px\'>" + c.loc + "</p><p style=\'font-size:13px;color:#555\'>" + c.desc + "</p></div>").join("");
                      const bpMsg = bp >= 150 ? "혈압이 많이 높아요. 평지 가벼운 코스만 추천해요." : bp >= 140 ? "혈압이 높으니 평지 위주로 걸어요." : bp >= 130 ? "혈압이 약간 높아요. 무리하지 마세요." : "혈압이 안정적이에요! 다양한 코스에 도전해보세요.";
                      if(result) result.innerHTML = "<div style=\'margin-top:12px\'><div style=\'padding:10px 14px;border-radius:12px;background:#fce4ec;border:1px solid #f8bbd0;margin-bottom:12px\'><p style=\'font-size:13px;color:#c2185b;font-weight:500\'>" + bpMsg + "</p><p style=\'font-size:12px;color:#888;margin-top:2px\'>나이 " + ageNum + "세 · 수축기 " + bp + "mmHg · " + time + "분 기준 추천 코스 " + candidates.length + "개</p></div>" + cards + "</div>";
                    }} className="w-full py-2.5 rounded-xl text-white text-sm font-medium" style={{background:"#d63384"}}>AI 코스 추천받기</button>
                    <div id="ai-result"></div>
                  </div>
                  <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-medium text-[#1a1a2e]">산책 전후 혈압 기록</h2>
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">건강 기록</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 rounded-xl bg-pink-50/50 border border-pink-100">
                        <p className="text-xs text-[#888] mb-2 font-medium">산책 전</p>
                        <input id="bp-before" type="number" placeholder="수축기 mmHg" className="w-full rounded-lg border border-pink-100 bg-white px-3 py-2 text-sm text-[#1a1a2e] mb-2" />
                        <input id="bp-before-d" type="number" placeholder="이완기 mmHg" className="w-full rounded-lg border border-pink-100 bg-white px-3 py-2 text-sm text-[#1a1a2e]" />
                      </div>
                      <div className="p-3 rounded-xl bg-green-50/50 border border-green-100">
                        <p className="text-xs text-[#888] mb-2 font-medium">산책 후</p>
                        <input id="bp-after" type="number" placeholder="수축기 mmHg" className="w-full rounded-lg border border-green-100 bg-white px-3 py-2 text-sm text-[#1a1a2e] mb-2" />
                        <input id="bp-after-d" type="number" placeholder="이완기 mmHg" className="w-full rounded-lg border border-green-100 bg-white px-3 py-2 text-sm text-[#1a1a2e]" />
                      </div>
                    </div>
                    <button onClick={() => {
                      const before = parseInt((document.getElementById("bp-before") as HTMLInputElement)?.value);
                      const beforeD = parseInt((document.getElementById("bp-before-d") as HTMLInputElement)?.value);
                      const after = parseInt((document.getElementById("bp-after") as HTMLInputElement)?.value);
                      const afterD = parseInt((document.getElementById("bp-after-d") as HTMLInputElement)?.value);
                      const result = document.getElementById("bp-result");
                      if (!before || !after) { if(result) result.innerHTML = "<p style=\'color:#d63384;font-size:13px\'>전후 혈압을 모두 입력해주세요.</p>"; return; }
                      const diff = before - after;
                      let msg = "", color = "", bg = "";
                      if (diff > 0) { msg = "산책 후 " + diff + "mmHg 낮아졌어요! 훌륭합니다."; color = "#2d6a4f"; bg = "#e8f5e9"; }
                      else if (diff === 0) { msg = "혈압 변화가 없어요. 조금 더 걸어보세요!"; color = "#b45309"; bg = "#fffbeb"; }
                      else { msg = "산책 후 " + Math.abs(diff) + "mmHg 높아졌어요. 충분히 휴식하세요."; color = "#1565c0"; bg = "#e3f2fd"; }
                      if(result) result.innerHTML = "<div style=\'margin-top:12px;padding:16px;border-radius:16px;background:" + bg + ";border:1px solid rgba(0,0,0,0.06)\'><div style=\'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px\'><div style=\'text-align:center\'><p style=\'font-size:11px;color:#888;margin-bottom:4px\'>산책 전</p><p style=\'font-size:22px;font-weight:500;color:#d63384\'>" + before + "<span style=\'font-size:12px\'>/" + (beforeD||"-") + "</span></p></div><div style=\'font-size:18px;color:#ccc\'>to</div><div style=\'text-align:center\'><p style=\'font-size:11px;color:#888;margin-bottom:4px\'>산책 후</p><p style=\'font-size:22px;font-weight:500;color:#2d6a4f\'>" + after + "<span style=\'font-size:12px\'>/" + (afterD||"-") + "</span></p></div></div><p style=\'text-align:center;color:" + color + ";font-size:14px;font-weight:500\'>" + msg + "</p></div>";
                    }} className="w-full py-2.5 rounded-xl text-white text-sm font-medium" style={{background:"#2d6a4f"}}>혈압 변화 확인하기</button>
                    <div id="bp-result"></div>
                  </div>
                </div>

          </section>
        )}

        {showMap && (
          <section className="animate-fade-up overflow-hidden">
            <div className="rounded-3xl overflow-hidden" style={{background:"linear-gradient(135deg,#fce4ec 0%,#fdf0f5 50%,#e8f5e9 100%)"}}>
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-pink-500 bg-pink-50 border border-pink-100 rounded-full px-3 py-1">서울시 치료율 현황</span>
                  <h2 className="mt-2 text-lg font-medium text-[#1a1a2e]">서울 지도</h2>
                  <p className="text-sm text-[#888] mt-1">구별 고혈압 진단 경험자 치료율 (2024)</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-medium text-[#d63384]">92.3%</p>
                  <p className="text-xs text-[#888]">평균 치료율</p>
                </div>
              </div>
              <div className="flex gap-2 px-5 pb-3 flex-wrap">
                <span className="text-xs px-2.5 py-1 rounded-full bg-white border border-pink-100 text-[#888]">강남·서초 96%</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-white border border-pink-100 text-[#888]">노원·도봉 94%</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-white border border-pink-100 text-[#888]">관악·금천 82%</span>
              </div>
              <div className="mx-4 mb-4 overflow-hidden rounded-2xl shadow-sm border border-white/60">
                <Image
                  src="/seoul map.png"
                  alt="서울 지도"
                  width={1200}
                  height={800}
                  className="h-auto w-full object-contain"
                />
              </div>
              <div className="px-5 pb-5 grid grid-cols-3 gap-2">
                <div className="bg-white rounded-xl p-3 text-center border border-pink-50">
                  <div className="w-4 h-4 rounded-full mx-auto mb-1" style={{background:"#bbdefb"}}></div>
                  <p className="text-xs text-[#888]">82~90%</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center border border-pink-50">
                  <div className="w-4 h-4 rounded-full mx-auto mb-1" style={{background:"#64b5f6"}}></div>
                  <p className="text-xs text-[#888]">90~93%</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center border border-pink-50">
                  <div className="w-4 h-4 rounded-full mx-auto mb-1" style={{background:"#1565c0"}}></div>
                  <p className="text-xs text-[#888]">93~96%</p>
                </div>
              </div>
            </div>
          </section>
        )}

        <footer className="mt-auto border-t border-[var(--dark-border)] pt-6">
          <div className="flex w-full flex-col items-center gap-4 pb-4">
            <p className="text-sm font-medium uppercase tracking-widest text-[var(--text-muted)]">
              협력 기관
            </p>
            <div className="w-full overflow-x-auto px-1">
              <div className="flex min-w-min justify-center">
                <PartnerLogosRow />
              </div>
            </div>
          </div>
        </footer>
      </main>

      {showNoTreatmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div
            className="card-surface flex max-h-[min(90vh,36rem)] w-full max-w-lg flex-col shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="no-treatment-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--dark-border)] px-5 py-4">
              <div>
                <h3 id="no-treatment-title" className="text-xl font-medium">
                  고혈압 치료를 받지 않는 이유
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  같은 문구는 건수로 합산되며, 이 기기 브라우저에만 저장됩니다.
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full px-3 py-1.5 text-base text-[var(--text-secondary)] hover:bg-white/10"
                onClick={() => setShowNoTreatmentModal(false)}
              >
                닫기
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <label htmlFor="no-treatment-reason" className="mb-1.5 block text-sm text-[var(--text-secondary)]">
                이유 작성 (2자 이상)
              </label>
              <textarea
                id="no-treatment-reason"
                value={noTreatmentDraft}
                onChange={(e) => setNoTreatmentDraft(e.target.value)}
                rows={3}
                maxLength={280}
                placeholder="예: 병원이 멀어서, 증상이 없어서…"
                className="mb-3 w-full resize-y rounded-[12px] border border-[var(--dark-border)] bg-[var(--dark)] px-3 py-2 text-base text-white outline-none placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--stat-blue)]"
              />
              <button
                type="button"
                className="mb-6 w-full rounded-full bg-[var(--seoul-blue)] py-3 text-base font-medium text-white hover:bg-[var(--seoul-blue-light)]"
                onClick={submitNoTreatmentReason}
              >
                제출하고 순위 반영
              </button>
              <div className="mb-3 text-center py-2 px-4 bg-pink-50 rounded-lg">
                <span className="text-sm text-gray-600">지금까지 </span>
                <span className="text-lg font-bold text-pink-600">{totalCount}명</span>
                <span className="text-sm text-gray-600">이 이유를 공유했습니다</span>
              </div>
              <h4 className="mb-2 text-sm font-medium">이유 순위</h4>
              {rankedNoTreatmentReasons.length === 0 ? (
                <p className="rounded-[12px] border border-dashed border-[var(--dark-border)] px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
                  아직 제출된 이유가 없습니다.
                </p>
              ) : (
                <ol className="space-y-2">
                  {rankedNoTreatmentReasons.map((row, index) => (
                    <li key={row.text} className="card-surface flex gap-3 px-3 py-2.5 text-base">
                      <span className="font-display w-8 shrink-0 text-center text-lg text-[var(--accent)]">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words">{row.text}</p>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          <span className="tabular-nums">{row.count}</span>건
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}

      {showPersonalDiagnosisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <style>{`
            @keyframes popIn {
              0% { transform: scale(0.92); opacity: 0; }
              60% { transform: scale(1.04); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translateY(18px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            .diag-modal-enter { animation: popIn 0.35s cubic-bezier(.22,1,.36,1) both; }
            .diag-card-enter { animation: slideUp 0.4s cubic-bezier(.22,1,.36,1) both; }
            .diag-radio-option input[type="radio"] { display: none; }
            .diag-radio-option label {
              display: flex; align-items: center; gap: 10px;
              padding: 12px 16px; border-radius: 14px;
              border: 2px solid #e8e8f0; background: white;
              cursor: pointer; transition: all 0.18s cubic-bezier(.22,1,.36,1);
              font-size: 14px; color: #1a1a2e; font-weight: 500;
            }
            .diag-radio-option input[type="radio"]:checked + label {
              border-color: #d63384; background: linear-gradient(135deg,#fce4ec,#fff0f6);
              transform: scale(1.03); box-shadow: 0 4px 16px rgba(214,51,132,0.15);
              color: #d63384;
            }
            .diag-radio-option label .check-dot {
              width: 18px; height: 18px; border-radius: 50%;
              border: 2px solid #ddd; flex-shrink: 0; transition: all 0.18s;
              display: flex; align-items: center; justify-content: center;
            }
            .diag-radio-option input[type="radio"]:checked + label .check-dot {
              border-color: #d63384; background: #d63384;
            }
            .diag-radio-option input[type="radio"]:checked + label .check-dot::after {
              content: ''; width: 6px; height: 6px; border-radius: 50%; background: white;
            }
            .diag-step-bar { height: 4px; border-radius: 999px; background: #f0e0e8; overflow: hidden; }
            .diag-step-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg,#d63384,#c2185b); transition: width 0.4s cubic-bezier(.22,1,.36,1); }
            .diag-section-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
          `}</style>
          <div
            className="diag-modal-enter flex max-h-[min(92vh,52rem)] w-full max-w-2xl flex-col shadow-2xl"
            style={{background:"white",borderRadius:"28px",overflow:"hidden"}}
            role="dialog"
            aria-modal="true"
            aria-labelledby="personal-diagnosis-title"
          >
            <div className="shrink-0 px-6 pt-6 pb-4" style={{background:"linear-gradient(135deg,#fce4ec 0%,#fff0f6 100%)"}}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{fontSize:"28px"}}>🩺</span>
                    <h3 id="personal-diagnosis-title" className="text-xl font-bold" style={{color:"#1a1a2e"}}>
                      나의 혈압 건강 진단
                    </h3>
                  </div>
                  <p className="text-sm" style={{color:"#888"}}>
                    23만 명 데이터와 비교해 맞춤 건강 결과를 드려요
                  </p>
                </div>
                <button
                  type="button"
                  style={{background:"white",border:"none",borderRadius:"999px",padding:"6px 14px",fontSize:"14px",color:"#888",cursor:"pointer",flexShrink:0}}
                  onClick={() => setShowPersonalDiagnosisModal(false)}
                >
                  닫기
                </button>
              </div>
              <div className="diag-step-bar mt-4">
                <div className="diag-step-fill" style={{width: personalDiagnosisStep === "result" ? "100%" : "50%"}} />
              </div>
              <div className="flex justify-between mt-1">
                <span style={{fontSize:"11px",color:"#d63384",fontWeight:600}}>정보 입력</span>
                <span style={{fontSize:"11px",color: personalDiagnosisStep === "result" ? "#d63384" : "#ccc",fontWeight:600}}>결과 확인</span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {personalDiagnosisStep === "result" && personalDiagnosisResult ? (
                <div className="space-y-4">
                  <div
                    className={`rounded-[12px] border px-4 py-3 ${
                      personalDiagnosisResult.level === "urgent"
                        ? "border-[var(--seoul-red)]/50 bg-[var(--seoul-red)]/10"
                        : personalDiagnosisResult.level === "caution"
                          ? "border-[var(--stat-blue)]/40 bg-[var(--seoul-blue)]/15"
                          : "border-[var(--accent)]/40 bg-[var(--accent)]/10"
                    }`}
                  >
                    <p className="text-sm text-[var(--text-muted)]">
                      {personalDiagnosisResult.benchmarkSource}
                    </p>
                    <p className="mt-1 text-lg font-medium">{personalDiagnosisResult.levelLabel}</p>
                    <p className="mt-1 text-sm text-[var(--stat-blue)]">
                      {personalDiagnosisResult.cohortSegment}
                    </p>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      고혈압 지식{" "}
                      <span className="font-display text-xl text-[var(--accent)]">
                        {personalDiagnosisResult.knowledgeScore}
                      </span>
                      점 (23만 명 평균 {KCHS_SEOUL_2024.knowledge.meanScore}점)
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed text-white">{personalDiagnosisResult.summary}</p>
                  {personalDiagnosisResult.cohortComparisons.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium">23만 명 조사 대비 비교</h4>
                      <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                        {personalDiagnosisResult.cohortComparisons.map((line) => (
                          <li key={line} className="flex gap-2">
                            <span className="shrink-0 text-[var(--stat-blue)]">›</span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <h4 className="mb-2 text-sm font-medium">맞춤 권고</h4>
                    <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                      {personalDiagnosisResult.recommendations.map((line) => (
                        <li key={line} className="flex gap-2">
                          <span className="text-[var(--accent)]">·</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      className="rounded-full border border-[var(--dark-border)] px-4 py-2 text-base text-[var(--text-secondary)] hover:bg-white/5"
                      onClick={resetPersonalDiagnosisForm}
                    >
                      설문 다시 작성
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-[var(--seoul-blue)] px-4 py-2 text-base font-medium text-white hover:bg-[var(--seoul-blue-light)]"
                      onClick={() => selectViewTab("medicationVerbal")}
                    >
                      치료기관 찾기
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  className="space-y-5"
                  onSubmit={(e) => { e.preventDefault(); submitPersonalDiagnosis(); }}
                >
                  {/* 기본 정보 카드 */}
                  <div className="diag-card-enter" style={{animationDelay:"0.05s",background:"white",borderRadius:"20px",padding:"20px",border:"1px solid #f0e0e8",boxShadow:"0 2px 12px rgba(214,51,132,0.06)"}}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="diag-section-icon" style={{background:"#fce4ec"}}>👤</div>
                      <div>
                        <p style={{fontWeight:700,color:"#1a1a2e",fontSize:"15px"}}>기본 정보</p>
                        <p style={{fontSize:"12px",color:"#aaa"}}>이름, 성별, 나이를 알려주세요</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="pd-name" style={{fontSize:"13px",color:"#888",display:"block",marginBottom:"6px"}}>이름</label>
                        <input id="pd-name" type="text" required maxLength={40}
                          value={personalDiagnosisForm.name}
                          onChange={(e) => setPersonalDiagnosisForm((f) => ({ ...f, name: e.target.value }))}
                          style={{width:"100%",borderRadius:"12px",border:"1.5px solid #f0e0e8",padding:"10px 14px",fontSize:"14px",color:"#1a1a2e",outline:"none",boxSizing:"border-box"}}
                          placeholder="홍길동"
                        />
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
                        <div>
                          <p style={{fontSize:"13px",color:"#888",marginBottom:"8px"}}>성별</p>
                          <div style={{display:"flex",gap:"8px"}}>
                            {([["male","남 👨"],["female","여 👩"],["other","기타"]] as const).map(([value,label]) => (
                              <button key={value} type="button"
                                onClick={() => setPersonalDiagnosisForm((f) => ({ ...f, gender: value }))}
                                style={{flex:1,padding:"8px 4px",borderRadius:"12px",border: personalDiagnosisForm.gender===value ? "2px solid #d63384" : "2px solid #f0e0e8",background: personalDiagnosisForm.gender===value ? "linear-gradient(135deg,#fce4ec,#fff0f6)" : "white",color: personalDiagnosisForm.gender===value ? "#d63384" : "#888",fontWeight: personalDiagnosisForm.gender===value ? 700 : 400,fontSize:"13px",cursor:"pointer",transition:"all 0.18s",transform: personalDiagnosisForm.gender===value ? "scale(1.05)" : "scale(1)"}}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label htmlFor="pd-age" style={{fontSize:"13px",color:"#888",display:"block",marginBottom:"6px"}}>나이</label>
                          <input id="pd-age" type="number" required min={1} max={120}
                            value={personalDiagnosisForm.age}
                            onChange={(e) => setPersonalDiagnosisForm((f) => ({ ...f, age: e.target.value }))}
                            style={{width:"100%",borderRadius:"12px",border:"1.5px solid #f0e0e8",padding:"10px 14px",fontSize:"14px",color:"#1a1a2e",outline:"none",boxSizing:"border-box"}}
                            placeholder="예: 58"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 건강 정보 카드 */}
                  <div className="diag-card-enter" style={{animationDelay:"0.12s",background:"white",borderRadius:"20px",padding:"20px",border:"1px solid #f0e0e8",boxShadow:"0 2px 12px rgba(214,51,132,0.06)"}}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="diag-section-icon" style={{background:"#e8f5e9"}}>💊</div>
                      <div>
                        <p style={{fontWeight:700,color:"#1a1a2e",fontSize:"15px"}}>건강 · 관리 정보</p>
                        <p style={{fontSize:"12px",color:"#aaa"}}>현재 건강 상태를 선택해주세요</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p style={{fontSize:"13px",color:"#888",marginBottom:"8px"}}>고혈압 진단 유무</p>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
                          {([["yes","✅ 진단 있음"],["no","❌ 진단 없음"],["unsure","🤔 잘 모름"]] as const).map(([value,label]) => (
                            <button key={value} type="button"
                              onClick={() => setPersonalDiagnosisForm((f) => ({ ...f, hypertensionDiagnosed: value }))}
                              style={{padding:"10px 8px",borderRadius:"14px",border: personalDiagnosisForm.hypertensionDiagnosed===value ? "2px solid #d63384" : "2px solid #f0e0e8",background: personalDiagnosisForm.hypertensionDiagnosed===value ? "linear-gradient(135deg,#fce4ec,#fff0f6)" : "white",color: personalDiagnosisForm.hypertensionDiagnosed===value ? "#d63384" : "#888",fontWeight: personalDiagnosisForm.hypertensionDiagnosed===value ? 700 : 400,fontSize:"12px",cursor:"pointer",transition:"all 0.18s",transform: personalDiagnosisForm.hypertensionDiagnosed===value ? "scale(1.04)" : "scale(1)"}}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
                        <div>
                          <label htmlFor="pd-weight" style={{fontSize:"13px",color:"#888",display:"block",marginBottom:"6px"}}>⚖️ 몸무게 (kg)</label>
                          <input id="pd-weight" type="number" min={20} max={300} step={0.1}
                            value={personalDiagnosisForm.weightKg}
                            onChange={(e) => setPersonalDiagnosisForm((f) => ({ ...f, weightKg: e.target.value }))}
                            style={{width:"100%",borderRadius:"12px",border:"1.5px solid #f0e0e8",padding:"10px 14px",fontSize:"14px",color:"#1a1a2e",outline:"none",boxSizing:"border-box"}}
                            placeholder="예: 72.5"
                          />
                        </div>
                        <div>
                          <p style={{fontSize:"13px",color:"#888",marginBottom:"8px"}}>📱 인바디 연계</p>
                          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                            {([["yes","연계 중"],["planned","예정"],["no","미연계"]] as const).map(([value,label]) => (
                              <button key={value} type="button"
                                onClick={() => setPersonalDiagnosisForm((f) => ({ ...f, inbodyLinked: value }))}
                                style={{padding:"7px 10px",borderRadius:"10px",border: personalDiagnosisForm.inbodyLinked===value ? "2px solid #d63384" : "2px solid #f0e0e8",background: personalDiagnosisForm.inbodyLinked===value ? "#fce4ec" : "white",color: personalDiagnosisForm.inbodyLinked===value ? "#d63384" : "#888",fontSize:"12px",cursor:"pointer",fontWeight: personalDiagnosisForm.inbodyLinked===value ? 700 : 400,transition:"all 0.18s",textAlign:"left"}}>
                                {personalDiagnosisForm.inbodyLinked===value ? "✓ " : ""}{label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="pd-meds" style={{fontSize:"13px",color:"#888",display:"block",marginBottom:"6px"}}>💉 복용 중인 약 (없으면 생략)</label>
                        <textarea id="pd-meds" rows={2} maxLength={300}
                          value={personalDiagnosisForm.medications}
                          onChange={(e) => setPersonalDiagnosisForm((f) => ({ ...f, medications: e.target.value }))}
                          style={{width:"100%",borderRadius:"12px",border:"1.5px solid #f0e0e8",padding:"10px 14px",fontSize:"14px",color:"#1a1a2e",outline:"none",resize:"none",boxSizing:"border-box"}}
                          placeholder="예: 암로디핀 5mg 1일 1회"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 지식 설문 카드 */}
                  <div className="diag-card-enter" style={{animationDelay:"0.2s",background:"white",borderRadius:"20px",padding:"20px",border:"1px solid #f0e0e8",boxShadow:"0 2px 12px rgba(214,51,132,0.06)"}}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="diag-section-icon" style={{background:"#e3f2fd"}}>🧠</div>
                      <div>
                        <p style={{fontWeight:700,color:"#1a1a2e",fontSize:"15px"}}>고혈압 지식 퀴즈</p>
                        <p style={{fontSize:"12px",color:"#aaa"}}>알고 계신 만큼 솔직하게 선택해주세요</p>
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                      {HYPERTENSION_KNOWLEDGE_QUESTIONS.map((q, index) => (
                        <div key={q.id} style={{background:"#fafafa",borderRadius:"16px",padding:"14px 16px",border:"1px solid #f5e6ef"}}>
                          <p style={{fontSize:"13px",color:"#1a1a2e",fontWeight:600,marginBottom:"10px",lineHeight:"1.5"}}>
                            <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:"22px",height:"22px",borderRadius:"50%",background:"#fce4ec",color:"#d63384",fontSize:"11px",fontWeight:700,marginRight:"8px",flexShrink:0}}>{index+1}</span>
                            {q.question}
                          </p>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"6px"}}>
                            {([["yes","😊 알아요"],["unsure","🤔 애매해요"],["no","😅 몰라요"]] as const).map(([value,label]) => (
                              <button key={value} type="button"
                                onClick={() => setPersonalDiagnosisForm((f) => ({ ...f, knowledgeAnswers: { ...f.knowledgeAnswers, [q.id]: value } }))}
                                style={{padding:"8px 6px",borderRadius:"12px",border: personalDiagnosisForm.knowledgeAnswers[q.id]===value ? "2px solid #d63384" : "2px solid #edd",background: personalDiagnosisForm.knowledgeAnswers[q.id]===value ? "linear-gradient(135deg,#fce4ec,#fff0f6)" : "white",color: personalDiagnosisForm.knowledgeAnswers[q.id]===value ? "#d63384" : "#888",fontSize:"12px",cursor:"pointer",fontWeight: personalDiagnosisForm.knowledgeAnswers[q.id]===value ? 700 : 400,transition:"all 0.18s cubic-bezier(.22,1,.36,1)",transform: personalDiagnosisForm.knowledgeAnswers[q.id]===value ? "scale(1.05)" : "scale(1)"}}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button type="submit"
                    style={{width:"100%",padding:"16px",borderRadius:"16px",border:"none",background:"linear-gradient(135deg,#d63384,#c2185b)",color:"white",fontSize:"16px",fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px rgba(214,51,132,0.35)",letterSpacing:"0.5px"}}>
                    🔍 나의 혈압 건강 진단 받기
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {showPointsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div
            className="card-surface flex max-h-[min(92vh,44rem)] w-full max-w-2xl flex-col shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="points-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--dark-border)] px-5 py-4">
              <div>
                <h3 id="points-title" className="text-xl font-medium">
                  고혈압 관리 포인트 적립
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  식단·병원 방문·산책·손목닥터 9988 연동을 인증하고 포인트를 쌓아 치료 습관을 유지하세요.
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full px-3 py-1.5 text-base text-[var(--text-secondary)] hover:bg-white/10"
                onClick={() => setShowPointsModal(false)}
              >
                닫기
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-5 rounded-[12px] border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3">
                <p className="text-sm text-[var(--text-muted)]">누적 포인트</p>
                <p className="font-display mt-1 text-4xl text-[var(--accent)]">
                  {pointsWallet.total.toLocaleString("ko-KR")}P
                </p>
                <p className="mt-1 text-sm text-white">{treatmentLevel.label}</p>
                {treatmentLevel.next !== null && (
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    다음 단계까지 {treatmentLevel.next - pointsWallet.total}P
                  </p>
                )}
              </div>

              {pointMessage && (
                <p
                  className={`mb-4 rounded-[12px] border px-3 py-2 text-base ${
                    pointMessage.includes("적립되었습니다")
                      ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--seoul-red)]/40 bg-[var(--seoul-red)]/10 text-[var(--seoul-red)]"
                  }`}
                >
                  {pointMessage}
                </p>
              )}

              <ul className="space-y-4">
                {HYPERTENSION_POINT_RULES.map((rule) => {
                  const earnedToday = !canEarnPointsToday(pointsWallet, rule.id).ok;
                  return (
                    <li key={rule.id} className="card-surface p-4">
                      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium text-white">{rule.title}</h4>
                          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{rule.description}</p>
                        </div>
                        <span className="rounded-full border border-[var(--stat-blue)]/40 bg-[var(--seoul-blue)]/20 px-2.5 py-0.5 text-sm font-medium text-[var(--stat-blue)]">
                          +{rule.points}P
                        </span>
                      </div>
                      <p className="mb-3 text-sm leading-relaxed text-[var(--text-muted)]">
                        {rule.hypertensionTip}
                      </p>
                      <label
                        htmlFor={`point-note-${rule.id}`}
                        className="mb-1 block text-sm text-[var(--text-secondary)]"
                      >
                        인증 내용
                      </label>
                      <input
                        id={`point-note-${rule.id}`}
                        type="text"
                        maxLength={120}
                        value={pointNotes[rule.id]}
                        onChange={(e) =>
                          setPointNotes((prev) => ({ ...prev, [rule.id]: e.target.value }))
                        }
                        placeholder={rule.placeholder}
                        className={formFieldClass}
                        disabled={earnedToday}
                      />
                      <button
                        type="button"
                        disabled={earnedToday}
                        className="mt-3 w-full rounded-full bg-[var(--seoul-blue)] py-2.5 text-base font-medium text-white hover:bg-[var(--seoul-blue-light)] disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => submitPointEarn(rule.id)}
                      >
                        {earnedToday ? "오늘 적립 완료" : "포인트 적립하기"}
                      </button>
                      {rule.id === "meal" && (
                        <button
                          type="button"
                          className="mt-2 w-full text-sm text-[var(--stat-blue)] hover:underline"
                          onClick={() => {
                            setShowPointsModal(false);
                            selectViewTab("meal");
                          }}
                        >
                          식단 추천 보기 →
                        </button>
                      )}
                      {rule.id === "hospital" && (
                        <button
                          type="button"
                          className="mt-2 w-full text-sm text-[var(--stat-blue)] hover:underline"
                          onClick={() => {
                            setShowPointsModal(false);
                            selectViewTab("medicationVerbal");
                          }}
                        >
                          치료기관 찾기 →
                        </button>
                      )}
                      {rule.id === "walking" && (
                        <button
                          type="button"
                          className="mt-2 w-full text-sm text-[var(--stat-blue)] hover:underline"
                          onClick={() => {
                            setShowPointsModal(false);
                            selectViewTab("walking");
                          }}
                        >
                          산책로 추천 보기 →
                        </button>
                      )}
                      {rule.id === "wristDoctor" && (
                        <a
                          href={`tel:${WRIST_DOCTOR_9988_PHONE}`}
                          className="mt-2 flex w-full items-center justify-center rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 py-2 text-base font-medium text-[var(--accent)] hover:bg-[var(--accent)]/20"
                        >
                          {WRIST_DOCTOR_9988_LABEL} 연결 (전화 {WRIST_DOCTOR_9988_PHONE})
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-6">
                <h4 className="mb-2 text-sm font-medium">적립 내역</h4>
                {pointsWallet.entries.length === 0 ? (
                  <p className="rounded-[12px] border border-dashed border-[var(--dark-border)] px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
                    아직 적립 내역이 없습니다. 위 항목부터 인증해 보세요.
                  </p>
                ) : (
                  <ul className="max-h-48 space-y-2 overflow-y-auto">
                    {pointsWallet.entries.slice(0, 30).map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-start justify-between gap-3 rounded-[12px] border border-[var(--dark-border)] bg-[var(--dark)]/40 px-3 py-2 text-base"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-white">{getRule(entry.category).title}</p>
                          <p className="truncate text-sm text-[var(--text-secondary)]">{entry.note}</p>
                          <p className="text-sm text-[var(--text-muted)]">
                            {formatPointDate(entry.createdAt)}
                          </p>
                        </div>
                        <span className="shrink-0 font-display text-lg text-[var(--accent)]">
                          +{entry.points}P
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedHospital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="card-surface w-full max-w-lg p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="text-xl font-medium">{selectedHospital.name}</h3>
              <button
                type="button"
                className="rounded-full px-3 py-1 text-sm text-[var(--text-secondary)] hover:bg-white/10"
                onClick={() => setSelectedHospital(null)}
              >
                닫기
              </button>
            </div>
            <div className="space-y-3 text-sm text-[var(--text-secondary)]">
              <p>
                <span className="mr-2 text-[var(--text-muted)]">전화번호</span>
                {selectedHospital.phoneNumber}
              </p>
              <p>
                <span className="mr-2 text-[var(--text-muted)]">상세 주소</span>
                {selectedHospital.detailAddress}
              </p>
              <div>
                <p className="mb-1 text-[var(--text-muted)]">구두 교육 내용</p>
                <p className="text-white">{selectedHospital.verbalEducation.join(", ")}</p>
              </div>
            </div>
            <a
              href={`tel:${selectedHospital.phoneNumber.replace(/-/g, "")}`}
              className="mt-6 block w-full rounded-full bg-[var(--seoul-blue)] py-3 text-center text-sm font-medium text-white hover:bg-[var(--seoul-blue-light)]"
            >
              지금 바로 전화 문의
            </a>
          </div>
        </div>
      )}

      {showMealPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div
            className="card-surface flex max-h-[min(92vh,44rem)] w-full max-w-5xl flex-col shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="meal-plan-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--dark-border)] px-5 py-4">
              <div>
                <h3 id="meal-plan-title" className="text-xl font-medium">
                  🧊 내 냉장고에 있는 재료는?
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  재료를 입력하면 AI가 고혈압 맞춤 식단과 유튜브 레시피를 추천해드려요
                </p>
                <div className="mt-4 rounded-2xl border border-pink-100 bg-pink-50/50 p-4">
                  <p className="text-sm font-medium text-[#1a1a2e] mb-1">재료 입력</p>
                  <p className="text-xs text-[#888] mb-3">예: 두부, 시금치, 양파, 된장, 계란... (쉼표로 구분)</p>
                  <div className="flex gap-2 mb-3">
                    <input id="fridge-input" type="text" placeholder="예: 두부, 시금치, 양파, 된장, 계란..." className="flex-1 rounded-xl border border-pink-100 bg-white px-3 py-2 text-sm text-[#1a1a2e] outline-none" />
                    <button onClick={() => {
                      const input = (document.getElementById("fridge-input") as HTMLInputElement)?.value.trim();
                      const result = document.getElementById("fridge-result");
                      if (!input) { if(result) result.innerHTML = "<p style=\'color:#d63384;font-size:13px\'>재료를 입력해주세요.</p>"; return; }
                      const items = input.split(/[,\s]+/).filter(Boolean);
                      const vegMap: Record<string,string[]> = {
                        "두부":["두부된장국","두부조림","순두부찌개"],"시금치":["시금치나물","시금치된장국","시금치계란볶음"],
                        "양파":["양파볶음","양파된장국","양파피클"],"된장":["된장찌개","된장국","된장나물무침"],
                        "계란":["계란찜","계란말이","계란국"],"브로콜리":["브로콜리볶음","브로콜리나물","브로콜리된장국"],
                        "당근":["당근나물","당근볶음","당근된장국"],"배추":["배추된장국","배추나물","겉절이"],
                        "고등어":["고등어구이","고등어조림","고등어된장찌개"],"연어":["연어구이","연어샐러드","연어덮밥"],
                        "닭가슴살":["닭가슴살구이","닭가슴살샐러드","닭가슴살볶음"],"현미":["현미밥","현미죽","현미볶음밥"],
                        "귀리":["귀리밥","귀리죽","귀리샐러드"],"토마토":["토마토샐러드","토마토달걀볶음","토마토수프"],
                        "버섯":["버섯볶음","버섯된장국","버섯구이"],"무":["무나물","무국","무조림"],
                        "호박":["호박볶음","호박된장국","호박전"],"콩나물":["콩나물국","콩나물무침","콩나물밥"],
                        "미역":["미역국","미역무침","미역된장국"],"파":["파무침","파된장국","파전"],
                      };
                      const menus: string[] = [];
                      const youtubeQueries: string[] = [];
                      items.forEach(item => {
                        const key = Object.keys(vegMap).find(k => item.includes(k));
                        if (key) { menus.push(...vegMap[key].slice(0,2)); youtubeQueries.push(key + " 고혈압 저염 레시피"); }
                      });
                      const uniqueMenus = [...new Set(menus)].slice(0,6);
                      const uniqueQueries = [...new Set(youtubeQueries)].slice(0,3);
                      const weekPlan = [
                        {day:"월",menu:uniqueMenus[0]||"현미밥 + 된장국"},
                        {day:"화",menu:uniqueMenus[1]||"잡곡밥 + 나물"},
                        {day:"수",menu:uniqueMenus[2]||"귀리죽 + 채소"},
                        {day:"목",menu:uniqueMenus[3]||"현미밥 + 구이"},
                        {day:"금",menu:uniqueMenus[4]||"보리밥 + 찌개"},
                        {day:"토",menu:uniqueMenus[5]||"현미밥 + 볶음"},
                        {day:"일",menu:uniqueMenus[0]||"잡곡밥 + 나물"},
                      ];
                      const planCards = weekPlan.map(p => "<div style=\'display:inline-flex;flex-direction:column;align-items:center;background:white;border:1px solid #f0e0e8;border-radius:12px;padding:8px 10px;min-width:80px\'><p style=\'font-size:11px;color:#d63384;font-weight:500\'>" + p.day + "요일</p><p style=\'font-size:12px;color:#1a1a2e;margin-top:2px;text-align:center\'>" + p.menu + "</p></div>").join("");
                      const ytLinks = uniqueQueries.map(q => "<a href=\'https://www.youtube.com/results?search_query=" + encodeURIComponent(q) + "\' target=\'_blank\' style=\'display:flex;align-items:center;gap:8px;padding:10px 12px;background:white;border:1px solid #f0e0e8;border-radius:12px;text-decoration:none;margin-bottom:6px\'><span style=\'color:#ff0000;font-size:16px\'>&#9654;</span><div><p style=\'font-size:13px;color:#1a1a2e;font-weight:500\'>" + q + "</p><p style=\'font-size:11px;color:#888\'>유튜브에서 보기</p></div></a>").join("");
                      if(result) result.innerHTML = "<div style=\'margin-top:4px\'><p style=\'font-size:12px;color:#888;margin-bottom:8px\'>" + input + " 재료로 만드는 고혈압 맞춤 일주일 식단</p><div style=\'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px\'>" + planCards + "</div><p style=\'font-size:12px;color:#888;margin-bottom:8px\'>유튜브 레시피</p>" + ytLinks + "</div>";
                    }} className="rounded-xl px-4 py-2 text-sm font-medium text-white whitespace-nowrap" style={{background:"#d63384"}}>식단 만들기</button>
                  </div>
                  <div id="fridge-result"></div>
                </div>
                  
</div>
              <button
                type="button"
                className="shrink-0 rounded-full px-3 py-1.5 text-base text-[var(--text-secondary)] hover:bg-white/10"
                onClick={() => {
                  setHealthCenterQuery("");
                  setShowMealPlan(false);
                }}
              >
                닫기
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
                <div className="min-w-0 flex-1">
                  <div
                    className="mb-4 flex flex-wrap gap-1 rounded-[12px] border border-[var(--dark-border)] bg-white/5 p-1"
                    role="tablist"
                    aria-label="요일 선택"
                  >
                    {HYPERTENSION_WEEKLY_MEAL_PLAN.map((row, index) => (
                      <button
                        key={row.day}
                        type="button"
                        role="tab"
                        aria-selected={mealPlanDayIndex === index}
                        onClick={() => setMealPlanDayIndex(index)}
                        className={`min-w-[2.25rem] flex-1 rounded-md px-2 py-2 text-base font-medium transition sm:flex-initial sm:px-3 ${
                          mealPlanDayIndex === index
                            ? "bg-[var(--dark-card)] text-[var(--accent)] ring-1 ring-[var(--accent)]/40"
                            : "text-[var(--text-secondary)] hover:bg-white/10"
                        }`}
                      >
                        {row.day}
                      </button>
                    ))}
                  </div>
                  <div className="card-surface p-4 text-sm leading-relaxed text-[var(--text-secondary)]" role="tabpanel">
                    <p className="mb-3 text-sm text-[var(--accent)]">{mealPlanRow.day}요일 추천 메뉴</p>
                    <p>
                      <span className="font-medium text-white">아침 </span>
                      {mealPlanRow.breakfast}
                    </p>
                    <p className="mt-3">
                      <span className="font-medium text-white">점심 </span>
                      {mealPlanRow.lunch}
                    </p>
                    <p className="mt-3">
                      <span className="font-medium text-white">저녁 </span>
                      {mealPlanRow.dinner}
                    </p>
                  </div>
                </div>
                <aside className="w-full shrink-0 border-t border-[var(--dark-border)] pt-6 lg:w-[22rem] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                  <a
                    href="tel:129"
                    className="mb-3 flex w-full items-center justify-center rounded-full bg-[var(--accent)] py-2.5 text-center text-sm font-medium text-[var(--dark)] hover:opacity-90"
                  >
                    근처 보건소 영양사 연결 (129)
                  </a>
                  <h4 className="mb-2 text-sm font-medium">전국 보건소 검색</h4>
                  <input
                    id="health-center-search"
                    type="search"
                    value={healthCenterQuery}
                    onChange={(e) => setHealthCenterQuery(e.target.value)}
                    placeholder="시·도, 구·군, 보건소명 검색"
                    className="mb-3 w-full rounded-[12px] border border-[var(--dark-border)] bg-[var(--dark)] px-3 py-2 text-base text-white outline-none placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--stat-blue)]"
                  />
                  <ul className="max-h-[min(40vh,16rem)] space-y-2 overflow-y-auto">
                    {filteredHealthCenters.length === 0 ? (
                      <li className="card-surface p-4 text-center text-sm text-[var(--text-secondary)]">
                        검색 결과가 없습니다.
                      </li>
                    ) : (
                      filteredHealthCenters.map((c) => (
                        <li key={c.id} className="card-surface p-2.5 text-sm">
                          <p className="font-medium text-white">{c.name}</p>
                          <p className="mt-0.5 text-[var(--text-muted)]">{c.region}</p>
                          <a
                            href={`tel:${c.nutritionPhone.replace(/-/g, "")}`}
                            className="mt-2 inline-block text-[var(--stat-blue)] hover:underline"
                          >
                            {c.nutritionPhone}
                          </a>
                        </li>
                      ))
                    )}
                  </ul>
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
