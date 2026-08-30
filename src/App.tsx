import { useEffect, useMemo, useState } from "react";
import { loadDataset, refreshDataset } from "./lib/db";
import { parseDriveFileId } from "./lib/drive";
import { downloadResultsPdf } from "./lib/exportPdf";
import { loadRecent, pushRecent, removeRecent } from "./lib/recent";
import { loadDriveSettings } from "./lib/settings";
import { countMatches, createSearcher, searchRecords } from "./lib/search";
import { About } from "./pages/About";
import { Home } from "./pages/Home";
import type { DataOrigin, MrlDataset, MrlRecord, QueryMode } from "./types";

type Page = "home" | "about";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("zh-Hant-TW", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function App() {
  const [page, setPage] = useState<Page>("home");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState<DataOrigin>("bundled");
  const [data, setData] = useState<MrlDataset | null>(null);
  const [queryMode, setQueryMode] = useState<QueryMode>("both");
  const [pesticide, setPesticide] = useState("");
  const [crop, setCrop] = useState("");
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const [selected, setSelected] = useState<MrlRecord | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadDataset()
      .then((result) => {
        if (cancelled) return;
        setData(result.data);
        setOrigin(result.origin);
        setStatus("ready");
        const settings = loadDriveSettings();
        if (result.origin === "cache" && parseDriveFileId(settings.shareUrl) && navigator.onLine) {
          void refreshDataset()
            .then((fresh) => {
              if (cancelled) return;
              setData(fresh.data);
              setOrigin(fresh.origin);
            })
            .catch(() => {
              /* 離線或雲端失敗時沿用快取 */
            });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "無法載入資料");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fuse = useMemo(() => {
    if (!data) return null;
    return createSearcher(data.records);
  }, [data]);

  const activePesticide = queryMode === "crop" ? "" : pesticide;
  const activeCrop = queryMode === "pesticide" ? "" : crop;

  const results = useMemo(() => {
    if (!data) return [];
    return searchRecords(data.records, fuse, activePesticide, activeCrop);
  }, [data, fuse, activePesticide, activeCrop]);

  const matchCount = useMemo(() => {
    if (!data) return 0;
    return countMatches(data.records, fuse, activePesticide, activeCrop);
  }, [data, fuse, activePesticide, activeCrop]);

  const showEmptyHint =
    status === "ready" &&
    Boolean(activePesticide.trim() || activeCrop.trim()) &&
    results.length === 0;

  function remember(value: string) {
    const next = value.trim();
    if (next) setRecent(pushRecent(next));
  }

  function applyRecent(item: string) {
    const isCrop =
      data?.crops.includes(item) ||
      item.endsWith("類") ||
      item.includes("香辛") ||
      item.includes("植物");
    if (isCrop) setCrop(item);
    else setPesticide(item);
    setRecent(pushRecent(item));
  }

  async function exportPdf() {
    if (!data || !results.length) return;
    setPdfBusy(true);
    setPdfError("");
    try {
      const all = searchRecords(data.records, fuse, activePesticide, activeCrop, 400);
      downloadResultsPdf({
        dataset: data,
        pesticide: activePesticide,
        crop: activeCrop,
        rows: all,
        total: matchCount,
      });
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "PDF 匯出失敗");
    } finally {
      setPdfBusy(false);
    }
  }

  function clearQuery() {
    setPesticide("");
    setCrop("");
    setSelected(null);
    setPdfError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="app">
      <header className="top">
        <p className="eyebrow">台灣 · 衛福部食藥署</p>
        <h1>農藥殘留容許量</h1>
      </header>

      {page === "about" ? (
        <About data={data} />
      ) : (
        <Home
          status={status}
          error={error}
          origin={origin}
          data={data}
          queryMode={queryMode}
          pesticide={pesticide}
          crop={crop}
          recent={recent}
          results={results}
          matchCount={matchCount}
          showEmptyHint={showEmptyHint}
          pdfBusy={pdfBusy}
          pdfError={pdfError}
          onQueryModeChange={setQueryMode}
          onPesticideChange={setPesticide}
          onCropChange={setCrop}
          onRemember={remember}
          onRecent={applyRecent}
          onRemoveRecent={(item) => setRecent(removeRecent(item))}
          onSelect={setSelected}
          onExportPdf={() => void exportPdf()}
          onClear={clearQuery}
          onOpenAbout={() => setPage("about")}
          formatDate={formatDate}
        />
      )}

      {selected && (
        <dialog className="sheet" open onClick={() => setSelected(null)}>
          <article onClick={(e) => e.stopPropagation()}>
            <h2>{selected.nameZh || selected.nameEn}</h2>
            <p className="en">{selected.nameEn}</p>
            <dl>
              <div>
                <dt>作物類別</dt>
                <dd>{selected.crop}</dd>
              </div>
              <div>
                <dt>容許量</dt>
                <dd>
                  {selected.ppmRaw} ppm
                  {selected.ppmRaw.includes("*") && (
                    <span className="note">
                      「*」與檢驗定量極限有關，不是可用藥作物清單。
                    </span>
                  )}
                </dd>
              </div>
              {selected.note && (
                <div>
                  <dt>備註</dt>
                  <dd>{selected.note}</dd>
                </div>
              )}
            </dl>
            <p className="tiny">
              查詢使用已下載資料。官方原文網站可能需台灣／海外網路。
            </p>
            {data && (
              <a href={data.officialLookup} target="_blank" rel="noreferrer">
                食藥署消費者查詢頁
              </a>
            )}
            <button type="button" className="close" onClick={() => setSelected(null)}>
              關閉
            </button>
          </article>
        </dialog>
      )}

      <nav className="tabbar" aria-label="主要選單">
        <button
          type="button"
          className={page === "home" ? "tab on" : "tab"}
          onClick={() => setPage("home")}
        >
          查詢
        </button>
        <button
          type="button"
          className={page === "about" ? "tab on" : "tab"}
          onClick={() => setPage("about")}
        >
          說明
        </button>
      </nav>
    </div>
  );
}

export default App;
