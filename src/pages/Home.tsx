import { useMemo } from "react";
import { CROP_CHIPS } from "../lib/categories";
import { isSpecificCropName, listDetailCrops, parentGroupsFor } from "../lib/search";
import type { CommonUseHit, DataOrigin, MrlDataset, MrlRecord, QueryMode, UseTypeFilter } from "../types";

const USE_TYPE_OPTIONS: { id: UseTypeFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "insect", label: "蟲藥" },
  { id: "fungicide", label: "殺菌藥" },
  { id: "herbicide", label: "除草劑" },
];

const ORIGIN_LABEL: Record<DataOrigin, string> = {
  drive: "已下載",
  bundled: "已下載",
  cache: "離線快取",
  live: "食藥署最新",
};

type Props = {
  status: "loading" | "ready" | "error";
  error: string;
  origin: DataOrigin;
  data: MrlDataset | null;
  queryMode: QueryMode;
  pesticide: string;
  crop: string;
  crop2: string;
  useType: UseTypeFilter;
  recent: string[];
  results: MrlRecord[];
  commonHits: CommonUseHit[];
  matchCount: number;
  showEmptyHint: boolean;
  pdfBusy: boolean;
  pdfError: string;
  refreshBusy: boolean;
  refreshMessage: string;
  onQueryModeChange: (mode: QueryMode) => void;
  onPesticideChange: (value: string) => void;
  onCropChange: (value: string) => void;
  onCrop2Change: (value: string) => void;
  onUseTypeChange: (value: UseTypeFilter) => void;
  onRemember: (value: string) => void;
  onRecent: (value: string) => void;
  onRemoveRecent: (value: string) => void;
  onSelect: (row: MrlRecord) => void;
  onExportPdf: () => void;
  onRefresh: () => void;
  onClear: () => void;
  onOpenAbout: () => void;
  formatDate: (iso: string) => string;
};

function PairSide({
  query,
  row,
  onSelect,
}: {
  query: string;
  row: MrlRecord | null;
  onSelect: (row: MrlRecord) => void;
}) {
  if (!row) {
    return (
      <div className="pair-btn missing">
        <span>{query}</span>
        <span className="ppm missing-ppm">未列</span>
      </div>
    );
  }
  return (
    <button type="button" className="pair-btn" onClick={() => onSelect(row)}>
      <span>
        {query}
        {row.crop !== query ? <small className="listed-as"> · {row.crop}</small> : null}
      </span>
      <span className="ppm">
        {row.ppmRaw}
        <small> ppm</small>
      </span>
    </button>
  );
}

function CropSlot({
  heading,
  crop,
  records,
  allDetailCrops,
  listId,
  placeholder,
  onChange,
  onRemember,
}: {
  heading?: string;
  crop: string;
  records: MrlRecord[] | undefined;
  allDetailCrops: string[];
  listId: string;
  placeholder: string;
  onChange: (value: string) => void;
  onRemember: (value: string) => void;
}) {
  const categoryChip = CROP_CHIPS.includes(crop.trim())
    ? crop.trim()
    : records && isSpecificCropName(crop)
      ? (parentGroupsFor(records, crop.trim())[0] ?? "")
      : "";
  const detailCrops = records ? listDetailCrops(records, categoryChip) : [];
  const detailValue = isSpecificCropName(crop) ? crop : "";
  const cropNameValue = CROP_CHIPS.includes(crop.trim()) ? "" : crop;

  return (
    <div className="fields">
      {heading ? <p className="slot-heading">{heading}</p> : null}
      <label className="search-label">
        細節作物
        <select
          value={detailCrops.includes(detailValue) ? detailValue : ""}
          onChange={(e) => {
            const next = e.target.value;
            if (!next) {
              onChange(categoryChip);
              return;
            }
            onChange(next);
            onRemember(next);
          }}
        >
          <option value="">
            {categoryChip ? `請選擇「${categoryChip}」品名` : "請選擇作物品名"}
          </option>
          {detailCrops.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="search-label">
        作物品名
        <input
          type="search"
          list={listId}
          enterKeyHint="search"
          autoComplete="off"
          placeholder={placeholder}
          value={cropNameValue}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onRemember(crop)}
        />
        <datalist id={listId}>
          {allDetailCrops.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
    </div>
  );
}

export function Home({
  status,
  error,
  origin,
  data,
  queryMode,
  pesticide,
  crop,
  crop2,
  useType,
  recent,
  results,
  commonHits,
  matchCount,
  showEmptyHint,
  pdfBusy,
  pdfError,
  refreshBusy,
  refreshMessage,
  onQueryModeChange,
  onPesticideChange,
  onCropChange,
  onCrop2Change,
  onUseTypeChange,
  onRemember,
  onRecent,
  onRemoveRecent,
  onSelect,
  onExportPdf,
  onRefresh,
  onClear,
  onOpenAbout,
  formatDate,
}: Props) {
  const showPesticide = queryMode !== "crop";
  const showCrop = queryMode !== "pesticide";
  const isCommon = queryMode === "common";
  const searched = isCommon
    ? Boolean(crop.trim() && crop2.trim())
    : Boolean((showPesticide && pesticide.trim()) || (showCrop && crop.trim()));

  const categoryChip = CROP_CHIPS.includes(crop.trim())
    ? crop.trim()
    : data && isSpecificCropName(crop)
      ? (parentGroupsFor(data.records, crop.trim())[0] ?? "")
      : "";
  const allDetailCrops = useMemo(() => {
    if (!data) return [];
    return listDetailCrops(data.records, "");
  }, [data]);

  const listed = isCommon ? commonHits.length : results.length;

  return (
    <main className="home">
      <section className="panel">
      <p className="disclaimer">可依藥劑、作物、交叉或兩作物共用藥查詢。非正式法規文本。</p>

      <div className="refresh-bar">
        <button
          type="button"
          className="refresh-btn"
          disabled={refreshBusy}
          onClick={onRefresh}
        >
          {refreshBusy ? "更新中…" : "更新法規資料"}
        </button>
        {refreshMessage ? <p className="hint">{refreshMessage}</p> : null}
      </div>

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
        <button
          type="button"
          role="tab"
          aria-selected={isCommon}
          className={isCommon ? "seg on" : "seg"}
          onClick={() => onQueryModeChange("common")}
        >
          共用藥
        </button>
      </div>

      {showPesticide && (
        <div className="fields">
          <label className="search-label">
            藥劑
            <input
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder={isCommon ? "選填，例如：賽滅寧" : "例如：賽滅寧"}
              value={pesticide}
              onChange={(e) => onPesticideChange(e.target.value)}
              onBlur={() => onRemember(pesticide)}
            />
          </label>
        </div>
      )}

      {isCommon && (
        <div className="fields">
          <label className="search-label">
            品項一
            <input
              type="search"
              list="crop-name-list-a"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="例如：結球萵苣"
              value={crop}
              onChange={(e) => onCropChange(e.target.value)}
              onBlur={() => onRemember(crop)}
            />
          </label>
          <label className="search-label">
            品項二
            <input
              type="search"
              list="crop-name-list-b"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="例如：蘋果"
              value={crop2}
              onChange={(e) => onCrop2Change(e.target.value)}
              onBlur={() => onRemember(crop2)}
            />
          </label>
          <datalist id="crop-name-list-a">
            {allDetailCrops.map((name) => (
              <option key={`a-${name}`} value={name} />
            ))}
          </datalist>
          <datalist id="crop-name-list-b">
            {allDetailCrops.map((name) => (
              <option key={`b-${name}`} value={name} />
            ))}
          </datalist>
        </div>
      )}

      {showCrop && !isCommon && (
        <>
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
                className={
                  crop.trim() === name || categoryChip === name ? "chip on" : "chip"
                }
                onClick={() => onCropChange(crop.trim() === name ? "" : name)}
              >
                {name}
              </button>
            ))}
          </div>
          <CropSlot
            crop={crop}
            records={data?.records}
            allDetailCrops={allDetailCrops}
            listId="crop-name-list"
            placeholder="單獨輸入即可查藥劑，例如：結球萵苣"
            onChange={onCropChange}
            onRemember={onRemember}
          />
        </>
      )}

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
      </section>

      {status === "loading" && <p className="status">載入資料中…</p>}
      {status === "error" && <p className="status error">{error}</p>}

      {status === "ready" && data && (
        <section className="results-block">
          <div className="meta-row">
            <p className="meta">
              {ORIGIN_LABEL[origin]} · {data.count.toLocaleString()} 筆
              {searched
                ? isCommon
                  ? pesticide.trim()
                    ? " · 此藥對兩品項"
                    : ` · 兩者皆可 ${matchCount.toLocaleString()} 種`
                  : ` · 符合 ${matchCount.toLocaleString()}`
                : ""}
            </p>
            <button
              type="button"
              className="pdf-btn"
              disabled={!listed || pdfBusy}
              onClick={onExportPdf}
            >
              {pdfBusy ? "匯出中…" : "下載 PDF"}
            </button>
          </div>
          {pdfError && <p className="status error">{pdfError}</p>}

          {queryMode === "crop" && searched && (
            <div className="chips result-filters" role="group" aria-label="藥劑用途">
              {USE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={useType === opt.id ? "chip on" : "chip"}
                  onClick={() => onUseTypeChange(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {showEmptyHint && (
            <div className="callout">
              <strong>查無對應列。</strong>
              {isCommon
                ? pesticide.trim()
                  ? `此藥劑對「${crop.trim()}」或「${crop2.trim()}」沒有容許量列（含所屬大類；寫「除外」者不計）。未列者原則上不得檢出。`
                  : `「${crop.trim()}」與「${crop2.trim()}」沒有共同列出的藥劑（含所屬大類；寫「除外」者不計）。`
                : queryMode === "crop" && useType !== "all"
                  ? `此作物沒有備註為「${USE_TYPE_OPTIONS.find((o) => o.id === useType)?.label}」的列。可改選全部。`
                  : pesticide.trim() && crop.trim() && queryMode === "both"
                  ? `此藥劑沒有適用「${crop.trim()}」的列（含所屬大類；名稱寫「${crop.trim()}除外」者不算）。`
                  : "台灣採正面表列：未列於容許量表之農藥，原則上不得檢出。"}
            </div>
          )}

          {!searched && (
            <p className="hint">
              {isCommon
                ? "輸入兩個品項可列出共用藥；再填藥劑可只看該藥對兩者的容許量。見"
                : "可點作物類別，或只輸入作物品名查藥劑。加到主畫面後可離線使用，見"}
              <button type="button" className="linkish" onClick={onOpenAbout}>
                說明
              </button>
              。
            </p>
          )}

          {isCommon && searched && commonHits.length > 0 && (
            <p className="hint">
              {pesticide.trim()
                ? `此藥劑對「${crop.trim()}」與「${crop2.trim()}」的容許量如下。未列者原則上不得檢出。`
                : `以下藥劑在「${crop.trim()}」與「${crop2.trim()}」皆有容許量。`}
            </p>
          )}

          {isCommon ? (
            <ul className="results">
              {commonHits.map((hit) => (
                <li key={hit.key}>
                  <div className="card">
                    <div className="card-top">
                      <strong>{hit.nameZh || hit.nameEn}</strong>
                    </div>
                    <p className="en">{hit.nameEn}</p>
                    <div className="common-pair">
                      <PairSide
                        query={crop.trim()}
                        row={hit.rowA}
                        onSelect={onSelect}
                      />
                      <PairSide
                        query={crop2.trim()}
                        row={hit.rowB}
                        onSelect={onSelect}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
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
          )}

          {listed === 80 && matchCount > 80 && (
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
        </section>
      )}
    </main>
  );
}
