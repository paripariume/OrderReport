// 単位選択と同期
import { apiGet, setError, setStatus, setText } from "./core.js";
import { saveDraft } from "./draft.js";
import { refreshPricingForRow } from "./pricing.js";

export function clearUnitUI(tr) {
  const sel = tr?.querySelector?.(".unit_select");
  if (sel) sel.innerHTML = `<option value=""></option>`;

  const irisuu = tr?.querySelector?.(".irisuu_name");
  const rank = tr?.querySelector?.(".irisu_rank");
  setText(irisuu, "");
  if (rank) rank.value = "";
}

export function normalizeUnitsResponse(units) {
  if (Array.isArray(units)) return units;
  if (units && typeof units === "object") {
    if (Array.isArray(units.items)) return units.items;
    if (Array.isArray(units.data)) return units.data;
    if (Array.isArray(units.rows)) return units.rows;
    if (Array.isArray(units.result)) return units.result;
  }
  return [];
}

export function fillUnitOptions(tr, units) {
  const sel = tr?.querySelector?.(".unit_select");
  if (!sel) return;

  sel.innerHTML = `<option value=""></option>`;

  const arr = normalizeUnitsResponse(units);

  for (const u of arr) {
    const unitName = u.unit_name ?? u["単位名"] ?? u["単位.単位名"] ?? "";
    const irisuName = u.irisu_name ?? u["入数名"] ?? u["入数.入数名"] ?? "";
    const irisuRank = u.irisu_rank ?? u["入数ランク"] ?? u["入数.入数ランク"] ?? "";

    if (!unitName) continue;

    const opt = document.createElement("option");
    opt.value = unitName;
    opt.textContent = unitName;
    opt.dataset.irisuuName = irisuName ?? "";
    opt.dataset.irisuRank = String(irisuRank ?? "");
    sel.appendChild(opt);
  }
}

export function applySelectedUnitToRow(tr) {
  const sel = tr?.querySelector?.(".unit_select");
  if (!sel) return;

  const opt = sel.options[sel.selectedIndex];
  const irisuuName = opt?.dataset?.irisuuName ?? "";
  const irisuRank = opt?.dataset?.irisuRank ?? "";

  const irisuu = tr.querySelector(".irisuu_name");
  const rank = tr.querySelector(".irisu_rank");
  setText(irisuu, irisuuName);
  if (rank) rank.value = irisuRank;

  try { saveDraft(); } catch {}
}

export async function resolveUnits(tr, preferredUnitName = "") {
  setError("");

  const scodeEl = tr?.querySelector?.(".scode");
  if (!scodeEl) throw new Error("Missing row element: .scode");

  const scode = scodeEl.value.trim();
  clearUnitUI(tr);
  if (!scode) return;

  setStatus(`単位候補取得中... 商品CD=${scode}`);
  const units = await apiGet(`/products/units?product_cd=${encodeURIComponent(scode)}`);
  fillUnitOptions(tr, units);

  const sel = tr.querySelector(".unit_select");
  if (sel) {
    const want = (preferredUnitName || "").trim();
    const opts = [...sel.options];
    if (want && opts.some((o) => o.value === want)) {
      sel.value = want;
    } else {
      const actual = opts.filter((o) => (o.value || "").trim() !== "");
      if (actual.length === 1) sel.value = actual[0].value;
    }
    applySelectedUnitToRow(tr);
  }

  setStatus(`単位候補取得完了: 商品CD=${scode}`);

  await refreshPricingForRow(tr).catch(() => {});
}
