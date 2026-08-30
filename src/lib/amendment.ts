export const FALLBACK_AMENDMENT =
  "中華民國115年04月21日衛授食字第1151300817號令修正";

export const AMENDMENT_SOURCE =
  "https://law.moj.gov.tw/LawClass/LawHistory.aspx?pcode=L0040083";

export function amendmentText(notice?: string | null) {
  const value = notice?.trim();
  return value || FALLBACK_AMENDMENT;
}
