export function extractOrderNo(text) {
  const src = String(text ?? "");
  const fromLaw = [...src.matchAll(/衛授食字第\s*([\d\s]+)\s*號/g)].map((m) =>
    m[1].replace(/\s+/g, ""),
  );
  const fromFile = [...src.matchAll(/(\d{9,12})/g)].map((m) => m[1]);
  const all = [...fromLaw, ...fromFile.filter((n) => n.startsWith("11") || n.startsWith("10"))];
  if (!all.length) return "";
  return all.sort((a, b) => Number(b) - Number(a))[0];
}

export function cleanText(s) {
  return String(s ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

export function foldKey(s) {
  return cleanText(s).replace(/[‧·・]/g, ".").toLowerCase().replace(/\s+/g, "");
}

export function looksBroken(s) {
  const t = String(s ?? "");
  return !t.trim() || t.includes("?") || t.includes("\uFFFD");
}

export function ppmKey(s) {
  const t = String(s ?? "").trim();
  const star = t.includes("*") ? "*" : "";
  const n = Number(t.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return foldKey(t);
  return `${n}${star}`;
}

export function cropWildcardRe(fdaCrop) {
  const t = cleanText(fdaCrop);
  if (!t.includes("?")) return null;
  const escaped = [...t]
    .map((ch) => {
      if (ch === "?") return ".";
      return /[.*+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
    })
    .join("");
  return new RegExp(`^${escaped}$`);
}
