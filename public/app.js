const PAGE_SIZE = 24;
const MAX_SAVED = 6;
const STORAGE_KEY = "michi-no-eki:saved:v1";
const SESSION_KEY = "michi-no-eki:session:v1";
const OFFICIAL_LIST = "https://www.mlit.go.jp/road/Michi-no-Eki/list.html";

const byId = (id) => document.getElementById(id);
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\s　]+/gu, "");
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const formatDate = (station) => `${station.y}年${station.m}月`;

const qa = navigator.webdriver === true;
const privacyOptOut =
  navigator.doNotTrack === "1" ||
  /** @type {Navigator & {globalPrivacyControl?:boolean}} */ (navigator).globalPrivacyControl ===
    true;
let session = sessionStorage.getItem(SESSION_KEY);
if (!session && "randomUUID" in crypto) {
  session = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, session);
}
const emit = (name) => {
  if (privacyOptOut || !session) return;
  void fetch("/api/telemetry", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-michi-no-eki-session": session,
      "x-michi-no-eki-qa": qa ? "1" : "0",
    },
    body: JSON.stringify({ name }),
    keepalive: true,
  });
};

const readSaved = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string").slice(0, MAX_SAVED)
      : [];
  } catch {
    return [];
  }
};

const state = {
  stations: [],
  filtered: [],
  saved: readSaved(),
  visible: PAGE_SIZE,
};

let searchTimer;
const copyText = async (text, button) => {
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = "コピーしました";
    setTimeout(() => {
      button.textContent = original;
    }, 1400);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
};

const stationById = (id) => state.stations.find((station) => station.i === id);
const persistSaved = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved));

const officialLinks = (station) => {
  if (!station.u.length) {
    return `<a class="official-link muted-link" data-official href="${OFFICIAL_LIST}" rel="noopener noreferrer" target="_blank">公式一覧で確認</a>`;
  }
  return station.u
    .map(
      (url, index) =>
        `<a class="official-link" data-official href="${escapeHtml(url)}" rel="noopener noreferrer" target="_blank">${station.u.length > 1 ? `案内 ${index + 1}` : "案内を開く"}<span aria-hidden="true">↗</span></a>`,
    )
    .join("");
};

const stationCard = (station) => {
  const saved = state.saved.includes(station.i);
  return `<article class="station-card">
    <div class="station-roadline"><span></span><i></i><i></i><i></i></div>
    <div class="station-topline">
      <span class="prefecture-chip">${escapeHtml(station.p)}</span>
      <span class="round-shield">第${station.r}回</span>
    </div>
    <h3>${escapeHtml(station.n)}</h3>
    <p class="location"><span aria-hidden="true">⌖</span>${escapeHtml(station.l)}</p>
    <dl><div><dt>登録</dt><dd>${formatDate(station)}</dd></div><div><dt>経過</dt><dd>${2025 - station.y}年</dd></div></dl>
    <div class="card-actions">
      <button aria-pressed="${saved}" class="save-button${saved ? " is-saved" : ""}" data-save="${station.i}" type="button">${saved ? "停車札から外す" : "停車札に追加"}</button>
      <div class="official-links">${officialLinks(station)}</div>
    </div>
  </article>`;
};

const renderResults = () => {
  const rows = state.filtered.slice(0, state.visible);
  byId("result-count").textContent = state.filtered.length.toLocaleString("ja-JP");
  byId("results").innerHTML = rows.length
    ? rows.map(stationCard).join("")
    : `<div class="no-results"><span>0</span><h3>この標識では見つかりませんでした</h3><p>駅名を短くするか、都道府県・登録年代を広げてください。</p></div>`;
  const loadMore = byId("load-more");
  loadMore.hidden = state.visible >= state.filtered.length;
  if (!loadMore.hidden)
    loadMore.textContent = `次の${Math.min(PAGE_SIZE, state.filtered.length - state.visible)}駅を見る`;
};

const renderSaved = () => {
  const stations = state.saved.map(stationById).filter(Boolean);
  byId("saved-count").textContent = `${stations.length} / ${MAX_SAVED}`;
  const copyButton = byId("copy-saved");
  copyButton.disabled = stations.length === 0;
  byId("saved-list").className = stations.length ? "saved-list" : "empty-saved";
  byId("saved-list").innerHTML = stations.length
    ? stations
        .map(
          (station, index) => `<article class="saved-ticket">
            <span class="stop-number">${String(index + 1).padStart(2, "0")}</span>
            <div><strong>${escapeHtml(station.n)}</strong><small>${escapeHtml(station.p)} ${escapeHtml(station.l)} · ${formatDate(station)}登録</small></div>
            <button aria-label="${escapeHtml(station.n)}を停車札から外す" data-remove="${station.i}" type="button">×</button>
          </article>`,
        )
        .join("")
    : "結果の「停車札に追加」から、気になる駅を並べられます。";
};

const applyFilters = ({ report = false } = {}) => {
  const query = normalize(byId("search").value);
  const prefecture = byId("prefecture").value;
  const period = byId("period").value;
  const sort = byId("sort").value;
  state.filtered = state.stations.filter((station) => {
    const queryMatches = !query || station.q.includes(query);
    const prefectureMatches = prefecture === "all" || station.p === prefecture;
    const periodMatches = period === "all" || Math.floor(station.y / 10) * 10 === Number(period);
    return queryMatches && prefectureMatches && periodMatches;
  });
  if (sort === "newest")
    state.filtered.sort((a, b) => b.y - a.y || b.m - a.m || a.n.localeCompare(b.n, "ja"));
  if (sort === "oldest")
    state.filtered.sort((a, b) => a.y - b.y || a.m - b.m || a.n.localeCompare(b.n, "ja"));
  if (sort === "name") state.filtered.sort((a, b) => a.n.localeCompare(b.n, "ja"));
  state.visible = PAGE_SIZE;
  renderResults();
  if (report && (query || prefecture !== "all" || period !== "all")) {
    emit(state.filtered.length ? "searched" : "no_result");
  }
};

const toggleSaved = (id) => {
  const index = state.saved.indexOf(id);
  if (index >= 0) state.saved.splice(index, 1);
  else if (state.saved.length < MAX_SAVED) {
    state.saved.push(id);
    emit("saved");
  } else {
    const count = byId("saved-count");
    count.textContent = "6駅までです";
    setTimeout(renderSaved, 1200);
    return;
  }
  persistSaved();
  renderSaved();
  renderResults();
};

byId("search")?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => applyFilters({ report: true }), 420);
});
byId("prefecture")?.addEventListener("change", () => {
  emit("prefecture_changed");
  applyFilters({ report: true });
});
byId("period")?.addEventListener("change", () => {
  emit("period_changed");
  applyFilters({ report: true });
});
byId("sort")?.addEventListener("change", () => applyFilters());
byId("load-more")?.addEventListener("click", () => {
  state.visible += PAGE_SIZE;
  renderResults();
});
document.querySelectorAll("[data-example]").forEach((button) =>
  button.addEventListener("click", () => {
    byId("search").value = button.dataset.example ?? "";
    applyFilters({ report: true });
  }),
);
document.querySelector("[data-latest]")?.addEventListener("click", () => {
  byId("search").value = "第64回";
  applyFilters({ report: true });
});
byId("results")?.addEventListener("click", (event) => {
  const saveButton = event.target.closest("[data-save]");
  if (saveButton) toggleSaved(saveButton.dataset.save);
  if (event.target.closest("[data-official]")) emit("official_opened");
});
byId("saved-list")?.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) toggleSaved(removeButton.dataset.remove);
});
byId("copy-saved")?.addEventListener("click", (event) => {
  const stations = state.saved.map(stationById).filter(Boolean);
  const text = [
    "道の駅 旅の停車札（2025年12月19日現在）",
    ...stations.map(
      (station, index) =>
        `${index + 1}. ${station.n}｜${station.p} ${station.l}｜${formatDate(station)}・第${station.r}回`,
    ),
    "出典：国土交通省「道の駅」登録一覧",
  ].join("\n");
  void copyText(text, event.currentTarget);
  emit("copied");
});

const boot = async () => {
  try {
    const [indexResponse, stationsResponse] = await Promise.all([
      fetch("/data/index.json"),
      fetch("/data/stations.json"),
    ]);
    if (!indexResponse.ok || !stationsResponse.ok) throw new Error("data_fetch_failed");
    const index = await indexResponse.json();
    const rows = await stationsResponse.json();
    if (!Array.isArray(rows) || rows.length !== 1231 || index.count !== 1231)
      throw new Error("data_contract_failed");
    state.stations = rows.map((station) => ({
      ...station,
      q: normalize(
        `${station.p} ${station.n} ${station.l} 第${station.r}回 ${station.y}年 ${station.m}月`,
      ),
    }));
    state.saved = state.saved.filter((id) => state.stations.some((station) => station.i === id));
    persistSaved();
    const prefectureSelect = byId("prefecture");
    index.prefectures.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.name;
      option.textContent = `${item.name}（${item.count}）`;
      prefectureSelect.append(option);
    });
    byId("data-status").textContent = `${index.count.toLocaleString("ja-JP")}駅を読み込みました`;
    state.filtered = [...state.stations];
    renderSaved();
    renderResults();
    emit("visited");
  } catch {
    byId("data-status").textContent =
      "一覧を読み込めませんでした。時間をおいて再読み込みしてください。";
    byId("results").innerHTML =
      '<div class="no-results"><h3>公式一覧を読み込めませんでした</h3><p>通信状態を確認して再読み込みしてください。</p></div>';
  }
};

void boot();
