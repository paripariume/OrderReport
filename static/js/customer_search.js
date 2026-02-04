// 得意先/需要先 検索ポップアップ
// 同一HTMLを mode=customer|shipto で切替
// 検索→選択→親へ postMessage → 自分は閉じる

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
const qs = (id) => document.getElementById(id);

console.log("[customer_search] loaded", location.href);
console.log("[customer_search] origin", location.origin);
console.log("[customer_search] opener", window.opener);

const API_BASE = "/api";

// mode=customer | shipto
const params = new URLSearchParams(location.search);
const mode = (params.get("mode") || "customer").toLowerCase();

const CFG =
  mode === "shipto"
    ? {
        title: "需要先検索",
        labelName: "需要先名",
        thCode: "需要先CD",
        thName: "需要先名",
        placeholder: "例）長崎 / 徳洲会 / 病院 など",
        searchApi: (q) => `${API_BASE}/shipto/search?q=${encodeURIComponent(q)}`,
        postType: "SHIPTO_SELECTED",
        mapItem: (it) => ({ jcode: it.jcode ?? "", shipto_name: it.shipto_name ?? "" }),
        getCode: (it) => it.jcode ?? "",
        getName: (it) => it.shipto_name ?? "",
      }
    : {
        title: "得意先検索",
        labelName: "得意先名",
        thCode: "得意先CD",
        thName: "得意先名",
        placeholder: "例）福岡 / 徳洲会 / 病院 など",
        searchApi: (q) => `${API_BASE}/customers/search?q=${encodeURIComponent(q)}`,
        postType: "CUSTOMER_SELECTED",
        mapItem: (it) => ({ tcode: it.tcode ?? "", customer_name: it.customer_name ?? "" }),
        getCode: (it) => it.tcode ?? "",
        getName: (it) => it.customer_name ?? "",
      };

// HTML要素（customer_search.html のID）
const qEl = qs("q");
const btnSearch = qs("btn");
const btnClose = qs("back");
const body = qs("results");
const errEl = qs("error");

// ローディング要素
const loadingEl = qs("loading");

function setError(msg) {
  if (errEl) errEl.textContent = msg || "";
  else console.error(msg);
}

function setLoading(isLoading) {
  // 検索中だけ上に重ねる
  if (loadingEl) loadingEl.classList.toggle("show", !!isLoading);

  // 検索中は無効化
  if (btnSearch) btnSearch.disabled = !!isLoading;
  if (qEl) qEl.disabled = !!isLoading;
  if (btnClose) btnClose.disabled = !!isLoading; // 閉じるを残すなら外す
}

// 表示をmodeに合わせる
document.title = CFG.title;
qs("label_name").textContent = CFG.labelName;
qs("th_code").textContent = CFG.thCode;
qs("th_name").textContent = CFG.thName;
qEl.placeholder = CFG.placeholder;

// 初期値
qEl.value = params.get("q") || "";

// 親へ返す
function select(it) {
  if (!window.opener || window.opener.closed) {
    alert("元画面が見つかりません（window.opener が無効）");
    return;
  }

  const payload =
    CFG.postType === "SHIPTO_SELECTED"
      ? { type: CFG.postType, shipto: CFG.mapItem(it) }
      : { type: CFG.postType, customer: CFG.mapItem(it) };

  // 送信先は同一オリジンのみ
  window.opener.postMessage(payload, window.location.origin);

  // 自分を閉じる
  window.close();
}

function render(items) {
  body.innerHTML = "";

  // 該当なし
  if (!items || items.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="2" class="muted">（該当なし）</td>`;
    body.appendChild(tr);
    return;
  }

  for (const it of items) {
    const code = esc(CFG.getCode(it));
    const name = esc(CFG.getName(it));

    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${code}</td><td>${name}</td>`;
    tr.style.cursor = "pointer";
    tr.addEventListener("click", () => select(it));
    tr.addEventListener("dblclick", () => select(it));
    body.appendChild(tr);
  }
}

// 検索
async function search() {
  setError("");

  const q = qEl.value.trim();

  // 未入力は空表示
  if (!q) {
    body.innerHTML = "";
    return;
  }

  setLoading(true);
  try {
    const res = await fetch(CFG.searchApi(q));
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`検索に失敗しました (${res.status}) ${text}`);
    }

    const data = await res.json(); // { items: [...] }
    const items = data.items || [];
    render(items);
  } finally {
    setLoading(false);
  }
}

// イベント
btnSearch.addEventListener("click", () => search().catch((e) => setError(String(e))));
btnClose.addEventListener("click", () => window.close());

// Enter=検索 / Esc=閉じる
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (document.activeElement && document.activeElement.id === "q") {
      e.preventDefault();
      search().catch((err) => setError(String(err)));
    }
  } else if (e.key === "Escape") {
    e.preventDefault();
    window.close();
  }
});

// 初期フォーカス
qEl.focus();
