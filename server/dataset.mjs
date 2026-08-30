import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = join(root, "public", "data", "mrl.json");

export async function loadDataset() {
  const data = JSON.parse(await readFile(dataPath, "utf8"));
  if (!data?.records?.length) {
    throw new Error("public/data/mrl.json 沒有 records，請先執行 npm run ingest");
  }
  return data;
}
