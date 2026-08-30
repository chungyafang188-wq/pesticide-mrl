import { CROP_CHIPS } from "../lib/categories";
import type { DataOrigin, MrlDataset, MrlRecord, QueryMode } from "../types";

const ORIGIN_LABEL: Record<DataOrigin, string> = {
  drive: "已下載",
  bundled: "已下載",
  cache: "離線快取",
};

type Props = {
  status: "loading" | "ready" | "error";
  error: string;
  origin: DataOrigin;
  data: MrlDataset | null;
  queryMode: QueryMode;
  pesticide: string;
  crop: string;
  recent: string[];
  results: MrlRecord[];
  matchCount: number;
  showEmptyHint: boolean;
  pdfBusy: boolean;
  pdfError: string;
  onQueryModeChange: (mode: QueryMode) => void;
  onPesticideChange: (value: string) => void;
  onCropChange: (value: string) => void;
  onRemember: (value: string) => void;
  onRecent: (value: string) => void;
  onRemoveRecent: (value: string) => void;
  onSelect: (row: MrlRecord) => void;
  onExportPdf: () => void;
  onClear: () => void;
  onOpenAbout: () => void;
  formatDate: (iso: string) => string;
};

export function Home({
  status,
  error,
  origin,
  data,
  queryMode,
  pesticide,
  crop,
  recent,
  results,
  matchCount,
  showEmptyHint,
  pdfBusy,
  pdfError,
  onQueryModeChange,
  onPesticideChange,
  onCropChange,
  onRemember,
  onRecent,
  onRemoveRecent,
  onSelect,
  onExportPdf,
  onClear,
  onOpenAbout,
  formatDate,
}: Props) {
  const showPesticide = queryMode !== "crop";
  const showCrop = queryMode !== "pesticide";
  const searched = Boolean(
    (showPesticide && pesticide.trim()) || (showCrop && crop.trim()),
  );

  return (
    <main className="home">
      <p className="disclaimer">可依藥劑、作物或交叉查詢。非正式法規文本。</p>

      <div className="segment" role="tablist" aria-label="查詢方式">
        <button
          type="button"
          role="tab"
          aria-selected={queryMode === "pesticide"}
          className={queryMode === "pesticide" ? "seg on" : "seg"}
          onClick={() => onQueryModeChange("pesticide")}
        >
          依藥劑
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={queryMode === "crop"}
          className={queryMode === "crop" ? "seg on" : "seg"}
          onClick={() => onQueryModeChange("crop")}
        >
          依作物
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={queryMode === "both"}
          className={queryMode === "both" ? "seg on" : "seg"}
          onClick={() => onQueryModeChange("both")}
        >
          交叉查
        </button>
      </div>

      <div className="fields">
        {showPesticide && (
          <label className="search-label">
            藥劑
            <input
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="例如：賽滅寧"
              value={pesticide}
              onChange={(e) => onPesticideChange(e.target.value)}
              onBlur={() => onRemember(pesticide)}
            />
          </label>
        )}
        {showCrop && (
          <label className="search-label">
            作物類別
            <input
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="例如：蘋果、柑桔類、米類"
              value={crop}
              onChange={(e) => onCropChange(e.target.value)}
              onBlur={() => onRemember(crop)}
            />
          </label>
        )}
      </div>

      {searched && (
        <button type="button" className="clear-btn" onClick={onClear}>
          清除，查下一筆
        </button>
      )}

      {recent.length > 0 && (
        <div className="recent">
          <span>最近</span>
          {recent.map((item) => (
            <span key={item} className="recent-item">
              <button type="button" className="recent-q" onClick={() => onRecent(item)}>
                {item}
              </button>
              <button
                type="button"
                className="recent-del"
                aria-label={`刪除最近查詢 ${item}`}
                onClick={() => onRemoveRecent(item)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {showCrop && (
        <div className="chips" role="list">
          <button
            type="button"
            className={!crop.trim() ? "chip on" : "chip"}
            onClick={() => onCropChange("")}
          >
            作物不限
          </button>
          {CROP_CHIPS.map((name) => (
            <button
              key={name}
              type="button"
              className={crop.trim() === name ? "chip on" : "chip"}
              onClick={() => onCropChange(crop.trim() === name ? "" : name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {status === "loading" && <p className="status">載入資料中…</p>}
      {status === "error" && <p className="status error">{error}</p>}

      {status === "ready" && data && (
        <>
          <div className="meta-row">
            <p className="meta">
              {ORIGIN_LABEL[origin]} · {data.count.toLocaleString()} 筆
              {searched ? ` · 符合 ${matchCount.toLocaleString()}` : ""}
            </p>
            <button
              type="button"
              className="pdf-btn"
              disabled={!results.length || pdfBusy}
              onClick={onExportPdf}
            >
              {pdfBusy ? "匯出中…" : "下載 PDF"}
            </button>
          </div>
          {pdfError && <p className="status error">{pdfError}</p>}

          {showEmptyHint && (
            <div className="callout">
              <strong>查無對應列。</strong>
              {pesticide.trim() && crop.trim() && queryMode === "both"
                ? `此藥劑沒有適用「${crop.trim()}」的列（含所屬大類；名稱寫「${crop.trim()}除外」者不算）。`
                : "台灣採正面表列：未列於容許量表之農藥，原則上不得檢出。"}
            </div>
          )}

          {!searched && (
            <p className="hint">
              選上方方式後輸入關鍵字。加到主畫面後可離線使用，見
              <button type="button" className="linkish" onClick={onOpenAbout}>
                說明
              </button>
              。
            </p>
          )}

          <ul className="results">
            {results.map((row) => (
              <li key={row.id}>
                <button type="button" className="card" onClick={() => onSelect(row)}>
                  <div className="card-top">
                    <strong>{row.nameZh || row.nameEn}</strong>
                    <span className="ppm">
                      {row.ppmRaw}
                      <small> ppm</small>
                    </span>
                  </div>
                  <p className="crop">{row.crop}</p>
                  <p className="en">
                    {row.nameEn}
                    {row.note ? ` · ${row.note}` : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {results.length === 80 && matchCount > 80 && (
            <p className="hint">畫面上僅顯示前 80 筆。PDF 最多匯出 400 筆。</p>
          )}

          {searched && (
            <button type="button" className="clear-btn" onClick={onClear}>
              清除，查下一筆
            </button>
          )}
          {searched && (
            <p className="tiny">資料匯入 {formatDate(data.fetchedAt)}</p>
          )}
        </>
      )}
    </main>
  );
}
