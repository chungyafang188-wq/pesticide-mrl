import { readFile } from "node:fs/promises";

function decodeXml(s) {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/<text:line-break\/>/g, "\n")
    .replace(/<text:tab\/>/g, "\t")
    .replace(/<text:s text:c="(\d+)"\/>/g, (_, n) => " ".repeat(Number(n)))
    .replace(/<text:s\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cellRepeat(tag) {
  const m = tag.match(/table:number-columns-repeated="(\d+)"/);
  return m ? Number(m[1]) : 1;
}

function rowRepeat(tag) {
  const m = tag.match(/table:number-rows-repeated="(\d+)"/);
  return m ? Number(m[1]) : 1;
}

function parseRow(rowXml) {
  const cells = [];
  const re =
    /<(table:covered-table-cell|table:table-cell)\b([^>]*)(?:\/>|>([\s\S]*?)<\/table:table-cell>)/g;
  let m;
  while ((m = re.exec(rowXml))) {
    const kind = m[1];
    const attrs = m[2] || "";
    const inner = m[3] || "";
    const n = cellRepeat(attrs);
    const text = kind === "table:covered-table-cell" ? "" : decodeXml(inner);
    for (let i = 0; i < n; i++) cells.push(text);
  }
  return cells;
}

function parseTable(tableXml) {
  const nameM = tableXml.match(/table:name="([^"]+)"/);
  const name = nameM ? nameM[1] : "";
  const rows = [];
  const re = /<table:table-row\b([^>]*)>([\s\S]*?)<\/table:table-row>/g;
  let m;
  while ((m = re.exec(tableXml))) {
    const n = rowRepeat(m[1] || "");
    const row = parseRow(m[2] || "");
    if (row.every((c) => !c)) continue;
    for (let i = 0; i < n; i++) rows.push(row);
  }
  return { name, rows };
}

function headingIndex(row, ...labels) {
  for (const l of labels) {
    const want = l.replace(/\s/g, "");
    const exact = row.findIndex((c) => c.replace(/\s/g, "") === want);
    if (exact >= 0) return exact;
  }
  return -1;
}

function isHeader(row) {
  const joined = row.join(" ");
  return joined.includes("國際普通名稱") && joined.includes("普通名稱");
}

function extractMrlRows(rows) {
  const hi = rows.findIndex(isHeader);
  if (hi < 0) return [];
  const head = rows[hi];
  const cols = {
    iEn: headingIndex(head, "國際普通名稱"),
    iZh: headingIndex(head, "普通名稱"),
    iCrop: headingIndex(head, "作物類別", "作物"),
    iPpm: headingIndex(head, "容許量"),
    iNote: headingIndex(head, "備註"),
  };
  const list = [];
  let prev = { nameEn: "", nameZh: "", note: "" };
  for (const row of rows.slice(hi + 1)) {
    let nameEn = (row[cols.iEn] || "").trim();
    let nameZh = (row[cols.iZh] || "").trim();
    let note = cols.iNote >= 0 ? (row[cols.iNote] || "").trim() : "";
    const crop = (row[cols.iCrop] || "").trim();
    const ppmRaw = (row[cols.iPpm] || "").trim();
    if (nameZh === "普通名稱" || crop === "作物類別") continue;
    if (ppmRaw === "(ppm)" && !nameZh && !crop) continue;
    if (!nameEn && !nameZh) {
      nameEn = prev.nameEn;
      nameZh = prev.nameZh;
    }
    if (!note) note = prev.note;
    if (!crop) continue;
    if (!nameZh && !nameEn) continue;
    const rec = { nameEn, nameZh, crop, ppmRaw, note };
    list.push(rec);
    prev = rec;
  }
  return list;
}

export async function parseAnnexOdt(xmlPath) {
  const xml = await readFile(xmlPath, "utf8");
  const tables = [];
  const tableRe = /<table:table\b[\s\S]*?<\/table:table>/g;
  let tm;
  while ((tm = tableRe.exec(xml))) tables.push(parseTable(tm[0]));

  const annex1 = extractMrlRows(tables[0]?.rows ?? []);
  const annex2 = extractMrlRows(tables[1]?.rows ?? []);
  const annex5 = [];
  const t5 = tables[tables.length - 1];
  if (t5) {
    for (const row of t5.rows.slice(1)) {
      const cat = (row[0] || "").replace(/^\d+\.\s*/, "").trim();
      const products = (row[1] || "").trim();
      if (cat) annex5.push({ category: cat, products });
    }
  }
  return { tables, annex1, annex2, annex5 };
}
