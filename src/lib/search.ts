import Fuse from "fuse.js";
import { CROP_ALIASES, CROP_PARENT_GROUPS } from "./categories";
import type { CommonUseHit, MrlRecord, UseTypeFilter } from "../types";

function foldName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function createSearcher(records: MrlRecord[]) {
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

function matchPesticide(records: MrlRecord[], _fuse: Fuse<MrlRecord> | null, pesticide: string) {
  const q = foldName(pesticide);
  if (!q) return records;
  return records.filter((r) => foldName(r.nameZh) === q || foldName(r.nameEn) === q);
}

function cropPrimaryName(crop: string): string {
  const cut = crop.search(/[（(]/);
  return (cut === -1 ? crop : crop.slice(0, cut)).trim();
}

function exclusionItems(crop: string): string[] {
  const m = crop.match(/[（(]([^）)]*除外)[）)]/);
  if (!m) return [];
  return m[1]
    .replace(/除外/g, "")
    .split(/[、,，及和]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function cropExcludesQuery(crop: string, q: string, groups: string[] = []): boolean {
  return exclusionItems(crop).some((item) => item === q || groups.includes(item));
}

export function isCategoryQuery(q: string): boolean {
  return q.endsWith("類") || q.startsWith("香辛植物") || q === "草木本植物" || q === "未分類";
}

function canonicalCropName(q: string): string {
  return CROP_ALIASES[q] ?? q;
}

export function parentGroupsFor(records: MrlRecord[], q: string): string[] {
  const query = q.trim();
  const canonical = canonicalCropName(query);
  const groups = new Set<string>([
    ...(CROP_PARENT_GROUPS[query] ?? []),
    ...(CROP_PARENT_GROUPS[canonical] ?? []),
  ]);
  for (const r of records) {
    if (!cropExcludesQuery(r.crop, query) && !cropExcludesQuery(r.crop, canonical)) continue;
    const group = cropPrimaryName(r.crop).replace(/^其他/, "");
    if (group.endsWith("類")) groups.add(group);
  }
  return [...groups];
}

function cropAppliesToQuery(crop: string, q: string, groups: string[]): boolean {
  if (cropExcludesQuery(crop, q, groups)) return false;
  if (crop === q) return true;

  const primary = cropPrimaryName(crop);
  if (primary === q) return true;
  if (isCategoryQuery(q)) {
    return primary === q || primary.includes(q);
  }

  return groups.some((g) => primary === g || primary === `其他${g}`);
}

function matchCrop(records: MrlRecord[], crop: string) {
  const q = crop.trim();
  if (!q) return records;
  const canonical = canonicalCropName(q);
  const names = canonical === q ? [q] : [q, canonical];
  if (names.some(isCategoryQuery)) {
    return records.filter((r) => names.some((name) => cropAppliesToQuery(r.crop, name, [])));
  }
  const groups = [...new Set(names.flatMap((name) => parentGroupsFor(records, name)))];
  return records.filter((r) => names.some((name) => cropAppliesToQuery(r.crop, name, groups)));
}

export function isSpecificCropName(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  if (n.includes("除外") || n.startsWith("其他")) return false;
  if (isCategoryQuery(n) || n === "其他") return false;
  return true;
}

export function listDetailCrops(records: MrlRecord[], category = ""): string[] {
  const names = [...new Set(records.map((r) => r.crop))].filter(isSpecificCropName);
  const cat = category.trim();
  const list =
    cat && isCategoryQuery(cat)
      ? names.filter((n) => parentGroupsFor(records, n).includes(cat))
      : names;
  return list.sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

export function matchesUseType(row: MrlRecord, filter: UseTypeFilter) {
  if (filter === "all") return true;
  const note = row.note;
  if (filter === "insect") {
    return note.includes("殺蟲") || note.includes("殺蟎") || note.includes("殺線蟲");
  }
  if (filter === "fungicide") return note.includes("殺菌");
  return note.includes("殺草") || note.includes("除草");
}

export function searchRecords(
  records: MrlRecord[],
  fuse: Fuse<MrlRecord> | null,
  pesticide: string,
  crop: string,
  limit = 80,
  useType: UseTypeFilter = "all",
): MrlRecord[] {
  const p = pesticide.trim();
  const c = crop.trim();
  if (!p && !c) return [];

  const byPesticide = matchPesticide(records, fuse, p);
  const list = matchCrop(byPesticide, c).filter((row) => matchesUseType(row, useType));
  return list.slice(0, limit);
}

export function countMatches(
  records: MrlRecord[],
  fuse: Fuse<MrlRecord> | null,
  pesticide: string,
  crop: string,
  useType: UseTypeFilter = "all",
) {
  const p = pesticide.trim();
  const c = crop.trim();
  if (!p && !c) return 0;
  return matchCrop(matchPesticide(records, fuse, p), c).filter((row) =>
    matchesUseType(row, useType),
  ).length;
}

function pesticideKey(row: MrlRecord) {
  return `${row.nameZh.trim()}|${row.nameEn.trim().toLowerCase()}`;
}

function bestRowForCrop(rows: MrlRecord[], q: string): MrlRecord {
  const ranked = [...rows].sort((a, b) => {
    const score = (r: MrlRecord) => {
      if (r.crop === q) return 0;
      if (cropPrimaryName(r.crop) === q) return 1;
      if (r.crop.includes(q)) return 2;
      return 3;
    };
    return score(a) - score(b);
  });
  return ranked[0];
}

function groupByPesticide(rows: MrlRecord[]) {
  const map = new Map<string, MrlRecord[]>();
  for (const row of rows) {
    const key = pesticideKey(row);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return map;
}

export function searchCommonUse(
  records: MrlRecord[],
  fuse: Fuse<MrlRecord> | null,
  pesticide: string,
  cropA: string,
  cropB: string,
  limit = 80,
): CommonUseHit[] {
  const a = cropA.trim();
  const b = cropB.trim();
  const p = pesticide.trim();
  if (!a || !b) return [];

  const pool = p ? matchPesticide(records, fuse, p) : records;
  if (p && pool.length === 0) return [];

  const mapA = groupByPesticide(matchCrop(pool, a));
  const mapB = groupByPesticide(matchCrop(pool, b));
  const poolMap = groupByPesticide(pool);

  const keys = (
    p ? [...poolMap.keys()] : [...mapA.keys()].filter((key) => mapB.has(key))
  ).sort((x, y) => {
    const left = poolMap.get(x)![0];
    const right = poolMap.get(y)![0];
    return (left.nameZh || left.nameEn).localeCompare(right.nameZh || right.nameEn, "zh-Hant");
  });

  return keys
    .map((key) => {
      const sample = poolMap.get(key)![0];
      const rowsA = mapA.get(key);
      const rowsB = mapB.get(key);
      return {
        key,
        nameZh: sample.nameZh,
        nameEn: sample.nameEn,
        rowA: rowsA ? bestRowForCrop(rowsA, a) : null,
        rowB: rowsB ? bestRowForCrop(rowsB, b) : null,
      };
    })
    .filter((hit) => (p ? Boolean(hit.rowA || hit.rowB) : Boolean(hit.rowA && hit.rowB)))
    .slice(0, limit);
}

export function countCommonUse(
  records: MrlRecord[],
  fuse: Fuse<MrlRecord> | null,
  pesticide: string,
  cropA: string,
  cropB: string,
) {
  return searchCommonUse(records, fuse, pesticide, cropA, cropB, Number.MAX_SAFE_INTEGER).length;
}
