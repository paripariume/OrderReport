// 商品検索ポップアップ
// 親から row_id / maker_cd を受け取る
// 選択した行を親へ postMessage → 自分は閉じる
// 親が期待する形式: { type, row_id, product }

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
function qs(id) { return document.getElementById(id); }

// HTML要素（product_search.html のID）
const makerCdEl = qs("maker_cd");
const makerNameEl = qs("maker_name");
const makerPartNoEl = qs("maker_part_no");
const productNameEl = qs("product_name");
const specEl = qs("spec");

const btnSearch = qs("btnSearch");
const btnClose = qs("btnClose");
const body = qs("resultBody");
const errEl = qs("error");
const loadingEl = qs("loading");

// URLパラメータ
const url = new URL(location.href);
const rowId = url.searchParams.get("row_id") || "";
const initMakerCd = url.searchParams.get("maker_cd") || "";

// 初期値: 親の maker_cd
if (initMakerCd && makerCdEl) makerCdEl.value = initMakerCd;

// デバッグ
console.log("[product_search] loaded", location.href);
console.log("[product_search] origin", location.origin);
console.log("[product_search] row_id", rowId);
console.log("[product_search] opener", window.opener);

function setError(msg) {
  if (errEl) errEl.textContent = msg || "";
}

function setLoading(on) {
  if (loadingEl) loadingEl.classList.toggle("show", !!on);

  // 検索中は入力と検索ボタンを止める
  if (btnSearch) btnSearch.disabled = !!on;
  if (makerCdEl) makerCdEl.disabled = !!on;
  if (makerNameEl) makerNameEl.disabled = !!on;
  if (makerPartNoEl) makerPartNoEl.disabled = !!on;
  if (productNameEl) productNameEl.disabled = !!on;
  if (specEl) specEl.disabled = !!on;
}

btnClose?.addEventListener("click", () => window.close());
btnSearch?.addEventListener("click", () => search().catch((e) => setError(String(e))));

// Enter=検索 / Esc=閉じる
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    search().catch((err) => setError(String(err)));
  }
  if (e.key === "Escape") {
    e.preventDefault();
    window.close();
  }
});

// 検索
async function search() {
  setError("");

  // 検索条件（空でも検索したいなら調整）
  const params = new URLSearchParams({
    maker_cd: makerCdEl?.value?.trim() ?? "",
    maker_name: makerNameEl?.value?.trim() ?? "",
    maker_part_no: makerPartNoEl?.value?.trim() ?? "",
    product_name: productNameEl?.value?.trim() ?? "",
    spec: specEl?.value?.trim() ?? "",
    limit: "200",
  });

  setLoading(true);
  try {
    const res = await fetch(`/api/products/search?${params.toString()}`);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`検索に失敗しました (${res.status}) ${t}`);
    }

    const items = await res.json(); // list

    body.innerHTML = "";

    // 該当なし
    if (!items || items.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" class="muted">（該当なし）</td>`;
      body.appendChild(tr);
      return;
    }

    for (const it of items) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(it.product_cd)}</td>
        <td class="product-name">${esc(it.product_name)}</td>
        <td>${esc(it.spec)}</td>
        <td>${esc(it.maker_cd)}</td>
        <td>${esc(it.maker_name)}</td>
        <td>${esc(it.maker_part_no)}</td>
      `;
      const productNameTd = tr.querySelector(".product-name");
      if (productNameTd) productNameTd.title = it.product_name ?? "";
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => select(it));
      tr.addEventListener("dblclick", () => select(it));
      body.appendChild(tr);
    }
  } finally {
    setLoading(false);
  }
}

// 選択して親へ返す
function select(it) {
  // 親がいない場合は返せない
  if (!window.opener || window.opener.closed) {
    alert("元画面が見つかりません（window.opener が無効）");
    return;
  }

  // 親が期待する形で送る
  window.opener.postMessage(
    {
      type: "PRODUCT_SELECTED",
      row_id: String(rowId || ""),
      product: it,
    },
    // 同一originのみ
    window.location.origin
  );

  // 自分を閉じる
  window.close();
}

// 初期フォーカス
makerCdEl?.focus?.();
