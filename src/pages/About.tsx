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

export function About({ data }: { data: MrlDataset | null }) {
  return (
    <main className="about">
      <h2>這是什麼</h2>
      <p>
        手機／電腦上的查詢 App：依藥劑、依作物，或交叉查出台灣《農藥殘留容許量標準》附表一的容許量（ppm）。
      </p>
      <h2>加到主畫面</h2>
      <p>
        iPhone：Safari → 分享 → 加入主畫面。Android：Chrome → 安裝應用程式。第一次請連網載入。
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
            <li>匯入時間：{formatDate(data.fetchedAt)}</li>
            <li>筆數：{data.count.toLocaleString()}</li>
          </ul>
        </>
      )}
    </main>
  );
}
