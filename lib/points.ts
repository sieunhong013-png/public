export type PointCategory = "meal" | "hospital" | "walking" | "wristDoctor";

/** 손목닥터 9988 상담·연동 안내 */
export const WRIST_DOCTOR_9988_PHONE = "9988";
export const WRIST_DOCTOR_9988_LABEL = "손목닥터 9988";

export type PointRule = {
  id: PointCategory;
  title: string;
  description: string;
  points: number;
  dailyLimit: number;
  placeholder: string;
  hypertensionTip: string;
};

export const HYPERTENSION_POINT_RULES: PointRule[] = [
  {
    id: "meal",
    title: "식단 인증",
    description: "고혈압 일주일 식단(저염·채소·통곡)을 실천했을 때 적립",
    points: 30,
    dailyLimit: 1,
    placeholder: "예: 월요일 아침·점심 식단 실천",
    hypertensionTip: "나트륨 줄이기·채소·생선 위주 식단은 수축기 혈압 관리에 도움이 됩니다.",
  },
  {
    id: "hospital",
    title: "약물·구두 치료 병원 방문",
    description: "약물 치료·구두 교육을 위해 내과·보건기관을 방문했을 때 적립",
    points: 50,
    dailyLimit: 1,
    placeholder: "예: ○○내과 방문, 복약 상담",
    hypertensionTip: "치료율 표준화율(92.3%) 달성을 위해 처방·복약·구두 교육을 꾸준히 이어가세요.",
  },
  {
    id: "walking",
    title: "산책로 걷기",
    description: "추천 산책로에서 20분 이상 걸었을 때 적립",
    points: 40,
    dailyLimit: 1,
    placeholder: "예: 한강공원 코스 35분",
    hypertensionTip: "주 5회 30분 이상 가벼운 걷기는 고혈압 생활습관 치료의 기본입니다.",
  },
  {
    id: "wristDoctor",
    title: "손목닥터 9988 연결",
    description: "손목닥터 9988에 연결·상담하고 혈압·건강 기록을 연동했을 때 적립",
    points: 60,
    dailyLimit: 1,
    placeholder: "예: 9988 연결 완료, 오늘 혈압 기록 확인",
    hypertensionTip:
      "가정혈압·웨어러블 연동은 23만 명 조사에서도 관리 지속에 도움이 되는 항목입니다. 9988로 연결해 꾸준히 기록하세요.",
  },
];

export type PointEntry = {
  id: string;
  category: PointCategory;
  points: number;
  note: string;
  createdAt: number;
};

export type PointsWallet = {
  total: number;
  entries: PointEntry[];
};

export const POINTS_STORAGE_KEY = "final-hypertension-points-v1";

function localDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseStoredPoints(raw: string | null): PointsWallet {
  if (!raw) {
    return { total: 0, entries: [] };
  }
  try {
    const data = JSON.parse(raw) as Partial<PointsWallet>;
    if (!data || typeof data !== "object" || !Array.isArray(data.entries)) {
      return { total: 0, entries: [] };
    }
    const entries = data.entries
      .filter(
        (e): e is PointEntry =>
          !!e &&
          typeof e === "object" &&
          (e.category === "meal" ||
            e.category === "hospital" ||
            e.category === "walking" ||
            e.category === "wristDoctor") &&
          typeof e.points === "number" &&
          typeof e.note === "string" &&
          typeof e.createdAt === "number",
      )
      .slice(0, 500);
    const total =
      typeof data.total === "number" && Number.isFinite(data.total)
        ? data.total
        : entries.reduce((s, e) => s + e.points, 0);
    return { total, entries };
  } catch {
    return { total: 0, entries: [] };
  }
}

export function getRule(category: PointCategory): PointRule {
  return HYPERTENSION_POINT_RULES.find((r) => r.id === category)!;
}

export function countTodayEntries(wallet: PointsWallet, category: PointCategory): number {
  const today = localDateKey(Date.now());
  return wallet.entries.filter(
    (e) => e.category === category && localDateKey(e.createdAt) === today,
  ).length;
}

export function canEarnPointsToday(
  wallet: PointsWallet,
  category: PointCategory,
): { ok: true } | { ok: false; message: string } {
  const rule = getRule(category);
  const todayCount = countTodayEntries(wallet, category);
  if (todayCount >= rule.dailyLimit) {
    return { ok: false, message: `오늘은 이미 ${rule.title} 포인트를 받았습니다.` };
  }
  return { ok: true };
}

export function earnPoints(
  wallet: PointsWallet,
  category: PointCategory,
  note: string,
): { wallet: PointsWallet; entry: PointEntry } | { error: string } {
  const check = canEarnPointsToday(wallet, category);
  if (!check.ok) {
    return { error: check.message };
  }

  const rule = getRule(category);
  const trimmed = note.replace(/\s+/g, " ").trim().slice(0, 120);
  if (trimmed.length < 2) {
    return { error: "인증 내용을 2자 이상 입력해 주세요." };
  }

  if (category === "walking") {
    const minMatch = trimmed.match(/(\d+)\s*분/);
    if (minMatch) {
      const minutes = Number.parseInt(minMatch[1], 10);
      if (minutes < 20) {
        return { error: "산책로 인증은 20분 이상(예: 25분)으로 기록해 주세요." };
      }
    }
  }

  const entry: PointEntry = {
    id: `${category}-${Date.now()}`,
    category,
    points: rule.points,
    note: trimmed,
    createdAt: Date.now(),
  };

  const walletNext: PointsWallet = {
    total: wallet.total + rule.points,
    entries: [entry, ...wallet.entries],
  };

  return { wallet: walletNext, entry };
}

export function getTreatmentLevel(total: number): { label: string; next: number | null } {
  if (total >= 500) {
    return { label: "고혈압 관리 우수", next: null };
  }
  if (total >= 300) {
    return { label: "치료 연계 활발", next: 500 };
  }
  if (total >= 150) {
    return { label: "생활습관 개선 중", next: 300 };
  }
  if (total >= 50) {
    return { label: "관리 시작", next: 150 };
  }
  return { label: "첫 걸음", next: 50 };
}

export function formatPointDate(ts: number): string {
  return new Date(ts).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
