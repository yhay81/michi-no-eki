import { Hono } from "hono";
import type { Context } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";

type Bindings = { ASSETS: Fetcher; DB: D1Database };
type Variables = { requestId: string };
type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403,
  ) {
    super(message);
  }
}

const origin = "https://michi-no-eki.yhay81.com";
const official = "https://www.mlit.go.jp/road/Michi-no-Eki/list.html";
const release = "https://www.mlit.go.jp/report/press/road01_hh_002029.html";
const terms = "https://www.mlit.go.jp/link.html";
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const eventNames = new Set([
  "visited",
  "searched",
  "no_result",
  "prefecture_changed",
  "period_changed",
  "saved",
  "copied",
  "official_opened",
]);

const nowSeconds = () => Math.floor(Date.now() / 1000);
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const sameOrigin = (c: AppContext) => {
  const site = c.req.header("sec-fetch-site");
  if (site && site !== "same-origin") throw new ApiError("cross_site_request", 403);
  const requestOrigin = c.req.header("origin");
  if (requestOrigin && requestOrigin !== new URL(c.req.url).origin)
    throw new ApiError("cross_site_request", 403);
};
const parseJson = async (c: AppContext) => {
  const contentLength = Number(c.req.header("content-length") ?? "0");
  if (contentLength > 512) throw new ApiError("invalid_payload", 400);
  try {
    return await c.req.json<unknown>();
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};
const record = async (c: AppContext, name: string) => {
  const session = (c.req.header("x-michi-no-eki-session") ?? "").toLowerCase();
  if (!sessionPattern.test(session)) return;
  await c.env.DB.prepare(
    "INSERT INTO product_events (session_hash,event_name,is_qa,created_at) VALUES (?,?,?,?)",
  )
    .bind(
      await sha256(session),
      name,
      c.req.header("x-michi-no-eki-qa") === "1" ? 1 : 0,
      nowSeconds(),
    )
    .run();
};

const nav = [
  { href: "/", label: "探す" },
  { href: "/guide", label: "使い方" },
  { href: "/source", label: "出典" },
  { href: "/privacy", label: "保存" },
];

const Layout = ({
  canonical,
  children,
  description,
  noindex = false,
  title,
}: {
  canonical: string;
  children: unknown;
  description: string;
  noindex?: boolean;
  title: string;
}) => (
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <title>{title}</title>
      <meta content={description} name="description" />
      {noindex ? <meta content="noindex" name="robots" /> : null}
      <link href={canonical} rel="canonical" />
      <meta content="website" property="og:type" />
      <meta content="ja_JP" property="og:locale" />
      <meta content={title} property="og:title" />
      <meta content={description} property="og:description" />
      <meta content={canonical} property="og:url" />
      <meta content={`${origin}/og.svg`} property="og:image" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content="#275845" name="theme-color" />
      <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      <link href="/manifest.webmanifest" rel="manifest" />
      <link href="/styles.css" rel="stylesheet" />
    </head>
    <body>
      <header class="site-header">
        <a aria-label="道の駅さがし ホーム" class="brand" href="/">
          <span aria-hidden="true" class="brand-mark">
            <span>道</span>
          </span>
          <span>道の駅さがし</span>
        </a>
        <nav aria-label="主なページ">
          {nav.map((item) => (
            <a href={item.href}>{item.label}</a>
          ))}
        </nav>
      </header>
      {children}
      <footer>
        <div>
          <strong>道の駅さがし</strong>
          <p>国土交通省「道の駅」登録一覧を加工して作成</p>
        </div>
        <div class="footer-links">
          <a href="/source">出典と注意</a>
          <a href="/privacy">保存と計測</a>
          <a href="https://github.com/yhay81/michi-no-eki">ソースコード</a>
        </div>
      </footer>
    </body>
  </html>
);

const RoadScene = () => (
  <div aria-hidden="true" class="road-scene">
    <span class="sun" />
    <span class="hill hill-one" />
    <span class="hill hill-two" />
    <span class="road">
      <i />
      <i />
      <i />
      <i />
    </span>
    <span class="sign sign-main">
      <b>道の駅</b>
      <small>1,231</small>
    </span>
    <span class="sign sign-a">北海道 128</span>
    <span class="sign sign-b">岐阜 55</span>
    <span class="sign sign-c">長野 54</span>
  </div>
);

const HomePage = () => (
  <Layout
    canonical={`${origin}/`}
    description="全国1,231の道の駅を駅名・所在地・都道府県から探し、登録年月を確かめ、最大6駅の停車札を端末内にまとめられます。"
    title="全国1,231の道の駅を探す | 道の駅さがし"
  >
    <main>
      <section class="hero-shell">
        <div class="hero-copy">
          <p class="eyebrow">47都道府県 · 2025年12月19日現在</p>
          <h1>
            行き先を探す。
            <br />
            旅の停車札を並べる。
          </h1>
          <p class="lead">
            駅名や自治体から全国の登録駅を探し、登録された時期と公式案内をひと目で確認。
            気になる6駅を、次の旅の停車札にまとめます。
          </p>
          <div class="hero-facts" aria-label="収録内容">
            <span>
              <b>1,231</b> 登録駅
            </span>
            <span>
              <b>64</b> 登録回
            </span>
            <span>
              <b>1993–2025</b>
            </span>
          </div>
        </div>
        <RoadScene />
      </section>

      <section aria-labelledby="search-title" class="finder">
        <div class="section-heading">
          <div>
            <p class="eyebrow">ROUTE FINDER</p>
            <h2 id="search-title">道の駅を探す</h2>
          </div>
          <p id="data-status" role="status">
            公式一覧を読み込んでいます
          </p>
        </div>
        <div class="controls">
          <label class="search-field">
            <span>駅名・所在地</span>
            <input
              autocomplete="off"
              id="search"
              placeholder="例：ふらの、藤枝市、石川"
              type="search"
            />
          </label>
          <label>
            <span>都道府県</span>
            <select id="prefecture">
              <option value="all">全国</option>
            </select>
          </label>
          <label>
            <span>登録年代</span>
            <select id="period">
              <option value="all">すべて</option>
              <option value="1990">1990年代</option>
              <option value="2000">2000年代</option>
              <option value="2010">2010年代</option>
              <option value="2020">2020年代</option>
            </select>
          </label>
          <label>
            <span>並び順</span>
            <select id="sort">
              <option value="source">公式一覧順</option>
              <option value="newest">新しい登録から</option>
              <option value="oldest">古い登録から</option>
              <option value="name">駅名順</option>
            </select>
          </label>
        </div>
        <div class="examples" aria-label="検索例">
          <span>ためす</span>
          <button data-example="三笠" type="button">
            三笠
          </button>
          <button data-example="ふらの" type="button">
            ふらの
          </button>
          <button data-example="藤枝市" type="button">
            藤枝市
          </button>
          <button data-latest="true" type="button">
            第64回の駅
          </button>
        </div>
      </section>

      <section aria-labelledby="saved-title" class="saved-route">
        <div class="saved-heading">
          <div>
            <p class="eyebrow">MY STOPS</p>
            <h2 id="saved-title">旅の停車札</h2>
          </div>
          <div class="saved-actions">
            <span id="saved-count">0 / 6</span>
            <button disabled id="copy-saved" type="button">
              まとめてコピー
            </button>
          </div>
        </div>
        <div class="empty-saved" id="saved-list">
          結果の「停車札に追加」から、気になる駅を並べられます。
        </div>
      </section>

      <section aria-labelledby="results-title" class="results-section">
        <div class="results-heading">
          <div>
            <p class="eyebrow">REGISTERED STATIONS</p>
            <h2 id="results-title">登録駅</h2>
          </div>
          <p>
            <b id="result-count">—</b> 駅
          </p>
        </div>
        <div class="station-grid" id="results" />
        <button class="load-more" hidden id="load-more" type="button">
          次の駅を見る
        </button>
      </section>

      <aside class="boundary">
        <span aria-hidden="true">i</span>
        <div>
          <strong>登録一覧でわかる範囲</strong>
          <p>
            収録するのは駅名、所在地、登録回、登録年月、一覧掲載の案内URLです。営業時間、休館日、設備、開業状況、現在地からの距離は、各駅の案内で出発前に確認してください。
          </p>
        </div>
      </aside>
    </main>
    <script defer src="/app.js" />
  </Layout>
);

const GuidePage = () => (
  <Layout
    canonical={`${origin}/guide`}
    description="道の駅の検索、登録時期、停車札、公式案内の見方を説明します。"
    title="探し方と停車札 | 道の駅さがし"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="eyebrow">GUIDE</p>
        <h1>旅の候補を、道沿いに並べる。</h1>
        <p>全国一覧を探すところから、現地情報を確認するところまで。</p>
      </div>
      <section class="guide-grid">
        <article>
          <span>01</span>
          <h2>駅名や自治体で探す</h2>
          <p>
            ひらがな、漢字、所在地の市町村名から絞れます。都道府県と登録年代も組み合わせられます。
          </p>
        </article>
        <article>
          <span>02</span>
          <h2>登録の時期を見る</h2>
          <p>
            登録回と登録年月は国土交通省の登録一覧に記載された値です。開業日や改装日ではありません。
          </p>
        </article>
        <article>
          <span>03</span>
          <h2>停車札をつくる</h2>
          <p>最大6駅をこの端末だけに保存し、駅名・所在地・登録年月を一度にコピーできます。</p>
        </article>
        <article>
          <span>04</span>
          <h2>出発前に公式案内へ</h2>
          <p>営業日、設備、道路状況は変わります。一覧に案内URLがある駅はカードから確認できます。</p>
        </article>
      </section>
      <section class="note-panel">
        <h2>「駅」は鉄道駅ではありません</h2>
        <p>
          ここでいう道の駅は、国土交通省へ登録された道路利用者向けの休憩・情報発信・地域連携施設です。鉄道駅、サービスエリア、一般の直売所を網羅する一覧ではありません。
        </p>
      </section>
    </main>
  </Layout>
);

const SourcePage = () => (
  <Layout
    canonical={`${origin}/source`}
    description="道の駅さがしが利用する国土交通省の登録一覧、加工内容、更新日、利用条件を示します。"
    title="出典とデータ | 道の駅さがし"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="eyebrow">SOURCE</p>
        <h1>1,231駅の根拠をたどる。</h1>
        <p>収録範囲、加工、わからないことを分けて示します。</p>
      </div>
      <section class="source-ledger">
        <div>
          <span>提供元</span>
          <strong>国土交通省 道路局</strong>
          <a href={official}>「道の駅」一覧を開く</a>
        </div>
        <div>
          <span>基準日</span>
          <strong>2025年12月19日</strong>
          <a href={release}>第64回登録の発表を開く</a>
        </div>
        <div>
          <span>収録</span>
          <strong>47都道府県・1,231駅</strong>
          <p>駅名、登録回、登録年月、所在地、一覧掲載の案内URL</p>
        </div>
        <div>
          <span>利用条件</span>
          <strong>公共データ利用規約 第1.0版</strong>
          <a href={terms}>国土交通省の利用条件を開く</a>
        </div>
      </section>
      <section class="prose-section">
        <h2>行った加工</h2>
        <ul>
          <li>全角英数字と空白を検索しやすい表記へ正規化しました。</li>
          <li>平成・令和表記の登録年月から西暦年と月を派生しました。</li>
          <li>都道府県別件数と1990〜2020年代の絞り込みを派生しました。</li>
          <li>複数URLを持つ宇津ノ谷峠は、二つの案内先を分けて表示します。</li>
          <li>出典：国土交通省「道の駅」登録一覧を加工して作成。</li>
        </ul>
      </section>
      <section class="prose-section">
        <h2>収録しないもの</h2>
        <p>
          住所番地、緯度経度、道路名、営業時間、休館日、設備、駐車台数、スタンプ、商品、開業・休業状況は公式XLSに含まれないため表示しません。16駅は一覧に案内URLがなく、一覧ページへの導線だけを示します。
        </p>
      </section>
    </main>
  </Layout>
);

const PrivacyPage = () => (
  <Layout
    canonical={`${origin}/privacy`}
    description="道の駅さがしの端末保存、匿名利用計測、保持期間、追跡拒否への対応を示します。"
    title="保存と計測 | 道の駅さがし"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="eyebrow">PRIVACY</p>
        <h1>検索はここで。停車札は端末に。</h1>
        <p>入力した行き先を、サーバーへ記録しません。</p>
      </div>
      <section class="privacy-grid">
        <article>
          <h2>端末に保存</h2>
          <p>
            停車札へ追加した公開駅IDを最大6件、ブラウザのlocalStorageへ保存します。検索語と絞り込みは保存しません。
          </p>
        </article>
        <article>
          <h2>匿名で計測</h2>
          <p>
            訪問、検索、0件、絞り込み変更、保存、コピー、公式案内を開いた操作名だけを計測します。検索語、駅ID、都道府県は送信しません。
          </p>
        </article>
        <article>
          <h2>35日で削除</h2>
          <p>
            ランダムなセッションIDをSHA-256で変換し、操作名、QA区分、時刻とともにD1へ保存します。原データは35日後に削除します。
          </p>
        </article>
        <article>
          <h2>追跡拒否を尊重</h2>
          <p>
            Do Not TrackまたはGlobal Privacy
            Controlが有効な場合、利用計測を送信しません。広告・外部解析・Cookieは使いません。
          </p>
        </article>
      </section>
    </main>
  </Layout>
);

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  );
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Request-Id", c.get("requestId"));
});
app.use(
  "*",
  jsxRenderer(({ children }) => <>{children}</>),
);
app.get("/", (c) => c.html(<HomePage />));
app.get("/guide", (c) => c.html(<GuidePage />));
app.get("/source", (c) => c.html(<SourcePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));
app.post("/api/telemetry", async (c) => {
  sameOrigin(c);
  const payload = await parseJson(c);
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new ApiError("invalid_payload", 400);
  const name =
    typeof (payload as Record<string, unknown>).name === "string"
      ? (payload as Record<string, string>).name
      : "";
  if (!eventNames.has(name)) throw new ApiError("invalid_event", 400);
  await record(c, name);
  return c.body(null, 202);
});
app.get("/health", async (c) => {
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({ asOf: "2025-12-19", ok: row?.ok === 1, service: "michi-no-eki", stations: 1231 });
});
app.get("/sitemap.xml", (c) => {
  const paths = ["/", "/guide", "/source", "/privacy"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
  c.header("Cache-Control", "public,max-age=300,s-maxage=300");
  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(xml);
});
app.notFound((c) => {
  c.status(404);
  return c.html(
    <Layout
      canonical={`${origin}/404`}
      description="指定されたページは見つかりません。"
      noindex
      title="ページが見つかりません | 道の駅さがし"
    >
      <main class="text-page">
        <div class="page-intro">
          <p class="eyebrow">404</p>
          <h1>この先は通行止めです。</h1>
          <p>
            <a href="/">道の駅を探す画面へ戻る</a>
          </p>
        </div>
      </main>
    </Layout>,
  );
});
app.onError((error, c) => {
  if (error instanceof ApiError)
    return c.json({ error: error.message, requestId: c.get("requestId") }, error.status);
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

export const scheduled = async (_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) => {
  await env.DB.prepare("DELETE FROM product_events WHERE created_at < ?")
    .bind(nowSeconds() - 35 * 86400)
    .run();
};

export default app;
