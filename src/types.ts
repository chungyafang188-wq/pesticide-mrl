export type DataOrigin = "drive" | "bundled" | "cache";

export type QueryMode = "pesticide" | "crop" | "both" | "common";

export type UseTypeFilter = "all" | "insect" | "fungicide" | "herbicide";

export type MrlRecord = {
  id: string;
  nameEn: string;
  nameZh: string;
  crop: string;
  ppmRaw: string;
  ppm: number | null;
  note: string;
  searchText: string;
};

export type CommonUseHit = {
  key: string;
  nameZh: string;
  nameEn: string;
  rowA: MrlRecord | null;
  rowB: MrlRecord | null;
};

export type MrlDataset = {
  fetchedAt: string;
  sourceUrl: string;
  sourcePage: string;
  officialLookup: string;
  sourceNote: string;
  amendmentNotice: string;
  amendmentSource: string;
  count: number;
  crops: string[];
  records: MrlRecord[];
};
