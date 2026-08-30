import Fuse from "fuse.js";

function contains(hay, needle) {
  return String(hay).toLowerCase().includes(String(needle).toLowerCase());
}

export function createSearcher(records) {
  return new Fuse(records, {
    includeScore: true,
    threshold: 0.34,
    ignoreLocation: true,
    minMatchCharLength: 1,
    keys: [
      { name: "nameZh", weight: 0.6 },
      { name: "nameEn", weight: 0.4 },
    ],
  });
}

function matchPesticide(records, fuse, pesticide) {
  const q = pesticide.trim();
  if (!q) return records;
  const exact = records.filter((r) => contains(r.nameZh, q) || contains(r.nameEn, q));
  if (exact.length) return exact;
  return fuse.search(q).map((hit) => hit.item);
}

function cropPrimaryName(crop) {
  const cut = String(crop).search(/[（(]/);
  return (cut === -1 ? crop : String(crop).slice(0, cut)).trim();
}

function exclusionItems(crop) {
  const m = String(crop).match(/[（(]([^）)]*除外)[）)]/);
  if (!m) return [];
  return m[1]
    .replace(/除外/g, "")
    .split(/[、,，及和]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function cropExcludesQuery(crop, q) {
  return exclusionItems(crop).some((item) => item === q);
}

function isCategoryQuery(q) {
  return q.endsWith("類") || String(q).startsWith("香辛植物") || q === "草木本植物" || q === "未分類";
}

const PARENT = {
  結球萵苣: ["包葉菜類"],
  結球白菜: ["包葉菜類"],
  甘藍: ["包葉菜類"],
  抱子甘藍: ["包葉菜類"],
  花椰菜: ["包葉菜類"],
  青花菜: ["包葉菜類"],
  不結球萵苣: ["小葉菜類"],
  半結球萵苣: ["小葉菜類"],
  蘋果: ["梨果類"],
  梨: ["梨果類"],
};

function parentGroupsFor(records, q) {
  const groups = new Set(PARENT[q] ?? []);
  for (const r of records) {
    if (!cropExcludesQuery(r.crop, q)) continue;
    const group = cropPrimaryName(r.crop).replace(/^其他/, "");
    if (group.endsWith("類")) groups.add(group);
  }
  return [...groups];
}

function cropAppliesToQuery(crop, q, groups) {
  if (cropExcludesQuery(crop, q)) return false;
  if (crop === q) return true;
  const primary = cropPrimaryName(crop);
  if (isCategoryQuery(q)) {
    return primary === q || primary.includes(q);
  }
  return groups.some((g) => primary === g || primary === `其他${g}`);
}

function matchCrop(records, crop) {
  const q = crop.trim();
  if (!q) return records;
  const groups = isCategoryQuery(q) ? [] : parentGroupsFor(records, q);
  return records.filter((r) => cropAppliesToQuery(r.crop, q, groups));
}

export function searchRecords(records, fuse, pesticide, crop, limit = 12) {
  const list = matchCrop(matchPesticide(records, fuse, pesticide), crop);
  return { rows: list.slice(0, limit), total: list.length };
}

const HELP_RE = /^(help|幫助|說明|查詢|你好|hi|hello|\?|？)$/i;

export function parseLineText(text) {
  const t = String(text ?? "").trim();
  if (!t || HELP_RE.test(t)) return { kind: "help" };

  const labeled = t.match(
    /(?:藥劑|農藥)[:：]\s*(.+?)\s+(?:作物|蔬菜)[:：]\s*(.+)/,
  );
  if (labeled) {
    return { kind: "search", pesticide: labeled[1].trim(), crop: labeled[2].trim() };
  }

  const parts = t.split(/[\s,，、]+/).filter(Boolean);
  if (parts.length === 1) {
    return { kind: "keyword", query: parts[0] };
  }
  return {
    kind: "search",
    pesticide: parts[0],
    crop: parts.slice(1).join(""),
  };
}

export function runQuery(records, fuse, parsed) {
  if (parsed.kind === "help") return { type: "help" };

  if (parsed.kind === "keyword") {
    const asPesticide = searchRecords(records, fuse, parsed.query, "", 12);
    if (asPesticide.total) {
      return {
        type: "results",
        pesticide: parsed.query,
        crop: "",
        ...asPesticide,
      };
    }
    const asCrop = searchRecords(records, fuse, "", parsed.query, 12);
    return {
      type: "results",
      pesticide: "",
      crop: parsed.query,
      ...asCrop,
    };
  }

  return {
    type: "results",
    pesticide: parsed.pesticide,
    crop: parsed.crop,
    ...searchRecords(records, fuse, parsed.pesticide, parsed.crop, 12),
  };
}

export function formatLineReply(result) {
  if (result.type === "help") {
    return [
      "農藥殘留容許量查詢（衛福部食藥署附表一）",
      "非正式法規文本，以最新公告為準。",
      "",
      "怎麼查：",
      "・只傳藥劑，例如：賽滅寧",
      "・只傳作物，例如：蘋果",
      "・藥劑＋作物，例如：賽滅寧 梨果類",
      "・或：藥劑：賽滅寧 作物：蘋果",
      "",
      "表上未列之農藥，原則上不得檢出。",
    ].join("\n");
  }

  const title =
    result.pesticide && result.crop
      ? `「${result.pesticide}」×「${result.crop}」`
      : `「${result.pesticide || result.crop}」`;

  if (!result.total) {
    return [
      `查無 ${title} 的容許量列。`,
      "台灣採正面表列：未列於表之農藥，原則上不得檢出。",
      "作物常寫成大類（蘋果多在梨果類）。可改傳藥劑名稱再查。",
    ].join("\n");
  }

  const lines = result.rows.map((row) => {
    const name = row.nameZh || row.nameEn;
    const note = row.note ? `（${row.note}）` : "";
    return `・${name}／${row.crop}：${row.ppmRaw} ppm${note}`;
  });

  const more =
    result.total > result.rows.length
      ? `僅顯示前 ${result.rows.length} 筆，共 ${result.total} 筆。`
      : "";

  return [
    `${title} 共 ${result.total} 筆`,
    ...lines,
    more,
    "",
    "非正式法規文本。",
  ]
    .filter((x) => x !== "")
    .join("\n");
}
