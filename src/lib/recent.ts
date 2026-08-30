const KEY = "pesticide-mrl-recent";
const MAX = 8;

export function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecent(query: string): string[] {
  const q = query.trim();
  if (!q) return loadRecent();
  const next = [q, ...loadRecent().filter((x) => x !== q)].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function removeRecent(query: string): string[] {
  const next = loadRecent().filter((x) => x !== query);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
