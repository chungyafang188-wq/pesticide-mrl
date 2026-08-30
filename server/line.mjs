import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSearcher, formatLineReply, parseLineText, runQuery } from "./mrl-search.mjs";
import { loadDataset } from "./dataset.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

const PORT = Number(process.env.PORT || 8787);
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "";
const CHANNEL_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";

let records = [];
let fuse = null;

function isValidSignature(rawBody, signature) {
  if (!CHANNEL_SECRET || !signature) return false;
  const hash = createHmac("sha256", CHANNEL_SECRET).update(rawBody).digest("base64");
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function replyMessage(replyToken, text) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHANNEL_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: text.slice(0, 4900) }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("LINE reply failed", res.status, body);
  }
}

async function handleEvent(event) {
  if (event.type === "follow" || event.type === "join") {
    if (event.replyToken) {
      await replyMessage(
        event.replyToken,
        formatLineReply({ type: "help" }),
      );
    }
    return;
  }
  if (event.type !== "message" || event.message?.type !== "text" || !event.replyToken) {
    return;
  }
  const parsed = parseLineText(event.message.text);
  const result = runQuery(records, fuse, parsed);
  await replyMessage(event.replyToken, formatLineReply(result));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, records: records.length }));
    return;
  }

  if (req.method !== "POST" || req.url !== "/webhook") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const raw = await readBody(req);
  const signature = req.headers["x-line-signature"];
  if (!isValidSignature(raw, Array.isArray(signature) ? signature[0] : signature)) {
    res.writeHead(401);
    res.end("Invalid signature");
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end("{}");

  try {
    const payload = JSON.parse(raw.toString("utf8"));
    for (const event of payload.events ?? []) {
      await handleEvent(event);
    }
  } catch (err) {
    console.error(err);
  }
});

if (!CHANNEL_SECRET || !CHANNEL_TOKEN) {
  console.error("請設定環境變數 LINE_CHANNEL_SECRET 與 LINE_CHANNEL_ACCESS_TOKEN");
  process.exit(1);
}

const dataset = await loadDataset();
records = dataset.records;
fuse = createSearcher(records);

server.listen(PORT, () => {
  console.log(`LINE webhook http://127.0.0.1:${PORT}/webhook （${records.length} 筆）`);
});
