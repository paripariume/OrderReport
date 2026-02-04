// 商品取得と行反映
import { apiGet, setError, setStatus, setText } from "./core.js";
import { saveDraft } from "./draft.js";
import { recalcAmounts } from "./pricing.js";
import { clearUnitUI, resolveUnits } from "./units.js";

export async function resolveProduct(tr) {
  setError("");

  const scodeEl = tr?.querySelector?.(".scode");
  if (!scodeEl) throw new Error("Missing row element: .scode");

  const scode = scodeEl.value.trim();
  if (!scode) {
    clearUnitUI(tr);
    setText(tr.querySelector(".teika"), "0");
    tr.querySelector(".sales_price").value = "0";
    tr.querySelector(".purchase_price").value = "0";
    setText(tr.querySelector(".price_src"), "");
    recalcAmounts(tr);
    return;
  }

  setStatus(`商品情報取得中... 商品CD=${scode}`);
  const r = await apiGet(`/products/${encodeURIComponent(scode)}`);

  const makerCd = tr.querySelector(".maker_cd");
  const makerName = tr.querySelector(".maker_name");
  const sname = tr.querySelector(".sname");
  const hinban = tr.querySelector(".hinban");
  const kikaku = tr.querySelector(".kikaku");
  const supCd = tr.querySelector(".sup_cd");
  const supName = tr.querySelector(".sup_name");

  if (!makerCd || !makerName || !sname || !hinban || !kikaku || !supCd || !supName) {
    throw new Error("Missing row elements for product mapping");
  }

  makerCd.value = r.maker_cd ?? "";
  makerName.textContent = r.maker_name ?? "";

  sname.textContent = r.product_name ?? "（未登録）";
  sname.title = sname.textContent;
  hinban.textContent = r.maker_part_no ?? "";
  hinban.title = hinban.textContent;
  kikaku.textContent = r.spec ?? "";
  kikaku.title = kikaku.textContent;

  supCd.textContent = r.supplier_code ?? "";
  supName.textContent = r.supplier_name ?? "";

  setStatus(`商品情報取得完了: 商品CD=${scode}`);

  await resolveUnits(tr, tr.querySelector(".unit_select")?.value ?? "").catch((e) => {
    console.warn("[ui_main] resolveUnits failed", e);
  });

  try { saveDraft(); } catch {}
}
