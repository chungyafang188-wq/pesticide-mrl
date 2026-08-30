export type DataOrigin = "drive" | "bundled" | "cache";

export type QueryMode = "pesticide" | "crop" | "both";

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

export type MrlDataset = {
  fetchedAt: string;
  sourceUrl: string;
  sourcePage: string;
  officialLookup: string;
  sourceNote: string;
  count: number;
  crops: string[];
  records: MrlRecord[];
};
