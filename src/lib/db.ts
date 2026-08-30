import { openDB } from "idb";
import type { DataOrigin, MrlDataset } from "../types";
import { fetchDriveJson, isDriveFolderLink, parseDriveFileId } from "./drive";
import { parseDataset } from "./normalize";
import { loadDriveSettings } from "./settings";

const DB_NAME = "pesticide-mrl";
const STORE = "meta";

export type LoadResult = {
  data: MrlDataset;
  origin: DataOrigin;
};

async function db() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore("meta");
    },
  });
}

export async function saveDataset(data: MrlDataset): Promise<void> {
  const database = await db();
  await database.put(STORE, data, "dataset");
}

export async function loadCachedDataset(): Promise<MrlDataset | null> {
  const database = await db();
  return (await database.get(STORE, "dataset")) ?? null;
}

async function fetchBundled(): Promise<MrlDataset> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/mrl.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseDataset(await res.json());
}

export async function fetchFromDrive(): Promise<MrlDataset> {
  const settings = loadDriveSettings();
  if (isDriveFolderLink(settings.shareUrl)) {
    throw new Error("請貼 JSON 檔的分享連結，不要貼整個資料夾");
  }
  const fileId = parseDriveFileId(settings.shareUrl);
  if (!fileId) {
    throw new Error("請先貼上雲端硬碟檔案分享連結");
  }
  const raw = await fetchDriveJson(fileId, settings.apiKey);
  const data = parseDataset(raw);
  await saveDataset(data);
  return data;
}

export async function loadDataset(): Promise<LoadResult> {
  const cached = await loadCachedDataset();
  if (cached) {
    return { data: cached, origin: "cache" };
  }
  const settings = loadDriveSettings();
  if (parseDriveFileId(settings.shareUrl)) {
    try {
      const data = await fetchFromDrive();
      return { data, origin: "drive" };
    } catch {
      const data = await fetchBundled();
      await saveDataset(data);
      return { data, origin: "bundled" };
    }
  }
  const data = await fetchBundled();
  await saveDataset(data);
  return { data, origin: "bundled" };
}

export async function refreshDataset(): Promise<LoadResult> {
  const settings = loadDriveSettings();
  if (parseDriveFileId(settings.shareUrl)) {
    const data = await fetchFromDrive();
    return { data, origin: "drive" };
  }
  const data = await fetchBundled();
  await saveDataset(data);
  return { data, origin: "bundled" };
}
