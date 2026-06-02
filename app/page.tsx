"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

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
  const [noTreatmentReasons, setNoTreatmentReasons] = useState<NoTreatmentReasonStat[]>([]);
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
      try {
        localStorage.setItem(NO_TREATMENT_REASONS_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
      return next;
    });
    setNoTreatmentDraft("");
  };

  return (
    <div className="relative z-10 flex min-h-screen flex-col text-[var(--text-primary)]">
      <header className="sticky top-0 z-40 border-b border-[var(--dark-border)] bg-[var(--dark)]/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
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
            <span className="hidden text-base font-medium text-[var(--text-secondary)] sm:inline">
              고혈압 치료 연계
            </span>
            <button
              type="button"
              onClick={() => selectViewTab("chsWebsite")}
              className={`hidden rounded-full border px-3 py-1.5 text-sm font-medium transition sm:inline-flex ${
                activeViewTab === "chsWebsite"
                  ? "border-[var(--stat-blue)]/40 bg-[var(--seoul-blue)]/20 text-[var(--stat-blue)]"
                  : "border-[var(--dark-border)] text-[var(--text-secondary)] hover:border-white/20 hover:text-white"
              }`}
            >
              누리집 연결하기
            </button>
          </div>
          <nav className="flex flex-wrap items-center justify-end gap-1 text-sm sm:gap-2 sm:text-base">
            <button type="button" className="px-2 py-1 text-[var(--text-secondary)] hover:text-white" onClick={() => selectViewTab("meal")}>
              식단
            </button>
            <button type="button" className="px-2 py-1 text-[var(--text-secondary)] hover:text-white" onClick={() => selectViewTab("medicationVerbal")}>
              치료기관
            </button>
            <button type="button" className="px-2 py-1 text-[var(--text-secondary)] hover:text-white" onClick={() => selectViewTab("walking")}>
              산책로
            </button>
            <button type="button" className="px-2 py-1 font-medium text-[var(--stat-blue)]" onClick={() => selectViewTab("map")}>
              지도
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-12 pt-8 sm:px-6">
        <section className="animate-fade-up mb-6">
          <div className="relative overflow-hidden rounded-3xl px-6 py-8 mb-6" style={{background:"linear-gradient(135deg,#fce4ec 0%,#fdf0f5 60%,#fce4ec 100%)"}}>
            <div className="absolute right-[-20px] top-[-20px] w-32 h-32 rounded-full opacity-20" style={{background:"#d63384"}}></div>
            <div className="absolute right-[30px] bottom-[-30px] w-20 h-20 rounded-full opacity-10" style={{background:"#d63384"}}></div>
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white px-3 py-1 text-sm font-medium text-pink-600 mb-4">
                2026 서울 건강 캠페인
              </span>
              <h1 className="text-2xl font-medium leading-snug tracking-tight text-[#1a1a2e] sm:text-3xl mb-2">
                나머지 <span className="text-[#d63384]">7.7%</span>의<br />
                서울시민 건강을<br />
                <span className="text-[#2d6a4f]">함께 찾습니다</span>
              </h1>
              <p className="text-sm text-[#888] mb-5">고혈압 치료율 92.3% → 100% 목표</p>
          <h1 className="mx-auto max-w-3xl text-2xl font-medium leading-snug tracking-tight sm:text-3xl md:text-4xl">
            서울시민의 고혈압 치료율 표준화율은{" "}
            <span className="text-[var(--accent)]">92.3%</span>로
            <br />
            나머지 <span className="text-[var(--stat-blue)]">7.7%</span>의 서울시민의 건강을 찾습니다
          </h1>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="rounded-2xl bg-white border border-pink-100 p-3 text-center shadow-sm">
              <p className="text-xs text-[#888] mb-1">치료율</p>
              <p className="text-2xl font-medium text-[#1565c0]">92.3%</p>
            </div>
            <div className="rounded-2xl bg-white border border-pink-100 p-3 text-center shadow-sm">
              <p className="text-xs text-[#888] mb-1">관리 공백</p>
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
            <p className="mt-1 text-center text-base text-[var(--text-secondary)]">관리 공백 추정 비율</p>
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
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h2 className="text-xl font-medium">내 주변 내과 진료 기관</h2>
              <span className="text-sm text-[var(--text-secondary)]">
                약물·구두 치료 연계 가능 {filteredHospitals.length}곳
              </span>
            </div>
            <ul className="flex flex-col gap-3">
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
          <section className="animate-fade-up mb-6">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h2 className="text-xl font-medium">산책하기 좋은 거리 · 산책로</h2>
              <span className="text-sm text-[var(--text-secondary)]">추천 코스 {WALKING_ROUTES.length}곳</span>
            </div>
            <p className="mb-4 text-sm text-[var(--text-secondary)]">
              고혈압 관리에는 주 5회, 30분 이상 가볍게 걷기가 권장됩니다. 완만하고 평지 위주 코스부터 시작하세요.
            </p>
            <ul className="flex flex-col gap-3">
              {WALKING_ROUTES.map((route) => (
                <li
                  key={route.id}
                  className="card-surface p-4 transition-all duration-200 hover:translate-x-1 hover:border-[var(--stat-blue)]/50"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{route.name}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{route.district}</p>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">{route.tip}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
                      <span className="rounded-full border border-[var(--dark-border)] bg-white/5 px-2.5 py-0.5 text-sm tabular-nums">
                        약 {route.distanceKm}km
                      </span>
                      <span className="rounded-full border border-[var(--dark-border)] bg-white/5 px-2.5 py-0.5 text-sm text-[var(--text-secondary)]">
                        {route.durationMin}분 · {route.surface}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
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
                      let course = "", tip = "";
                      if (bp >= 140) { course = "한강 난지 수변공원 (평지, 2.1km)"; tip = "혈압이 높으니 평지 위주 가벼운 코스를 추천합니다. 준비운동 5분 필수!"; }
                      else if (bp >= 130) { course = "서울숲 둘레길 (완만한 언덕, 3.2km)"; tip = "완만한 코스로 심박수를 서서히 올려주세요."; }
                      else { course = "북한산 둘레길 1구간 (숲길, 4.5km)"; tip = "혈압이 안정적이에요! 숲길 파워워킹으로 심폐 기능을 강화해보세요."; }
                      if(result) result.innerHTML = "<div style=\'margin-top:12px;padding:16px;border-radius:16px;background:#fce4ec;border:1px solid #f8bbd0\'><p style=\'font-weight:500;color:#c2185b;margin-bottom:6px;font-size:14px\'>" + course + "</p><p style=\'font-size:13px;color:#888;margin-bottom:4px\'>" + tip + "</p><p style=\'font-size:12px;color:#d63384\'>예상: " + time + "분</p></div>";
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
          <section className="card-surface animate-fade-up overflow-hidden p-4">
            <h2 className="mb-3 text-lg font-medium">서울 지도</h2>
            <div className="overflow-hidden rounded-[8px] bg-black/20">
              <Image
                src="/seoul map.png"
                alt="서울 지도"
                width={1200}
                height={800}
                className="h-auto w-full object-contain"
              />
            </div>
          </section>
        )}

        <footer className="mt-auto border-t border-[var(--dark-border)] pt-6">
          <div className="mx-auto flex w-fit max-w-full flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-center sm:gap-8">
            <div className="flex h-[72px] w-[200px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-[var(--dark-border)] bg-white px-2 sm:h-20 sm:w-[220px]">
              <Image
                src="/chs.png"
                alt="지역사회건강조사 로고"
                width={512}
                height={128}
                className="h-full w-full object-contain object-center"
                loading="eager"
              />
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1 text-center sm:items-start sm:text-left">
              <span className="rounded-full border border-[var(--dark-border)] bg-white/5 px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)]">
                2026 캠페인
                |  2026년 5월 16일 ~ 7월 31일</span>
            </div>
          </div>
          <div className="mt-8 flex w-full flex-col items-center gap-4 border-t border-[var(--dark-border)] pt-8 pb-4">
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
          <div
            className="card-surface flex max-h-[min(92vh,44rem)] w-full max-w-2xl flex-col shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="personal-diagnosis-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--dark-border)] px-5 py-4">
              <div>
                <h3 id="personal-diagnosis-title" className="text-xl font-medium">
                  개인진단 설문
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {KCHS_SEOUL_2024.surveyLabel} {KCHS_SEOUL_2024.sampleSize.toLocaleString("ko-KR")}명
                  표본(치료율 {KCHS_SEOUL_2024.treatmentStandardizationRate}% / 관리 공백{" "}
                  {KCHS_SEOUL_2024.managementGapRate}%)과 비교해 진단합니다.
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full px-3 py-1.5 text-base text-[var(--text-secondary)] hover:bg-white/10"
                onClick={() => setShowPersonalDiagnosisModal(false)}
              >
                닫기
              </button>
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
                  className="space-y-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitPersonalDiagnosis();
                  }}
                >
                  <p className="rounded-[12px] border border-[var(--dark-border)] bg-[var(--dark)]/60 px-3 py-2 text-base text-[var(--text-secondary)]">
                    응답은 {KCHS_SEOUL_2024.sampleSize.toLocaleString("ko-KR")}명 지역사회건강조사 집계와
                    대조해, 치료 연계({KCHS_SEOUL_2024.treatmentStandardizationRate}%)·관리 공백(
                    {KCHS_SEOUL_2024.managementGapRate}%) 군에 가까운지 판단합니다.
                  </p>
                  <fieldset className="space-y-3">
                    <legend className="mb-1 text-sm font-medium text-white">기본 정보</legend>
                    <div>
                      <label htmlFor="pd-name" className="mb-1 block text-sm text-[var(--text-secondary)]">
                        이름
                      </label>
                      <input
                        id="pd-name"
                        type="text"
                        required
                        maxLength={40}
                        value={personalDiagnosisForm.name}
                        onChange={(e) =>
                          setPersonalDiagnosisForm((f) => ({ ...f, name: e.target.value }))
                        }
                        className={formFieldClass}
                        placeholder="홍길동"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <span className="mb-1 block text-sm text-[var(--text-secondary)]">성별</span>
                        <div className="flex flex-wrap gap-2">
                          {(
                            [
                              ["male", "남"],
                              ["female", "여"],
                              ["other", "기타"],
                            ] as const
                          ).map(([value, label]) => (
                            <label
                              key={value}
                              className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
                                personalDiagnosisForm.gender === value
                                  ? "border-[var(--stat-blue)] bg-[var(--seoul-blue)]/25 text-white"
                                  : "border-[var(--dark-border)] text-[var(--text-secondary)]"
                              }`}
                            >
                              <input
                                type="radio"
                                name="pd-gender"
                                className="sr-only"
                                checked={personalDiagnosisForm.gender === value}
                                onChange={() =>
                                  setPersonalDiagnosisForm((f) => ({ ...f, gender: value }))
                                }
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label htmlFor="pd-age" className="mb-1 block text-sm text-[var(--text-secondary)]">
                          나이
                        </label>
                        <input
                          id="pd-age"
                          type="number"
                          required
                          min={1}
                          max={120}
                          value={personalDiagnosisForm.age}
                          onChange={(e) =>
                            setPersonalDiagnosisForm((f) => ({ ...f, age: e.target.value }))
                          }
                          className={formFieldClass}
                          placeholder="예: 58"
                        />
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="space-y-3">
                    <legend className="mb-1 text-sm font-medium text-white">건강·관리 정보</legend>
                    <div>
                      <span className="mb-1 block text-sm text-[var(--text-secondary)]">
                        고혈압 진단 유무
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            ["yes", "진단 있음"],
                            ["no", "진단 없음"],
                            ["unsure", "잘 모름"],
                          ] as const
                        ).map(([value, label]) => (
                          <label
                            key={value}
                            className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
                              personalDiagnosisForm.hypertensionDiagnosed === value
                                ? "border-[var(--stat-blue)] bg-[var(--seoul-blue)]/25 text-white"
                                : "border-[var(--dark-border)] text-[var(--text-secondary)]"
                            }`}
                          >
                            <input
                              type="radio"
                              name="pd-diagnosed"
                              className="sr-only"
                              checked={personalDiagnosisForm.hypertensionDiagnosed === value}
                              onChange={() =>
                                setPersonalDiagnosisForm((f) => ({
                                  ...f,
                                  hypertensionDiagnosed: value,
                                }))
                              }
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="pd-meds" className="mb-1 block text-sm text-[var(--text-secondary)]">
                        먹고 있는 약 (없으면 비워 두세요)
                      </label>
                      <textarea
                        id="pd-meds"
                        rows={2}
                        maxLength={300}
                        value={personalDiagnosisForm.medications}
                        onChange={(e) =>
                          setPersonalDiagnosisForm((f) => ({ ...f, medications: e.target.value }))
                        }
                        className={formFieldClass}
                        placeholder="예: 암로디핀 5mg 1일 1회"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="pd-weight" className="mb-1 block text-sm text-[var(--text-secondary)]">
                          몸무게 (kg)
                        </label>
                        <input
                          id="pd-weight"
                          type="number"
                          min={20}
                          max={300}
                          step={0.1}
                          value={personalDiagnosisForm.weightKg}
                          onChange={(e) =>
                            setPersonalDiagnosisForm((f) => ({ ...f, weightKg: e.target.value }))
                          }
                          className={formFieldClass}
                          placeholder="예: 72.5"
                        />
                      </div>
                      <div>
                        <span className="mb-1 block text-sm text-[var(--text-secondary)]">
                          인바디 어플 연계
                        </span>
                        <div className="flex flex-col gap-2">
                          {(
                            [
                              ["yes", "연계 중"],
                              ["planned", "연계 예정"],
                              ["no", "미연계"],
                            ] as const
                          ).map(([value, label]) => (
                            <label
                              key={value}
                              className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
                                personalDiagnosisForm.inbodyLinked === value
                                  ? "border-[var(--stat-blue)] bg-[var(--seoul-blue)]/25 text-white"
                                  : "border-[var(--dark-border)] text-[var(--text-secondary)]"
                              }`}
                            >
                              <input
                                type="radio"
                                name="pd-inbody"
                                className="sr-only"
                                checked={personalDiagnosisForm.inbodyLinked === value}
                                onChange={() =>
                                  setPersonalDiagnosisForm((f) => ({ ...f, inbodyLinked: value }))
                                }
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="space-y-3">
                    <legend className="mb-1 text-sm font-medium text-white">
                      고혈압 기본 지식 설문
                    </legend>
                    <p className="text-sm text-[var(--text-muted)]">
                      각 문항에 대해 알고 계신 정도를 선택해 주세요.
                    </p>
                    <ul className="space-y-4">
                      {HYPERTENSION_KNOWLEDGE_QUESTIONS.map((q, index) => (
                        <li key={q.id} className="card-surface p-3">
                          <p className="mb-2 text-sm text-white">
                            {index + 1}. {q.question}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(
                              [
                                ["yes", "알고 있음"],
                                ["unsure", "잘 모름"],
                                ["no", "모름"],
                              ] as const
                            ).map(([value, label]) => (
                              <label
                                key={value}
                                className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${
                                  personalDiagnosisForm.knowledgeAnswers[q.id] === value
                                    ? "border-[var(--accent)]/50 bg-[var(--accent)]/15 text-white"
                                    : "border-[var(--dark-border)] text-[var(--text-secondary)]"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`pd-knowledge-${q.id}`}
                                  className="sr-only"
                                  checked={personalDiagnosisForm.knowledgeAnswers[q.id] === value}
                                  onChange={() =>
                                    setPersonalDiagnosisForm((f) => ({
                                      ...f,
                                      knowledgeAnswers: {
                                        ...f.knowledgeAnswers,
                                        [q.id]: value,
                                      },
                                    }))
                                  }
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </fieldset>

                  <button
                    type="submit"
                    className="w-full rounded-full bg-[var(--seoul-blue)] py-3 text-base font-medium text-white hover:bg-[var(--seoul-blue-light)]"
                  >
                    개인진단 결과 보기
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
                  고혈압 관리 일주일 식단 예시
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  나트륨·포화지방은 줄이고 채소·통곡·생선·콩류를 늘리는 방향입니다.
                </p>
                  
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
