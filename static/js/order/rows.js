// 行生成と行内イベント
import { onEnterOrBlur, setError, setText } from "./core.js";
import { saveDraft } from "./draft.js";
import { recalcAmounts, refreshPricingForRow } from "./pricing.js";
import { resolveMakerName } from "./maker.js";
import { resolveProduct } from "./product.js";
import { applySelectedUnitToRow, resolveUnits } from "./units.js";
import { openMakerSearch, openProductSearch } from "./popup.js";

export function addRow(prefill = {}) {
  const tbody = document.querySelector("#grid tbody");
  if (!tbody) throw new Error("Missing element: #grid tbody");

  const no = tbody.children.length + 1;

  const tr = document.createElement("tr");
  tr.dataset.rowId = String(no);

  tr.innerHTML = `
    <td class="treadonly center">${no}</td>

    <td><input class="tinput maker_cd" value="${prefill.maker_cd || ""}" /></td>
    <td class="treadonly maker_name">${prefill.maker_name || ""}</td>

    <td><input class="tinput scode" value="${prefill.scode || ""}" /></td>
    <td class="treadonly sname">${prefill.sname || ""}</td>

    <td class="treadonly hinban"></td>
    <td class="treadonly kikaku"></td>

    <td><input class="tinput qty num" type="number" min="0" value="${prefill.qty ?? 0}" /></td>

    <td>
      <select class="tselect unit_select center">
        <option value=""></option>
      </select>
    </td>

    <td class="treadonly irisuu_name center">${prefill.irisuu_name || ""}</td>

    <td class="treadonly teika num">${prefill.teika != null ? String(prefill.teika) : ""}</td>

    <td><input class="tinput sales_price num" type="number" step="1" value="${prefill.sales_price ?? 0}" /></td>
    <td class="treadonly amount num">${prefill.sales_amount != null ? String(prefill.sales_amount) : "0"}</td>

    <td><input class="tinput purchase_price num" type="number" step="1" value="${prefill.purchase_price ?? 0}" /></td>
    <td class="treadonly shiire_amount num">${prefill.purchase_amount != null ? String(prefill.purchase_amount) : "0"}</td>

    <td class="treadonly sup_cd num">${prefill.supplier_code ?? ""}</td>
    <td class="treadonly sup_name"></td>

    <td>
      <select class="tselect tehai" required>
        <option value=""></option>
        <option value="有効在庫引当">有効在庫引当</option>
        <option value="全数発注(※)">全数発注(※)</option>
        <option value="在庫出荷済(緊急品)">在庫出荷済(緊急品)</option>
        <option value="発注入荷済(短貸含)">発注入荷済(短貸含)</option>
        <option value="貸出品 補充要">貸出品 補充要</option>
        <option value="貸出品 補充不要(済)">貸出品 補充不要(済)</option>
      </select>
    </td>
    <td><input class="tinput nouhin" value="${prefill.nouhin || ""}" /></td>
    <td><input class="tinput biko" value="${prefill.biko || ""}" /></td>

    <td class="treadonly price_src">${prefill.price_src || ""}</td>

    <td><input class="tinput irisu_rank center" value="${prefill.irisu_rank || ""}" readonly /></td>
  `;
  tbody.appendChild(tr);

  recalcAmounts(tr);

  const snameCell = tr.querySelector(".sname");
  if (snameCell) snameCell.title = snameCell.textContent || "";
  const hinbanCell = tr.querySelector(".hinban");
  if (hinbanCell) hinbanCell.title = hinbanCell.textContent || "";
  const kikakuCell = tr.querySelector(".kikaku");
  if (kikakuCell) kikakuCell.title = kikakuCell.textContent || "";

  const makerCdEl = tr.querySelector(".maker_cd");
  onEnterOrBlur(makerCdEl, () => resolveMakerName(tr).catch((err) => setError(String(err))));
  makerCdEl?.addEventListener("dblclick", () => {
    saveDraft();
    openMakerSearch(tr.dataset.rowId, (tr.querySelector(".maker_name")?.textContent || "").trim());
  });

  const scodeEl = tr.querySelector(".scode");
  onEnterOrBlur(scodeEl, () => resolveProduct(tr).catch((err) => setError(String(err))));
  scodeEl?.addEventListener("dblclick", () => {
    saveDraft();
    const makerCd = (tr.querySelector(".maker_cd")?.value || "").trim();
    openProductSearch(tr.dataset.rowId, makerCd);
  });

  const qtyEl = tr.querySelector(".qty");
  qtyEl?.addEventListener("input", () => {
    recalcAmounts(tr);
    try { saveDraft(); } catch {}
  });

  const salesEl = tr.querySelector(".sales_price");
  const buyEl = tr.querySelector(".purchase_price");
  salesEl?.addEventListener("input", () => {
    recalcAmounts(tr);
    try { saveDraft(); } catch {}
  });
  buyEl?.addEventListener("input", () => {
    recalcAmounts(tr);
    try { saveDraft(); } catch {}
  });

  const unitSel = tr.querySelector(".unit_select");
  unitSel?.addEventListener("change", async () => {
    applySelectedUnitToRow(tr);
    try { saveDraft(); } catch {}

    await refreshPricingForRow(tr).catch((err) => setError(String(err)));
  });

  const tehaiSel = tr.querySelector(".tehai");
  if (tehaiSel && prefill.tehai) tehaiSel.value = prefill.tehai;

  if ((prefill.scode || "").trim()) {
    resolveUnits(tr, prefill.unit_name || "").catch(() => {});
  } else {
    setText(tr.querySelector(".teika"), String(prefill.teika ?? 0));
    tr.querySelector(".sales_price").value = String(prefill.sales_price ?? 0);
    tr.querySelector(".purchase_price").value = String(prefill.purchase_price ?? 0);
    recalcAmounts(tr);
  }

  return tr;
}
