/** 앱 탭 쿼리 (?tab=...) — page.tsx ViewTab 과 동일하게 유지 */
export const APP_TAB_IDS = [
  "meal",
  "medicationVerbal",
  "walking",
  "map",
  "noTreatment",
  "personalDiagnosis",
  "points",
  "chsWebsite",
] as const;

export type AppTabId = (typeof APP_TAB_IDS)[number];

export const APP_TAB_QUERY_KEY = "tab";

export const EXTERNAL_URLS = {
  /** 질병관리청 지역사회건강조사 홈 */
  chsHome: "https://chs.kdca.go.kr/",
  /** 지역사회건강통계 · 2024 통계집 등 */
  chsHealthStats: "https://chs.kdca.go.kr/chs/recsRoom/healthStatsMain.do",
  wristDoctorTel: "9988",
} as const;

export const APP_TAB_LABELS: Record<AppTabId, string> = {
  meal: "고혈압 일주일 식단 추천",
  medicationVerbal: "약물·구두 치료",
  walking: "산책로 추천",
  map: "지도 보기",
  noTreatment: "치료하지 않는 이유",
  personalDiagnosis: "개인진단",
  points: "포인트 적립",
  chsWebsite: "누리집 연결하기",
};

const DEFAULT_ORIGIN = "http://localhost:3000";

export function isAppTabId(value: string | null): value is AppTabId {
  return value !== null && (APP_TAB_IDS as readonly string[]).includes(value);
}

/** 공유·북마크용 사이트 URL (?tab=선택) */
export function buildAppUrl(tab?: AppTabId, origin?: string): string {
  const base = (origin ?? (typeof window !== "undefined" ? window.location.origin : DEFAULT_ORIGIN)).replace(
    /\/$/,
    "",
  );
  if (!tab) {
    return `${base}/`;
  }
  return `${base}/?${APP_TAB_QUERY_KEY}=${tab}`;
}

export function getAppTabLinks(origin?: string) {
  const o = origin ?? (typeof window !== "undefined" ? window.location.origin : DEFAULT_ORIGIN);
  return APP_TAB_IDS.map((tab) => ({
    tab,
    label: APP_TAB_LABELS[tab],
    url: buildAppUrl(tab, o),
  }));
}

export function syncAppTabUrl(tab: AppTabId) {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set(APP_TAB_QUERY_KEY, tab);
  window.history.replaceState(null, "", url.toString());
}

export function readAppTabFromUrl(): AppTabId | null {
  if (typeof window === "undefined") {
    return null;
  }
  const tab = new URLSearchParams(window.location.search).get(APP_TAB_QUERY_KEY);
  return isAppTabId(tab) ? tab : null;
}
