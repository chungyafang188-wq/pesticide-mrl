import Fuse from "fuse.js";
import { CROP_PARENT_GROUPS } from "./categories";
import type { MrlRecord } from "../types";

function contains(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase());
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

function matchPesticide(records: MrlRecord[], fuse: Fuse<MrlRecord> | null, pesticide: string) {
  const q = pesticide.trim();
  if (!q) return records;

  const exact = records.filter(
    (r) => contains(r.nameZh, q) || contains(r.nameEn, q),
  );
  if (exact.length) {
    return exact.sort((a, b) => {
      const aExact = a.nameZh === q || a.nameEn.toLowerCase() === q.toLowerCase() ? 0 : 1;
      const bExact = b.nameZh === q || b.nameEn.toLowerCase() === q.toLowerCase() ? 0 : 1;
      return aExact - bExact;
    });
  }

  if (!fuse) return [];
  return fuse.search(q).map((hit) => hit.item);
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

function cropExcludesQuery(crop: string, q: string): boolean {
  return exclusionItems(crop).some((item) => item === q);
}

function isCategoryQuery(q: string): boolean {
  return q.endsWith("類") || q.startsWith("香辛植物") || q === "草木本植物" || q === "未分類";
}

function parentGroupsFor(records: MrlRecord[], q: string): string[] {
  const groups = new Set<string>(CROP_PARENT_GROUPS[q] ?? []);
  for (const r of records) {
    if (!cropExcludesQuery(r.crop, q)) continue;
    const group = cropPrimaryName(r.crop).replace(/^其他/, "");
    if (group.endsWith("類")) groups.add(group);
  }
  return [...groups];
}

function cropAppliesToQuery(crop: string, q: string, groups: string[]): boolean {
  if (cropExcludesQuery(crop, q)) return false;
  if (crop === q) return true;

  const primary = cropPrimaryName(crop);
  if (isCategoryQuery(q)) {
    return primary === q || primary.includes(q);
  }

  return groups.some((g) => primary === g || primary === `其他${g}`);
}

function matchCrop(records: MrlRecord[], crop: string) {
  const q = crop.trim();
  if (!q) return records;
  const groups = isCategoryQuery(q) ? [] : parentGroupsFor(records, q);
  return records.filter((r) => cropAppliesToQuery(r.crop, q, groups));
}

export function searchRecords(
  records: MrlRecord[],
  fuse: Fuse<MrlRecord> | null,
  pesticide: string,
  crop: string,
  limit = 80,
): MrlRecord[] {
  const p = pesticide.trim();
  const c = crop.trim();
  if (!p && !c) return [];

  const byPesticide = matchPesticide(records, fuse, p);
  const list = matchCrop(byPesticide, c);
  return list.slice(0, limit);
}

export function countMatches(
  records: MrlRecord[],
  fuse: Fuse<MrlRecord> | null,
  pesticide: string,
  crop: string,
) {
  const p = pesticide.trim();
  const c = crop.trim();
  if (!p && !c) return 0;
  return matchCrop(matchPesticide(records, fuse, p), c).length;
}
