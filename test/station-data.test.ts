import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Station = {
  i: string;
  p: string;
  n: string;
  r: number;
  y: number;
  m: number;
  l: string;
  u: string[];
};

const root = process.cwd();
const index = JSON.parse(readFileSync(resolve(root, "public/data/index.json"), "utf8"));
const stations = JSON.parse(
  readFileSync(resolve(root, "public/data/stations.json"), "utf8"),
) as Station[];
const find = (prefecture: string, name: string) =>
  stations.find((station) => station.p === prefecture && station.n === name);

describe("official road-station register", () => {
  it("retains verified source metadata and dimensions", () => {
    expect(index).toMatchObject({
      asOf: "2025-12-19",
      count: 1231,
      rounds: 64,
      registrationYears: { first: 1993, latest: 2025 },
      missingOfficialLinks: 16,
      multiOfficialLinks: 1,
    });
    expect(index.prefectures).toHaveLength(47);
    expect(index.source).toMatchObject({
      bytes: 2532352,
      license: "公共データ利用規約 第1.0版",
      sha256: "7a34f2691634639caa201fdaf8a6f0bec9058e0c38cc68cfd9f9e67284171599",
    });
  });

  it("contains 1,231 unique registered stations", () => {
    expect(stations).toHaveLength(1231);
    expect(new Set(stations.map((station) => station.i)).size).toBe(1231);
    expect(new Set(stations.map((station) => `${station.p}\u0000${station.n}`)).size).toBe(1231);
    expect(
      index.prefectures
        .map((prefecture: { count: number }) => prefecture.count)
        .reduce((sum: number, count: number) => sum + count, 0),
    ).toBe(1231);
  });

  it("retains known first and latest registration entries", () => {
    expect(find("北海道", "三笠")).toMatchObject({ r: 1, y: 1993, m: 4, l: "三笠市" });
    expect(find("福島県", "石川")).toMatchObject({ r: 64, y: 2025, m: 12, u: [] });
    expect(find("静岡県", "ゆとりえせとや")).toMatchObject({
      r: 64,
      y: 2025,
      m: 12,
      u: [],
    });
    expect(find("静岡県", "宇津ノ谷峠")?.u).toHaveLength(2);
  });

  it("keeps compact validated records within the delivery budget", () => {
    expect(statSync(resolve(root, "public/data/stations.json")).size).toBeLessThan(300000);
    for (const station of stations) {
      expect(Object.keys(station).sort()).toEqual(["i", "l", "m", "n", "p", "r", "u", "y"]);
      expect(station.i).toMatch(/^[0-9a-f]{12}$/u);
      expect(station.p).toMatch(/[都道府県]$/u);
      expect(station.n.length).toBeGreaterThan(0);
      expect(station.l.length).toBeGreaterThan(0);
      expect(station.r).toBeGreaterThanOrEqual(1);
      expect(station.r).toBeLessThanOrEqual(64);
      expect(station.y).toBeGreaterThanOrEqual(1993);
      expect(station.y).toBeLessThanOrEqual(2025);
      expect(station.m).toBeGreaterThanOrEqual(1);
      expect(station.m).toBeLessThanOrEqual(12);
      for (const url of station.u) expect(url).toMatch(/^https?:\/\//u);
    }
  });
});
