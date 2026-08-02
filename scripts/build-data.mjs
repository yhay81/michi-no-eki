import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { read, utils } from "@e965/xlsx";

const DOWNLOAD = "https://www.mlit.go.jp/road/Michi-no-Eki/file/list.xls";
const SOURCE_PAGE = "https://www.mlit.go.jp/road/Michi-no-Eki/list.html";
const RELEASE = "https://www.mlit.go.jp/report/press/road01_hh_002029.html";
const TERMS = "https://www.mlit.go.jp/link.html";
const EXPECTED_BYTES = 2_532_352;
const EXPECTED_SHA256 = "7a34f2691634639caa201fdaf8a6f0bec9058e0c38cc68cfd9f9e67284171599";
const EXPECTED_ROWS = 1_231;

const response = await fetch(DOWNLOAD);
if (!response.ok) throw new Error(`Official workbook returned HTTP ${response.status}`);
const bytes = new Uint8Array(await response.arrayBuffer());
const sha256 = createHash("sha256").update(bytes).digest("hex");
if (bytes.byteLength !== EXPECTED_BYTES || sha256 !== EXPECTED_SHA256) {
  throw new Error(`Official workbook changed: ${bytes.byteLength} bytes, SHA-256 ${sha256}`);
}

const workbook = read(bytes, { type: "array" });
const sheetName = workbook.SheetNames[0];
if (!sheetName) throw new Error("Official workbook has no worksheets");
const rows = utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: false });
if (rows.length !== EXPECTED_ROWS)
  throw new Error(`Expected ${EXPECTED_ROWS} stations, found ${rows.length}`);

const clean = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
const registration = (value) => {
  const match = clean(value).match(/^([HR])(\d+)\.(\d+)$/u);
  if (!match) throw new Error(`Unknown registration date: ${value}`);
  const year = Number(match[2]) + (match[1] === "H" ? 1988 : 2018);
  return { month: Number(match[3]), year };
};
const idFor = (parts) =>
  createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 12);

const stations = rows.map((row) => {
  const prefecture = clean(row["県名"]);
  const name = clean(row["駅 名"]);
  const location = clean(row["所在地"]);
  const round = Number(clean(row["登録回"]).match(/\d+/u)?.[0]);
  const { month, year } = registration(row["登録年月"]);
  const urls = [
    ...new Set(String(row["ホームページアドレス"] ?? "").match(/https?:\/\/[^\s"]+/gu) ?? []),
  ];
  if (!prefecture || !name || !location || !Number.isInteger(round) || round < 1 || round > 64)
    throw new Error(`Invalid station row: ${JSON.stringify(row)}`);
  return {
    i: idFor([prefecture, name, location]),
    p: prefecture,
    n: name,
    r: round,
    y: year,
    m: month,
    l: location,
    u: urls,
  };
});

const prefectures = [...new Set(stations.map((station) => station.p))].map((name) => ({
  name,
  count: stations.filter((station) => station.p === name).length,
}));
const duplicateIds = stations.length - new Set(stations.map((station) => station.i)).size;
const duplicateNames =
  stations.length - new Set(stations.map((station) => `${station.p}\u0000${station.n}`)).size;
const missingOfficialLinks = stations.filter((station) => station.u.length === 0).length;
const multiOfficialLinks = stations.filter((station) => station.u.length > 1).length;
const first = stations.find((station) => station.p === "北海道" && station.n === "三笠");
const latestNames = stations
  .filter((station) => station.r === 64)
  .map((station) => station.n)
  .sort();
if (prefectures.length !== 47 || duplicateIds !== 0 || duplicateNames !== 0)
  throw new Error("Station identity or prefecture validation failed");
if (!first || first.y !== 1993 || first.m !== 4 || first.r !== 1)
  throw new Error("Known first-registration station did not match");
if (latestNames.join("|") !== ["ゆとりえせとや", "石川"].sort().join("|"))
  throw new Error(`Latest registration did not match: ${latestNames.join(", ")}`);

const index = {
  asOf: "2025-12-19",
  count: stations.length,
  prefectures,
  registrationYears: { first: 1993, latest: 2025 },
  rounds: 64,
  missingOfficialLinks,
  multiOfficialLinks,
  source: {
    title: "国土交通省「道の駅」登録一覧",
    sourcePage: SOURCE_PAGE,
    release: RELEASE,
    download: DOWNLOAD,
    terms: TERMS,
    retrievedAt: "2026-08-02",
    bytes: bytes.byteLength,
    sha256,
    license: "公共データ利用規約 第1.0版",
  },
};

const output = resolve(process.cwd(), "public", "data");
await mkdir(output, { recursive: true });
await writeFile(resolve(output, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
await writeFile(resolve(output, "stations.json"), `${JSON.stringify(stations)}\n`, "utf8");
console.log(
  `Built ${stations.length.toLocaleString("ja-JP")} stations across ${prefectures.length} prefectures (${sha256})`,
);
