import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://data.fda.gov.tw/data/opendata/export/13/json";
const SOURCE_PAGE = "https://data.gov.tw/dataset/8944";
const OFFICIAL_LOOKUP =
  "https://consumer.fda.gov.tw/Law/PesticideList.aspx?nodeID=520";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "public", "data", "mrl.json");

function parsePpm(raw) {
  const text = String(raw ?? "").trim();
  const n = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalize(row, index) {
  const nameEn = String(row["國際普通名稱"] ?? "").trim();
  const nameZh = String(row["普通名稱"] ?? "").trim();
  const crop = String(row["作物類別"] ?? "").trim();
  const ppmRaw = String(row["容許量ppm"] ?? "").trim();
  const note = String(row["備註"] ?? "").trim();
  return {
    id: `${index}-${nameEn}-${crop}`,
    nameEn,
    nameZh,
    crop,
    ppmRaw,
    ppm: parsePpm(ppmRaw),
    note,
    searchText: `${nameZh} ${nameEn} ${crop} ${note}`.toLowerCase(),
  };
}

async function loadExisting() {
  try {
    return JSON.parse(await readFile(outPath, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(dirname(outPath), { recursive: true });
  let raw;
  try {
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (err) {
    const existing = await loadExisting();
    if (existing && process.env.INGEST_REQUIRE_FRESH !== "1") {
      console.warn("無法下載開放資料，沿用既有 public/data/mrl.json");
      console.warn(String(err));
      return;
    }
    throw err;
  }

  if (!Array.isArray(raw)) {
    throw new Error("開放資料格式不是陣列");
  }

  const records = raw.map(normalize);
  const crops = [...new Set(records.map((r) => r.crop).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "zh-Hant"),
  );

  const payload = {
    fetchedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    sourcePage: SOURCE_PAGE,
    officialLookup: OFFICIAL_LOOKUP,
    sourceNote: "衛福部食藥署《農藥殘留容許量標準》附表一開放資料（資料集 8944）。非正式法規文本。",
    count: records.length,
    crops,
    records,
  };

  await writeFile(outPath, JSON.stringify(payload), "utf8");
  console.log(`Wrote ${records.length} records to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
