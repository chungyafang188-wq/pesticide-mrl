import { createSearcher, formatLineReply, parseLineText, runQuery } from "./mrl-search.mjs";
import { loadDataset } from "./dataset.mjs";

const text = process.argv.slice(2).join(" ").trim() || "說明";
const dataset = await loadDataset();
const fuse = createSearcher(dataset.records);
const result = runQuery(dataset.records, fuse, parseLineText(text));
console.log(formatLineReply(result));
