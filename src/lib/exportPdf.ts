import type { MrlDataset, MrlRecord } from "../types";

const MAX_ROWS = 400;

function fileStub(pesticide: string, crop: string) {
  const parts = [pesticide.trim(), crop.trim()].filter(Boolean).join("-") || "查詢結果";
  return `農藥殘留容許量-${parts}`.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function downloadResultsPdf(opts: {
  dataset: MrlDataset;
  pesticide: string;
  crop: string;
  rows: MrlRecord[];
  total: number;
}) {
  const rows = opts.rows.slice(0, MAX_ROWS);
  const truncated = opts.total > rows.length;
  const title = fileStub(opts.pesticide, opts.crop);
  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, "Microsoft JhengHei", "PingFang TC", sans-serif; color: #111; margin: 16px; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { font-size: 12px; margin: 0 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
    td.num { text-align: right; }
    @page { size: A4; margin: 12mm; }
  </style>
</head>
<body>
  <p style="font-size:13px;margin:0 0 4px;letter-spacing:0.04em;">法規來源</p>
  <h1>衛生福利部《農藥殘留容許量標準》附表一</h1>
  <p>農藥殘留容許量查詢結果　藥劑：${escapeHtml(opts.pesticide.trim() || "（未指定）")}　作物類別：${escapeHtml(opts.crop.trim() || "（未指定）")}</p>
  <p>法規修正：${escapeHtml(opts.dataset.amendmentNotice || "（未載入）")}</p>
  <p>資料匯入：${escapeHtml(opts.dataset.fetchedAt)}　本表 ${rows.length} 筆${truncated ? `（符合 ${opts.total} 筆，僅匯出前 ${MAX_ROWS} 筆）` : ""}</p>
  <p>非正式法規文本。以衛福部食藥署最新公告為準。台灣採正面表列，未列之農藥原則上不得檢出。</p>
  <table>
    <thead>
      <tr>
        <th>藥劑</th>
        <th>國際名</th>
        <th>作物類別</th>
        <th>容許量 ppm</th>
        <th>備註</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (r) => `<tr>
            <td>${escapeHtml(r.nameZh)}</td>
            <td>${escapeHtml(r.nameEn)}</td>
            <td>${escapeHtml(r.crop)}</td>
            <td class="num">${escapeHtml(r.ppmRaw)}</td>
            <td>${escapeHtml(r.note)}</td>
          </tr>`,
        )
        .join("")}
    </tbody>
  </table>
  <script>
    window.addEventListener("load", () => {
      document.title = ${JSON.stringify(title)};
      window.focus();
      window.print();
    });
  </script>
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "pdf-export");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  iframe.srcdoc = html;
  document.body.appendChild(iframe);
  window.setTimeout(() => iframe.remove(), 60_000);
}
