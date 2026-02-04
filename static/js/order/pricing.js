// 単価取得と金額計算
import { apiPost, setError, setStatus, setText, toNum } from "./core.js";
import { saveDraft } from "./draft.js";

export function recalcAmounts(tr) {
  const qty = toNum(tr.querySelector(".qty")?.value);
  const sales = toNum(tr.querySelector(".sales_price")?.value);
  const buy = toNum(tr.querySelector(".purchase_price")?.value);

  setText(tr.querySelector(".amount"), String(sales * qty));
  setText(tr.querySelector(".shiire_amount"), String(buy * qty));
}

export async function refreshPricingForRow(tr) {
  const tcode = document.getElementById("tcode")?.value?.trim() ?? "";
  const jcode = document.getElementById("jcode")?.value?.trim() ?? "";
  const scode = tr.querySelector(".scode")?.value?.trim() ?? "";
  const irank = tr.querySelector(".irisu_rank")?.value?.trim() ?? "";
  const pricingKey = `${tcode}|${jcode}|${scode}|${irank}`;

  if (tr.dataset.pricingBusy === "1") return;
  if (tr.dataset.pricingKey === pricingKey) return;
  tr.dataset.pricingKey = pricingKey;
  tr.dataset.pricingBusy = "1";

  if (!tcode || !jcode || !scode || !irank) {
    setText(tr.querySelector(".teika"), "0");
    tr.querySelector(".sales_price").value = "0";
    tr.querySelector(".purchase_price").value = "0";
    setText(tr.querySelector(".price_src"), "");
    recalcAmounts(tr);
    try { saveDraft(); } catch {}
    tr.dataset.pricingBusy = "0";
    return;
  }

  setError("");
  setStatus(`単価取得中... 得意先=${tcode} 需要先=${jcode} 商品=${scode} ランク=${irank}`);

  let r;
  try {
    r = await apiPost("/pricing/resolve", { tcode, jcode, scode, irank });
  } finally {
    tr.dataset.pricingBusy = "0";
  }

  setText(tr.querySelector(".teika"), String(toNum(r.teika)));
  tr.querySelector(".sales_price").value = String(toNum(r.sales_price));
  tr.querySelector(".purchase_price").value = String(toNum(r.purchase_price));
  setText(tr.querySelector(".price_src"), r.source ?? "未設定");

  if (r.supplier_code != null && String(r.supplier_code).trim() !== "") {
    setText(tr.querySelector(".sup_cd"), r.supplier_code);
  }

  recalcAmounts(tr);
  setStatus(`単価取得完了: ${(r.source ?? "")}`);

  try { saveDraft(); } catch {}
}

export async function refreshPricingAllRows() {
  const rows = [...document.querySelectorAll("#grid tbody tr")];
  for (const tr of rows) {
    const scode = tr.querySelector(".scode")?.value?.trim() ?? "";
    const irank = tr.querySelector(".irisu_rank")?.value?.trim() ?? "";
    if (!scode || !irank) continue;
    try {
      await refreshPricingForRow(tr);
    } catch (e) {
      console.warn("[ui_main] refreshPricingAllRows row failed", e);
    }
  }
  try { saveDraft(); } catch {}
}
