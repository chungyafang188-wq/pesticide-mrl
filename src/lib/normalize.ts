import type { MrlDataset, MrlRecord } from "../types";

const SOURCE_URL = "https://data.fda.gov.tw/data/opendata/export/13/json";
const SOURCE_PAGE = "https://data.gov.tw/dataset/8944";
const OFFICIAL_LOOKUP =
  "https://consumer.fda.gov.tw/Law/PesticideList.aspx?nodeID=520";

function parsePpm(raw: unknown): number | null {
  const text = String(raw ?? "").trim();
  const n = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalizeRow(row: Record<string, unknown>, index: number): MrlRecord {
  const nameEn = String(row["國際普通名稱"] ?? row.nameEn ?? "").trim();
  const nameZh = String(row["普通名稱"] ?? row.nameZh ?? "").trim();
  const crop = String(row["作物類別"] ?? row.crop ?? "").trim();
  const ppmRaw = String(row["容許量ppm"] ?? row.ppmRaw ?? "").trim();
  const note = String(row["備註"] ?? row.note ?? "").trim();
  return {
    id: String(row.id ?? `${index}-${nameEn}-${crop}`),
    nameEn,
    nameZh,
    crop,
    ppmRaw,
    ppm: typeof row.ppm === "number" ? row.ppm : parsePpm(ppmRaw),
    note,
    searchText:
      typeof row.searchText === "string"
        ? row.searchText
        : `${nameZh} ${nameEn} ${crop} ${note}`.toLowerCase(),
  };
}

export function parseDataset(raw: unknown): MrlDataset {
  if (raw && typeof raw === "object" && Array.isArray((raw as MrlDataset).records)) {
    const data = raw as MrlDataset;
    const records = data.records.map((row, i) =>
      normalizeRow(row as unknown as Record<string, unknown>, i),
    );
    return {
      fetchedAt: data.fetchedAt || new Date().toISOString(),
      sourceUrl: data.sourceUrl || SOURCE_URL,
      sourcePage: data.sourcePage || SOURCE_PAGE,
      officialLookup: data.officialLookup || OFFICIAL_LOOKUP,
      sourceNote:
        data.sourceNote ||
        "衛福部食藥署《農藥殘留容許量標準》附表一。非正式法規文本。",
      count: records.length,
      crops:
        data.crops?.length > 0
          ? data.crops
          : [...new Set(records.map((r) => r.crop).filter(Boolean))].sort((a, b) =>
              a.localeCompare(b, "zh-Hant"),
            ),
      records,
    };
  }

  if (!Array.isArray(raw)) {
    throw new Error("雲端檔案不是容許量 JSON（需為陣列或含 records 的物件）");
  }

  const records = raw.map((row, i) =>
    normalizeRow((row ?? {}) as Record<string, unknown>, i),
  );
  return {
    fetchedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    sourcePage: SOURCE_PAGE,
    officialLookup: OFFICIAL_LOOKUP,
    sourceNote:
      "衛福部食藥署《農藥殘留容許量標準》附表一開放資料。由雲端硬碟載入。非正式法規文本。",
    count: records.length,
    crops: [...new Set(records.map((r) => r.crop).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "zh-Hant"),
    ),
    records,
  };
}
