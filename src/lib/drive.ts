export function parseDriveFileId(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (/\/folders\//.test(text)) return null;
  const fromPath = text.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fromPath) return fromPath[1];
  const fromQuery = text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fromQuery) return fromQuery[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(text)) return text;
  return null;
}

export function isDriveFolderLink(input: string): boolean {
  return /\/folders\/[a-zA-Z0-9_-]+/.test(input.trim());
}

async function fetchWithTimeout(url: string, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchDriveJson(fileId: string, apiKey: string): Promise<unknown> {
  const urls: string[] = [];
  if (apiKey.trim()) {
    const key = encodeURIComponent(apiKey.trim());
    urls.push(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${key}`,
    );
  }
  urls.push(
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
  );

  let lastError = "無法從雲端硬碟讀取檔案";
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        lastError = `雲端硬碟 HTTP ${res.status}`;
        continue;
      }
      const text = await res.text();
      if (text.trim().startsWith("<")) {
        lastError = "雲端硬碟回傳網頁而非 JSON，請改為「知道連結的任何人」並貼上 API 金鑰";
        continue;
      }
      return JSON.parse(text) as unknown;
    } catch (err) {
      lastError = err instanceof Error ? err.message : lastError;
    }
  }
  throw new Error(lastError);
}
