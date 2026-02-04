// メーカ検索ポップアップ
// 検索→選択→親へ postMessage → 自分は閉じる

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
const qs = (id) => document.getElementById(id);

// HTML要素
const qEl = qs("q");
const btnSearch = qs("btn");
const btnClose = qs("back");
const body = qs("results");
const errEl = qs("error");
const loadingEl = qs("loading");

// URLパラメータ
const url = new URL(location.href);
const rowId = url.searchParams.get("row_id") || "";
qEl.value = url.searchParams.get("q") || "";

// デバッグ
console.log("[maker_search] loaded", location.href);
console.log("[maker_search] opener", window.opener);
console.log("[maker_search] row_id", rowId);

function setError(msg) {
  if (errEl) errEl.textContent = msg || "";
}

function setLoading(on) {
  if (loadingEl) loadingEl.classList.toggle("show", !!on);
  if (btnSearch) btnSearch.disabled = !!on;
  if (qEl) qEl.disabled = !!on;
}

// イベント
btnClose.addEventListener("click", () => window.close());

btnSearch.addEventListener("click", () => {
  search().catch((e) => setError(String(e)));
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    search().catch((e) => setError(String(e)));
  }
  if (e.key === "Escape") {
    e.preventDefault();
    window.close();
  }
});

// 検索
async function search() {
  setError("");
  const q = qEl.value.trim();

  if (!q) {
    body.innerHTML = "";
    return;
  }

  setLoading(true);
  try {
    const res = await fetch(`/api/makers/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`検索に失敗しました (${res.status}) ${t}`);
    }

    const data = await res.json();
    const items = data.items || [];

    body.innerHTML = "";

    if (!items.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="2" class="muted">（該当なし）</td>`;
      body.appendChild(tr);
      return;
    }

    for (const it of items) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(it.maker_cd)}</td>
        <td>${esc(it.maker_name)}</td>
      `;
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => select(it));
      tr.addEventListener("dblclick", () => select(it));
      body.appendChild(tr);
    }
  } finally {
    setLoading(false);
  }
}

// 親へ返す
function select(it) {
  if (!window.opener || window.opener.closed) {
    alert("元画面が見つかりません");
    return;
  }

  window.opener.postMessage(
    {
      type: "MAKER_SELECTED",
      row_id: String(rowId || ""),
      maker: it,
    },
    window.location.origin
  );

  window.close();
}

// 初期フォーカス
qEl.focus();
