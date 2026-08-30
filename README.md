# 農藥殘留容許量查詢 App

以網頁 App（可加到手機主畫面）查詢台灣衛福部食藥署《農藥殘留容許量標準》附表一。可**依藥劑**、**依作物**、**交叉查**，或查兩作物**共用藥**的容許量（ppm）。資料內建，使用時不必連食藥署。不使用 LINE。

非正式法規文本。表上未列之農藥原則上不得檢出（正面表列）。

## 本機執行

```bash
npm install
npm run ingest
npm run dev
```

瀏覽器打開終端機顯示的網址。

**手機請不要開 `127.0.0.1`。** 手機與電腦要連同一 Wi‑Fi，用電腦的區網 IP，例如 `http://192.168.x.x:5173/`。終端機會印 `Network:` 那一行。若仍打不開，請允許 Windows 防火牆的 Node.js／5173 連接埠。

離開家裡網路或電腦關機時，這個本機網址會失效。請用 **GitHub Pages**：

https://chungyafang188-wq.github.io/pesticide-mrl/

中國大陸有時打不開 GitHub。第一次用外地網路打開後，可加到主畫面離線查。

網站每月 1 日會自動抓食藥署開放資料並重新發佈。手機連網再開一次才會換成新表。

## 加到主畫面

- iPhone：Safari → 分享 → 加入主畫面
- Android：Chrome → 安裝應用程式／加到主畫面

第一次連網載入後，離線仍可查。

## 資料來源

- https://data.gov.tw/dataset/8944
- https://data.fda.gov.tw/data/opendata/export/13/json
