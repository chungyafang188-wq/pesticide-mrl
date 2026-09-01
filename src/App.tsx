import { useEffect, useMemo, useState } from "react";
import { forceRefreshDataset, loadDataset, refreshDataset } from "./lib/db";
import { downloadResultsPdf } from "./lib/exportPdf";
import { loadRecent, pushRecent, removeRecent } from "./lib/recent";
import {
  countCommonUse,
  countMatches,
  createSearcher,
  searchCommonUse,
  searchRecords,
} from "./lib/search";
import { amendmentText } from "./lib/amendment";
import { About } from "./pages/About";
import { Home } from "./pages/Home";
import type { DataOrigin, MrlDataset, MrlRecord, QueryMode, UseTypeFilter } from "./types";

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
  const [crop2, setCrop2] = useState("");
  const [useType, setUseType] = useState<UseTypeFilter>("all");
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const [selected, setSelected] = useState<MrlRecord | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [amendment, setAmendment] = useState(amendmentText());
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/amendment.json`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<{ notice?: string }>;
      })
      .then((payload) => {
        if (!cancelled && payload.notice) setAmendment(payload.notice);
      })
      .catch(() => {
        /* 沿用畫面上的後備文字 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadDataset()
      .then((result) => {
        if (cancelled) return;
        const notice = amendmentText(result.data.amendmentNotice || amendment);
        setData({ ...result.data, amendmentNotice: notice });
        setAmendment(notice);
        setOrigin(result.origin);
        setStatus("ready");
        if (result.origin === "cache" && navigator.onLine) {
          void refreshDataset()
            .then((fresh) => {
              if (cancelled) return;
              setData({
                ...fresh.data,
                amendmentNotice: amendmentText(fresh.data.amendmentNotice),
              });
              setAmendment(amendmentText(fresh.data.amendmentNotice));
              setOrigin(fresh.origin);
            })
            .catch(() => {
              /* 離線或網站暫時失敗時沿用快取 */
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

  const isCommon = queryMode === "common";
  const activePesticide = queryMode === "crop" ? "" : pesticide;
  const activeCrop = queryMode === "pesticide" || isCommon ? "" : crop;

  const activeUseType = queryMode === "crop" ? useType : "all";

  const results = useMemo(() => {
    if (!data || isCommon) return [];
    return searchRecords(data.records, fuse, activePesticide, activeCrop, 80, activeUseType);
  }, [data, fuse, isCommon, activePesticide, activeCrop, activeUseType]);

  const commonHits = useMemo(() => {
    if (!data || !isCommon) return [];
    return searchCommonUse(data.records, fuse, pesticide, crop, crop2);
  }, [data, fuse, isCommon, pesticide, crop, crop2]);

  const matchCount = useMemo(() => {
    if (!data) return 0;
    if (isCommon) return countCommonUse(data.records, fuse, pesticide, crop, crop2);
    return countMatches(data.records, fuse, activePesticide, activeCrop, activeUseType);
  }, [data, fuse, isCommon, pesticide, activePesticide, activeCrop, activeUseType, crop, crop2]);

  const showEmptyHint =
    status === "ready" &&
    (isCommon
      ? Boolean(crop.trim() && crop2.trim()) && commonHits.length === 0
      : Boolean(activePesticide.trim() || activeCrop.trim()) && results.length === 0);

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
    if (isCrop) {
      if (queryMode === "common" && crop.trim()) setCrop2(item);
      else setCrop(item);
    } else setPesticide(item);
    setRecent(pushRecent(item));
  }

  async function exportPdf() {
    const hasRows = isCommon ? commonHits.length > 0 : results.length > 0;
    if (!data || !hasRows) return;
    setPdfBusy(true);
    setPdfError("");
    try {
      const all = isCommon
        ? searchCommonUse(data.records, fuse, pesticide, crop, crop2, 400).flatMap((hit) =>
            [hit.rowA, hit.rowB].filter((row): row is NonNullable<typeof row> => Boolean(row)),
          )
        : searchRecords(data.records, fuse, activePesticide, activeCrop, 400, activeUseType);
      downloadResultsPdf({
        dataset: data,
        pesticide: isCommon ? pesticide.trim() || "兩作物共用藥" : activePesticide,
        crop: isCommon ? `${crop.trim()}、${crop2.trim()}` : activeCrop,
        rows: all,
        total: isCommon ? all.length : matchCount,
      });
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "PDF 匯出失敗");
    } finally {
      setPdfBusy(false);
    }
  }

  function applyFresh(result: { data: MrlDataset; origin: DataOrigin }) {
    const notice = amendmentText(result.data.amendmentNotice);
    setData({ ...result.data, amendmentNotice: notice });
    setAmendment(notice);
    setOrigin(result.origin);
    setStatus("ready");
    setError("");
  }

  async function refreshNow() {
    if (refreshBusy) return;
    setRefreshBusy(true);
    setRefreshMessage("");
    try {
      const fresh = await forceRefreshDataset();
      applyFresh(fresh);
      const when = formatDate(fresh.data.fetchedAt);
      setRefreshMessage(
        fresh.origin === "live"
          ? `已從食藥署重抓，${fresh.data.count.toLocaleString()} 筆 · ${when}`
          : `已更新本站資料，${fresh.data.count.toLocaleString()} 筆 · ${when}`,
      );
    } catch (err) {
      setRefreshMessage(err instanceof Error ? err.message : "更新失敗，請連網再試");
    } finally {
      setRefreshBusy(false);
    }
  }

  function clearQuery() {
    setPesticide("");
    setCrop("");
    setCrop2("");
    setUseType("all");
    setSelected(null);
    setPdfError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    document.getElementById("law-amendment")?.setAttribute("hidden", "");
  }, []);

  return (
    <div className="app">
      <header className="top">
        <div className="brand-row">
          <p className="eyebrow">台灣 · 衛福部食藥署</p>
          <p className="amendment">{amendmentText(data?.amendmentNotice || amendment)}</p>
        </div>
        <h1>農藥殘留容許量</h1>
      </header>

      {page === "about" ? (
        <About data={data} amendment={amendmentText(data?.amendmentNotice || amendment)} />
      ) : (
        <Home
          status={status}
          error={error}
          origin={origin}
          data={data}
          queryMode={queryMode}
          pesticide={pesticide}
          crop={crop}
          crop2={crop2}
          useType={useType}
          recent={recent}
          results={results}
          commonHits={commonHits}
          matchCount={matchCount}
          showEmptyHint={showEmptyHint}
          pdfBusy={pdfBusy}
          pdfError={pdfError}
          refreshBusy={refreshBusy}
          refreshMessage={refreshMessage}
          onQueryModeChange={(mode) => {
            setQueryMode(mode);
            if (mode !== "crop") setUseType("all");
          }}
          onPesticideChange={setPesticide}
          onCropChange={setCrop}
          onCrop2Change={setCrop2}
          onUseTypeChange={setUseType}
          onRemember={remember}
          onRecent={applyRecent}
          onRemoveRecent={(item) => setRecent(removeRecent(item))}
          onSelect={setSelected}
          onExportPdf={() => void exportPdf()}
          onRefresh={() => void refreshNow()}
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
