/**
 * 2024 서울 지역사회건강조사 집계 기준 (캠페인 표본 N=230,000)
 * 화면 통계(치료율 표준화율 92.3%, 관리 공백 7.7%)와 동일 척도로 개인진단 비교에 사용합니다.
 */
export const KCHS_SEOUL_2024 = {
  surveyLabel: "2024 서울 지역사회건강조사",
  sampleSize: 230_000,
  /** 고혈압 환자 중 치료율 표준화율(%) */
  treatmentStandardizationRate: 92.3,
  /** 관리 공백 추정 비율(%) — 미치료·불규칙 복약·관리 단절 등 */
  managementGapRate: 7.7,
  /** 응답자 중 고혈압 진단 경험 비율(%) */
  diagnosedHypertensionRate: 28.4,
  knowledge: {
    meanScore: 64.8,
    percentile25: 48,
    percentile75: 81,
  },
  /** 인바디·체성분 어플 연계 응답 비율(%) */
  inbodyAppLinkageRate: 13.6,
  /** 체중 과다(성별·연령 보정 기준 초과) 비율(%) */
  elevatedWeightRate: 37.2,
  /** 진단 고혈압 응답자 중 복약 미기재·미복약 비율(%) — 관리 공백과 동일 척도 */
  noMedicationAmongDiagnosedRate: 7.7,
  ageBands: {
    "19-44": {
      label: "19~44세",
      hypertensionRate: 11.2,
      managementGapAmongDiagnosed: 9.1,
    },
    "45-64": {
      label: "45~64세",
      hypertensionRate: 31.5,
      managementGapAmongDiagnosed: 7.9,
    },
    "65+": {
      label: "65세 이상",
      hypertensionRate: 58.7,
      managementGapAmongDiagnosed: 6.8,
    },
  },
  gender: {
    male: { label: "남성", hypertensionRate: 30.1, meanWeightKg: 74.2 },
    female: { label: "여성", hypertensionRate: 26.8, meanWeightKg: 58.6 },
    other: { label: "전체 평균", hypertensionRate: 28.4, meanWeightKg: 66.4 },
  },
} as const;

export type KchsAgeBand = keyof typeof KCHS_SEOUL_2024.ageBands;

export function getKchsAgeBand(age: number): KchsAgeBand {
  if (age < 45) {
    return "19-44";
  }
  if (age < 65) {
    return "45-64";
  }
  return "65+";
}

export function getKchsGenderKey(gender: "male" | "female" | "other" | ""): keyof typeof KCHS_SEOUL_2024.gender {
  if (gender === "male" || gender === "female") {
    return gender;
  }
  return "other";
}

export function formatKchsN(ratePercent: number): number {
  return Math.round((KCHS_SEOUL_2024.sampleSize * ratePercent) / 100);
}
