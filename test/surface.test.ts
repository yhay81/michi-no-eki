import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import app from "../src/worker";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const worker = read("src/worker.tsx");
const client = read("public/app.js");
const css = read("public/styles.css");
const migration = read("migrations/0001_telemetry.sql");
const surface = `${worker}\n${client}`;
const bindings = {
  ASSETS: {} as Fetcher,
  DB: {
    prepare: () => ({
      bind: () => ({ run: async () => ({ success: true }) }),
      first: async () => ({ ok: 1 }),
    }),
  } as unknown as D1Database,
};

describe("product surface", () => {
  it("communicates through road signs, a roadway, station shields, and stop tickets", () => {
    expect(worker).toContain('class="road-scene"');
    expect(worker).toContain('class="road"');
    expect(worker).toContain('class="sign sign-main"');
    expect(client).toContain('class="round-shield"');
    expect(client).toContain('class="saved-ticket"');
    expect(css.toLowerCase()).not.toContain("gradient");
  });

  it("keeps searches and the six public station IDs in the browser", () => {
    expect(worker).toContain('app.post("/api/telemetry"');
    expect(worker).not.toContain('app.post("/api/search"');
    expect(client).toContain('fetch("/data/stations.json")');
    expect(client).toContain("localStorage");
    expect(client).toContain("MAX_SAVED = 6");
    expect(client).toContain("slice(0, MAX_SAVED)");
    expect(migration).not.toMatch(
      /station_(?:name|id)|query_(?:text|value)|search_term|prefecture_value|location_value|email|phone/iu,
    );
    expect(client).not.toMatch(/geolocation|getCurrentPosition|watchPosition/iu);
  });

  it("states the official-list boundary and links the source and terms", () => {
    expect(worker).toContain("営業時間、休館日、設備、開業状況");
    expect(worker).toContain("登録年月は国土交通省の登録一覧に記載された値");
    expect(worker).toContain("公共データ利用規約 第1.0版");
    expect(worker).toContain("https://www.mlit.go.jp/road/Michi-no-Eki/list.html");
    expect(worker).toContain("16駅は一覧に案内URLがなく");
  });

  it("renders four indexable pages with constrained typography and no meta copy", async () => {
    for (const path of ["/", "/guide", "/source", "/privacy"]) {
      const response = await app.request(
        `https://michi-no-eki.yhay81.com${path}`,
        undefined,
        bindings,
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<html lang="ja">');
    }
    expect(css).toContain("3.4rem");
    expect(surface).not.toMatch(
      /public validation|success criteria|experiment|仮説|成功条件|市場スコア|移行候補|収益性/iu,
    );
  });

  it("accepts only same-origin allowlisted telemetry", async () => {
    const session = "12345678-1234-4123-8123-123456789abc";
    const accepted = await app.request(
      "https://michi-no-eki.yhay81.com/api/telemetry",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://michi-no-eki.yhay81.com",
          "x-michi-no-eki-session": session,
          "x-michi-no-eki-qa": "1",
        },
        body: JSON.stringify({ name: "visited" }),
      },
      bindings,
    );
    const invalid = await app.request(
      "https://michi-no-eki.yhay81.com/api/telemetry",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "unknown" }),
      },
      bindings,
    );
    const foreign = await app.request(
      "https://michi-no-eki.yhay81.com/api/telemetry",
      {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://example.com" },
        body: JSON.stringify({ name: "visited" }),
      },
      bindings,
    );
    expect(accepted.status).toBe(202);
    expect(invalid.status).toBe(400);
    expect(foreign.status).toBe(403);
  });

  it("separates QA, honors privacy signals, and needs no account", () => {
    expect(client).toContain("navigator.webdriver");
    expect(client).toContain("navigator.doNotTrack");
    expect(client).toContain("globalPrivacyControl");
    expect(client).toContain('"x-michi-no-eki-qa"');
    expect(migration).toContain("is_qa");
    expect(surface).not.toMatch(/better-auth|betterAuth/iu);
  });
});
