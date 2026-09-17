import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractOrderNo } from "./amendment-id.mjs";
import { parseAnnexOdt } from "./parse-annex-odt.mjs";

export async function findOfficialOdtFiles(dir) {
  try {
    const names = await readdir(dir);
    return names
      .filter((n) => n.toLowerCase().endsWith(".odt"))
      .map((n) => ({
        name: n,
        path: join(dir, n),
        orderNo: extractOrderNo(n),
      }))
      .sort((a, b) => Number(b.orderNo || 0) - Number(a.orderNo || 0));
  } catch {
    return [];
  }
}

function unzipOdt(odtPath, tmp) {
  try {
    execFileSync("unzip", ["-o", "-q", odtPath, "-d", tmp], { stdio: "pipe" });
  } catch {
    execFileSync("tar", ["-xf", odtPath, "-C", tmp], { stdio: "pipe" });
  }
}

export async function loadLatestOfficialAnnex(officialDir) {
  const files = await findOfficialOdtFiles(officialDir);
  if (!files.length) return null;
  const latest = files[0];
  const tmp = await mkdtemp(join(tmpdir(), "mrl-odt-"));
  try {
    unzipOdt(latest.path, tmp);
    const xmlPath = join(tmp, "content.xml");
    const xmlHead = (await readFile(xmlPath, "utf8")).slice(0, 400000);
    const fromXml = extractOrderNo(xmlHead);
    const parsed = await parseAnnexOdt(xmlPath);
    return {
      file: latest,
      orderNo: latest.orderNo || fromXml,
      annex1: parsed.annex1,
      annex5: parsed.annex5,
    };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
