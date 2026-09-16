import { LEGAL_NOTES } from "../lib/notes";
import type { MrlDataset } from "../types";

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

export function About({
  data,
  amendment,
}: {
  data: MrlDataset | null;
  amendment: string;
}) {
  return (
    <main className="about panel">
      <h2>這是什麼</h2>
      <p>
        手機／電腦上的查詢 App：依藥劑、依作物、交叉查，或查兩種作物共用藥。共用藥可只填兩個品項，或再填一支藥劑看該藥對兩者的容許量。未列者原則上不得檢出；這不是農藥標示使用範圍。
      </p>
      <h2>手機怎麼開</h2>
      <p>
        請用公開網址（電腦關機也可）：{" "}
        <a href="https://chungyafang188-wq.github.io/pesticide-mrl/">
          https://chungyafang188-wq.github.io/pesticide-mrl/
        </a>
        。不要開本機的 127.0.0.1 或區網 IP。
      </p>
      <h2>加到主畫面</h2>
      <p>
        iPhone：Safari → 分享 → 加入主畫面。Android：Chrome → 安裝應用程式。第一次請連網載入。
      </p>
      <h2>資料更新</h2>
      <p>
        GitHub 每月 1 日自動抓食藥署開放資料。倉庫裡若有官方中文附表 ODT，且其衛授食字號與開放資料／全國法規資料庫最新令號相同，才會用原文校正品名；令號不同就不會混用，以免舊令改正新表。查詢頁「更新法規資料」只重抓本站已核對過的表，不會直接套用未校正的開放資料。
      </p>
      <h2>正面表列</h2>
      <p>表上未列之農藥，原則上不得檢出。非正式法規文本，以食藥署最新公告為準。</p>
      <h2>資料來源註記</h2>
      {LEGAL_NOTES.map((note) => (
        <p key={note.title}>
          <strong>{note.title}：</strong>
          {note.text}
        </p>
      ))}
      {data && (
        <>
          <h2>目前資料</h2>
          <p>{data.sourceNote}</p>
          <ul>
            <li>法規修正：{amendment}</li>
            <li>匯入時間：{formatDate(data.fetchedAt)}</li>
            <li>筆數：{data.count.toLocaleString()}</li>
          </ul>
        </>
      )}
    </main>
  );
}
