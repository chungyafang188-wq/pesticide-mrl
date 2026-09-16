import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanText,
  cropWildcardRe,
  extractOrderNo,
  foldKey,
  looksBroken,
  ppmKey,
} from "./lib/amendment-id.mjs";
import { loadLatestOfficialAnnex } from "./lib/official-odt.mjs";

const SOURCE_URL = "https://data.fda.gov.tw/data/opendata/export/13/json";
const SOURCE_PAGE = "https://data.gov.tw/dataset/8944";
const DATASET_API = "https://data.gov.tw/api/v2/rest/dataset/8944";
const FDA_DETAIL =
  "https://data.fda.gov.tw/frontsite/data/DataAction.do?method=doDetail&infoId=13";
const OFFICIAL_LOOKUP =
  "https://consumer.fda.gov.tw/Law/PesticideList.aspx?nodeID=520";
const AMENDMENT_SOURCE =
  "https://law.moj.gov.tw/LawClass/LawHistory.aspx?pcode=L0040083";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "public", "data", "mrl.json");
const officialDir = join(root, "data", "official");

function parsePpm(raw) {
  const n = Number(String(raw ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toRecord(row, index) {
  const nameEn = cleanText(row.nameEn);
  const nameZh = cleanText(row.nameZh);
  const crop = cleanText(row.crop);
  const ppmRaw = cleanText(row.ppmRaw);
  const note = cleanText(row.note);
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

function fromOpenData(row, index) {
  return toRecord(
    {
      nameEn: row["國際普通名稱"],
      nameZh: row["普通名稱"],
      crop: row["作物類別"],
      ppmRaw: row["容許量ppm"],
      note: row["備註"],
    },
    index,
  );
}

function rowKey(r) {
  return `${foldKey(r.nameEn)}|${foldKey(r.crop)}`;
}

async function fetchAmendment() {
  const res = await fetch(AMENDMENT_SOURCE, {
    headers: { "User-Agent": "pesticide-mrl-ingest" },
  });
  if (!res.ok) throw new Error(`沿革頁 HTTP ${res.status}`);
  const html = await res.text();
  const dateM = html.match(
    /修正日期[\s\S]{0,200}?民國\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/,
  );
  if (!dateM) throw new Error("沿革頁找不到修正日期");
  const year = dateM[1];
  const month = dateM[2].padStart(2, "0");
  const day = dateM[3].padStart(2, "0");
  const order = extractOrderNo(html);
  const notice = order
    ? `中華民國${year}年${month}月${day}日衛授食字第${order}號令修正`
    : `中華民國${year}年${month}月${day}日修正`;
  return { notice, orderNo: order };
}

async function fetchOpenDataOrderNo() {
  const chunks = [];
  for (const url of [DATASET_API, FDA_DETAIL, SOURCE_PAGE]) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "pesticide-mrl-ingest" } });
      if (!res.ok) continue;
      chunks.push(await res.text());
    } catch {
      /* 單一來源失敗就試下一個 */
    }
  }
  return extractOrderNo(chunks.join("\n"));
}

function overlayWithOfficial(fdaRows, officialRows) {
  const byKey = new Map();
  const byEn = new Map();
  for (const r of officialRows) {
    const rec = toRecord(r, 0);
    byKey.set(rowKey(rec), rec);
    const en = foldKey(rec.nameEn);
    const list = byEn.get(en) ?? [];
    list.push(rec);
    byEn.set(en, list);
  }

  let corrected = 0;
  const used = new Set();
  const out = fdaRows.map((raw, index) => {
    const fda = fromOpenData(raw, index);
    const exact = byKey.get(rowKey(fda));
    let hit = exact;
    if (!hit && (looksBroken(fda.nameZh) || looksBroken(fda.crop))) {
      const cands = byEn.get(foldKey(fda.nameEn)) ?? [];
      const re = cropWildcardRe(fda.crop);
      const wild = re ? cands.filter((c) => re.test(c.crop)) : [];
      const ppmHits = cands.filter((c) => ppmKey(c.ppmRaw) === ppmKey(fda.ppmRaw));
      const pool = wild.length === 1 ? wild : ppmHits.length === 1 ? ppmHits : [];
      hit = pool[0];
    }
    if (hit && !used.has(rowKey(hit))) {
      used.add(rowKey(hit));
      corrected += 1;
      return toRecord(hit, index);
    }
    return fda;
  });

  return { records: out, corrected };
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
  const existing = await loadExisting();

  let raw;
  try {
    const res = await fetch(SOURCE_URL, { headers: { "User-Agent": "pesticide-mrl-ingest" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (err) {
    if (existing && process.env.INGEST_REQUIRE_FRESH !== "1") {
      console.warn("無法下載開放資料，沿用既有 public/data/mrl.json");
      console.warn(String(err));
      return;
    }
    throw err;
  }
  if (!Array.isArray(raw)) throw new Error("開放資料格式不是陣列");

  let amendmentNotice = existing?.amendmentNotice || "";
  let lawOrderNo = "";
  try {
    const amendment = await fetchAmendment();
    amendmentNotice = amendment.notice;
    lawOrderNo = amendment.orderNo;
    console.log(`法規沿革令號：${lawOrderNo || "（無）"}`);
    console.log(`法規修正：${amendmentNotice}`);
  } catch (err) {
    if (process.env.INGEST_REQUIRE_FRESH === "1") throw err;
    console.warn("無法讀取法規沿革，沿用既有修正令文字");
    console.warn(String(err));
  }
  if (!amendmentNotice) throw new Error("沒有法規修正令文字");

  const openDataOrderNo = (await fetchOpenDataOrderNo()) || lawOrderNo;
  console.log(`開放資料／資料集令號：${openDataOrderNo || "（找不到）"}`);

  let records = raw.map((row, i) => fromOpenData(row, i));
  let sourceNote =
    "衛福部食藥署《農藥殘留容許量標準》附表一開放資料（資料集 8944）。非正式法規文本。";
  let usedOfficial = false;
  let officialOrderNo = "";

  const official = await loadLatestOfficialAnnex(officialDir);
  if (official) {
    officialOrderNo = official.orderNo;
    console.log(`官方 ODT：${official.file.name} 令號 ${officialOrderNo || "（無）"} 附表一 ${official.annex1.length} 筆`);
    if (!officialOrderNo || !openDataOrderNo) {
      console.warn("找不到完整令號，未用 ODT 校正，以免混用不同版本。");
    } else if (officialOrderNo !== openDataOrderNo) {
      console.warn(
        `令號不同：ODT ${officialOrderNo} ≠ 開放資料／法規 ${openDataOrderNo}。未用原文校正。請更換同一號令的 ODT，或等開放資料更新。`,
      );
    } else {
      const merged = overlayWithOfficial(raw, official.annex1);
      records = merged.records;
      usedOfficial = true;
      sourceNote = `衛福部食藥署開放資料（8944）經同一號令衛授食字第${officialOrderNo}號令中文附表原文校正品名。非正式法規文本。`;
      console.log(`已用 ODT 校正 ${merged.corrected} 筆（令號相符）。`);
    }
  } else {
    console.warn(`沒有 ${officialDir} 內的 ODT，僅使用開放資料。`);
  }

  const crops = [...new Set(records.map((r) => r.crop).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-Hant"),
  );

  const payload = {
    fetchedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    sourcePage: SOURCE_PAGE,
    officialLookup: OFFICIAL_LOOKUP,
    amendmentSource: AMENDMENT_SOURCE,
    amendmentNotice,
    sourceNote,
    count: records.length,
    crops,
    records,
    ingestMeta: {
      openDataOrderNo: openDataOrderNo || "",
      officialOrderNo: officialOrderNo || "",
      namesCorrectedFromOdt: usedOfficial,
    },
  };

  await writeFile(outPath, JSON.stringify(payload), "utf8");
  await writeFile(
    join(dirname(outPath), "amendment.json"),
    JSON.stringify({ notice: amendmentNotice, orderNo: openDataOrderNo || lawOrderNo }),
    "utf8",
  );
  console.log(`Wrote ${records.length} records to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
