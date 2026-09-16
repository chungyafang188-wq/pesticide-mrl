import html2canvas from "html2canvas";
import type { MrlDataset, MrlRecord } from "../types";

const MAX_ROWS = 40;

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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function canvasToPng(node: HTMLElement) {
  const canvas = await html2canvas(node, {
    backgroundColor: "#fffdf9",
    scale: Math.min(2, window.devicePixelRatio || 2),
    useCORS: true,
  });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("無法產生圖片"));
    }, "image/png");
  });
}

export async function shareResultsImage(opts: {
  dataset: MrlDataset;
  pesticide: string;
  crop: string;
  rows: MrlRecord[];
  total: number;
}): Promise<"shared" | "saved"> {
  const rows = opts.rows.slice(0, MAX_ROWS);
  const truncated = opts.total > rows.length;
  const title = fileStub(opts.pesticide, opts.crop);
  const filename = `${title}.png`;

  const node = document.createElement("div");
  node.setAttribute("data-share-card", "1");
  node.style.cssText =
    "position:fixed;left:-10000px;top:0;width:720px;padding:20px 22px 24px;background:#fffdf9;color:#163024;font:16px/1.45 system-ui,'Noto Sans TC','Microsoft JhengHei',sans-serif;";
  node.innerHTML = `
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.06em;color:#5d6f64;">法規來源 · 非正式文本</p>
    <h1 style="margin:0 0 8px;font-size:20px;color:#145234;">衛生福利部《農藥殘留容許量標準》附表一</h1>
    <p style="margin:0 0 4px;font-size:14px;">藥劑：${escapeHtml(opts.pesticide.trim() || "（未指定）")}　作物：${escapeHtml(opts.crop.trim() || "（未指定）")}</p>
    <p style="margin:0 0 4px;font-size:13px;color:#5d6f64;">法規修正：${escapeHtml(opts.dataset.amendmentNotice || "（未載入）")}</p>
    <p style="margin:0 0 12px;font-size:13px;color:#5d6f64;">本表 ${rows.length} 筆${truncated ? `（符合 ${opts.total} 筆，圖片僅前 ${MAX_ROWS} 筆）` : ""}。未列者原則上不得檢出。</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr>
          <th style="border-bottom:1px solid #d3ddd0;text-align:left;padding:6px 4px;">藥劑</th>
          <th style="border-bottom:1px solid #d3ddd0;text-align:left;padding:6px 4px;">作物類別</th>
          <th style="border-bottom:1px solid #d3ddd0;text-align:right;padding:6px 4px;">ppm</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
              <td style="border-bottom:1px solid #e8ece4;padding:6px 4px;">${escapeHtml(r.nameZh || r.nameEn)}<div style="color:#5d6f64;font-size:12px;">${escapeHtml(r.nameEn)}</div></td>
              <td style="border-bottom:1px solid #e8ece4;padding:6px 4px;">${escapeHtml(r.crop)}</td>
              <td style="border-bottom:1px solid #e8ece4;padding:6px 4px;text-align:right;font-weight:700;color:#1a6b42;white-space:nowrap;">${escapeHtml(r.ppmRaw)}</td>
            </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;
  document.body.appendChild(node);
  try {
    const blob = await canvasToPng(node);
    const file = new File([blob], filename, { type: "image/png" });
    const payload = {
      files: [file],
      title: "農藥殘留容許量",
      text: `${opts.pesticide.trim() || "查詢結果"} ${opts.crop.trim()}`.trim(),
    };
    const canFiles =
      typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    if (typeof navigator.share === "function" && canFiles) {
      try {
        await navigator.share(payload);
        return "shared";
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return "shared";
        throw err;
      }
    }
    downloadBlob(blob, filename);
    return "saved";
  } finally {
    node.remove();
  }
}
