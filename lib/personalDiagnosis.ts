import {
  KCHS_SEOUL_2024,
  formatKchsN,
  getKchsAgeBand,
  getKchsGenderKey,
} from "@/data/kchsSeoulBenchmark";

export type KnowledgeAnswer = "yes" | "no" | "unsure";

export type PersonalDiagnosisForm = {
  name: string;
  gender: "male" | "female" | "other" | "";
  age: string;
  hypertensionDiagnosed: "yes" | "no" | "unsure";
  medications: string;
  weightKg: string;
  inbodyLinked: "yes" | "no" | "planned";
  knowledgeAnswers: Record<string, KnowledgeAnswer>;
};

export const HYPERTENSION_KNOWLEDGE_QUESTION_IDS = [
  "bp_normal",
  "salt",
  "asymptomatic",
  "lifestyle",
  "home_bp",
  "inbody_role",
] as const;

export type PersonalDiagnosisSegment =
  | "treatment_linked"
  | "management_gap"
  | "high_risk_undiagnosed"
  | "prevention";

export type PersonalDiagnosisResult = {
  submittedAt: number;
  level: "good" | "caution" | "urgent";
  levelLabel: string;
  knowledgeScore: number;
  summary: string;
  recommendations: string[];
  benchmarkSource: string;
  cohortSegment: string;
  segmentKey: PersonalDiagnosisSegment;
  cohortComparisons: string[];
};

export function computeKnowledgeScore(
  answers: Record<string, KnowledgeAnswer>,
  questionCount: number,
): number {
  const sum = HYPERTENSION_KNOWLEDGE_QUESTION_IDS.reduce((acc, id) => {
    const a = answers[id] ?? "unsure";
    if (a === "yes") {
      return acc + 1;
    }
    if (a === "unsure") {
      return acc + 0.5;
    }
    return acc;
  }, 0);
  return Math.round((sum / questionCount) * 100);
}

function isElevatedWeight(weightKg: number, gender: PersonalDiagnosisForm["gender"]): boolean {
  const g = getKchsGenderKey(gender);
  const mean = KCHS_SEOUL_2024.gender[g].meanWeightKg;
  return weightKg >= mean * 1.12;
}

export function buildPersonalDiagnosis(
  form: PersonalDiagnosisForm,
  questionCount: number,
): PersonalDiagnosisResult | null {
  const name = form.name.trim();
  const age = Number.parseInt(form.age, 10);
  if (name.length < 1 || !form.gender || !Number.isFinite(age) || age < 1 || age > 120) {
    return null;
  }

  const b = KCHS_SEOUL_2024;
  const ageBand = getKchsAgeBand(age);
  const ageStats = b.ageBands[ageBand];
  const genderKey = getKchsGenderKey(form.gender);
  const genderStats = b.gender[genderKey];
  const knowledgeScore = computeKnowledgeScore(form.knowledgeAnswers, questionCount);
  const weight = Number.parseFloat(form.weightKg);
  const hasWeight = Number.isFinite(weight) && weight > 0;
  const weightElevated = hasWeight && isElevatedWeight(weight, form.gender);
  const onMedication = form.medications.trim().length > 0;

  const cohortComparisons: string[] = [
    `${b.surveyLabel} 표본 ${b.sampleSize.toLocaleString("ko-KR")}명 기준으로 비교했습니다.`,
    `같은 연령대(${ageStats.label}) 응답자의 고혈압 진단 비율은 ${ageStats.hypertensionRate}%입니다.`,
    `${genderStats.label} 응답자의 고혈압 진단 비율은 ${genderStats.hypertensionRate}%입니다.`,
    `23만 명의 고혈압 지식 평균 점수는 ${b.knowledge.meanScore}점(상위 25% ${b.knowledge.percentile75}점 이상)입니다.`,
    `진단 고혈압 응답자의 ${b.noMedicationAmongDiagnosedRate}%(약 ${formatKchsN(b.noMedicationAmongDiagnosedRate).toLocaleString("ko-KR")}명)가 복약 기록이 없거나 관리가 단절된 것으로 집계되었습니다.`,
  ];

  let segmentKey: PersonalDiagnosisSegment = "prevention";
  let cohortSegment = "일반 예방·선별 검사 권장 군";
  let level: PersonalDiagnosisResult["level"] = "good";

  const matchesManagementGap =
    (form.hypertensionDiagnosed === "yes" && !onMedication) ||
    (form.hypertensionDiagnosed === "yes" && knowledgeScore < b.knowledge.percentile25) ||
    (form.hypertensionDiagnosed === "unsure" &&
      age >= 45 &&
      knowledgeScore < b.knowledge.meanScore &&
      !onMedication);

  const matchesTreatmentLinked =
    form.hypertensionDiagnosed === "yes" && onMedication && knowledgeScore >= b.knowledge.percentile25;

  const matchesHighRiskUndiagnosed =
    form.hypertensionDiagnosed !== "yes" &&
    (age >= 65 || (age >= 45 && knowledgeScore < b.knowledge.meanScore)) &&
    (weightElevated || form.inbodyLinked === "no");

  if (matchesManagementGap) {
    segmentKey = "management_gap";
    cohortSegment = `미치료율 추정 군(전체의 ${b.managementGapRate}%, 약 ${formatKchsN(b.managementGapRate).toLocaleString("ko-KR")}명)`;
    level = "urgent";
    cohortComparisons.push(
      `귀하의 응답 패턴은 23만 명 중 미치료율 ${b.managementGapRate}% 집단(치료율 표준화율 ${b.treatmentStandardizationRate}% 미달 영역)과 유사합니다.`,
    );
  } else if (matchesTreatmentLinked) {
    segmentKey = "treatment_linked";
    cohortSegment = `치료 연계·표준화 관리 군(전체의 ${b.treatmentStandardizationRate}%, 약 ${formatKchsN(b.treatmentStandardizationRate).toLocaleString("ko-KR")}명)`;
    level = knowledgeScore >= b.knowledge.meanScore ? "good" : "caution";
    cohortComparisons.push(
      `진단 후 복약·관리 응답은 23만 명 중 치료율 표준화율 ${b.treatmentStandardizationRate}%에 해당하는 연계 군과 유사합니다.`,
    );
  } else if (matchesHighRiskUndiagnosed) {
    segmentKey = "high_risk_undiagnosed";
    cohortSegment = "고위험 미진단·선별 필요 군";
    level = "caution";
    cohortComparisons.push(
      `진단 경험이 없으나 ${ageStats.label}·${genderStats.label} 고혈압 유병률(${ageStats.hypertensionRate}% / ${genderStats.hypertensionRate}%) 대비 선별 검사가 필요할 수 있습니다.`,
    );
    cohortComparisons.push(
      `23만 명 중 미치료율 ${b.managementGapRate}%(${formatKchsN(b.managementGapRate).toLocaleString("ko-KR")}명)에는 미진단·미복약 고위험 응답도 포함됩니다.`,
    );
  } else {
    segmentKey = "prevention";
    level =
      knowledgeScore < b.knowledge.percentile25
        ? "caution"
        : knowledgeScore >= b.knowledge.meanScore
          ? "good"
          : "caution";
  }

  if (knowledgeScore < b.knowledge.percentile25) {
    cohortComparisons.push(
      `고혈압 지식 ${knowledgeScore}점은 23만 명 하위 25%(${b.knowledge.percentile25}점 미만) 구간입니다.`,
    );
    if (level === "good") {
      level = "caution";
    }
  } else if (knowledgeScore >= b.knowledge.percentile75) {
    cohortComparisons.push(
      `고혈압 지식 ${knowledgeScore}점은 23만 명 상위 25%(${b.knowledge.percentile75}점 이상)에 해당합니다.`,
    );
  } else {
    cohortComparisons.push(
      `고혈압 지식 ${knowledgeScore}점은 23만 명 평균(${b.knowledge.meanScore}점) ${knowledgeScore >= b.knowledge.meanScore ? "이상" : "미만"}입니다.`,
    );
  }

  if (form.inbodyLinked === "yes") {
    cohortComparisons.push(
      `인바디·체성분 어플 연계 응답(${b.inbodyAppLinkageRate}%, 약 ${formatKchsN(b.inbodyAppLinkageRate).toLocaleString("ko-KR")}명)보다 적극적인 관리 패턴입니다.`,
    );
  } else if (form.inbodyLinked === "no") {
    cohortComparisons.push(
      `인바디·체성분 어플 미연계는 23만 명 중 다수(${(100 - b.inbodyAppLinkageRate).toFixed(1)}%)와 같습니다. 연계 시 관리 지속률이 높게 보고되었습니다.`,
    );
  }

  if (weightElevated) {
    cohortComparisons.push(
      `체중 ${weight}kg은 ${genderStats.label} 조사 평균(${genderStats.meanWeightKg}kg) 대비 과체중 구간(조사 과체중 응답 ${b.elevatedWeightRate}%)에 가깝습니다.`,
    );
    if (level === "good") {
      level = "caution";
    }
  }

  const levelLabel =
    level === "urgent"
      ? "미치료율 군 — 적극 연계 필요"
      : level === "caution"
        ? "평균 이하 — 생활·교육 보완"
        : "표준화 관리 군 — 유지";

  const recommendations: string[] = [];

  if (segmentKey === "management_gap") {
    recommendations.push(
      `23만 명 조사에서 미치료율 ${b.managementGapRate}%에 해당할 수 있습니다. 가까운 보건소·내과에서 약물·구두 치료 연계를 받으세요.`,
    );
  }
  if (segmentKey === "treatment_linked") {
    recommendations.push(
      `치료율 표준화율 ${b.treatmentStandardizationRate}% 연계 군과 유사합니다. 복약·가정혈압 기록을 꾸준히 유지하세요.`,
    );
  }
  if (segmentKey === "high_risk_undiagnosed" || segmentKey === "prevention") {
    recommendations.push(
      `${ageStats.label} 기준 고혈압 유병 ${ageStats.hypertensionRate}%를 참고해 가정혈압을 측정하고, 이상 시 진료를 받으세요.`,
    );
  }
  if (knowledgeScore < b.knowledge.meanScore) {
    recommendations.push(
      `지식 점수가 23만 명 평균(${b.knowledge.meanScore}점)보다 낮습니다. 보건소 고혈압 교육·저염 식단 안내를 활용하세요.`,
    );
  }
  if (form.inbodyLinked !== "yes") {
    recommendations.push(
      `조사 응답자의 ${b.inbodyAppLinkageRate}%만 체성분 어플을 연계했습니다. 인바디·체성분 기록을 시작하면 관리에 도움이 됩니다.`,
    );
  }
  recommendations.push("본 결과는 23만 명 집단 통계와의 비교이며, 최종 진단·처방은 의료진과 상담하세요.");

  const summary = `${name}님(${age}세, ${genderStats.label})은 「${cohortSegment}」으로 분류되었습니다. 지식 ${knowledgeScore}점(23만 명 평균 ${b.knowledge.meanScore}점), ${b.surveyLabel} ${b.sampleSize.toLocaleString("ko-KR")}명 표본과 비교한 참고 진단입니다.`;

  return {
    submittedAt: Date.now(),
    level,
    levelLabel,
    knowledgeScore,
    summary,
    recommendations,
    benchmarkSource: `${b.surveyLabel} N=${b.sampleSize.toLocaleString("ko-KR")}`,
    cohortSegment,
    segmentKey,
    cohortComparisons,
  };
}
