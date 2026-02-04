// 画面初期化とイベント連携
import { onEnterOrBlur, setError, setStatus, todayISO, toNum } from "./order/core.js";
import { resolveCustomerName, resolveShiptoName } from "./order/customer.js";
import { saveDraft, restoreDraft } from "./order/draft.js";
import { addRow } from "./order/rows.js";
import { resolveUnits } from "./order/units.js";
import {
  openCustomerSearch,
  openShiptoSearch,
  openMakerSearch,
  openProductSearch,
} from "./order/popup.js";

console.log("[ui_main] start");

window.addEventListener("message", (e) => {
  const d = e.data;
  if (!d || !d.type) return;

  try {
    if (d.type === "CUSTOMER_SELECTED") {
      const it = d.customer || {};
      document.getElementById("tcode").value = it.tcode ?? "";
      document.getElementById("tname").textContent = it.customer_name ?? "（未登録）";
      saveDraft();
      resolveCustomerName().catch(() => {});
      return;
    }

    if (d.type === "SHIPTO_SELECTED") {
      const it = d.shipto || {};
      document.getElementById("jcode").value = it.jcode ?? "";
      document.getElementById("jname").textContent = it.shipto_name ?? "（未登録）";
      saveDraft();
      resolveShiptoName().catch(() => {});
      return;
    }

    if (d.type === "MAKER_SELECTED") {
      const rowId = String(d.row_id || "");
      const it = d.maker || {};
      const tr = document.querySelector(`#grid tbody tr[data-row-id="${rowId}"]`);
      if (!tr) return;

      tr.querySelector(".maker_cd").value = it.maker_cd ?? "";
      tr.querySelector(".maker_name").textContent = it.maker_name ?? "";
      saveDraft();
      return;
    }

    if (d.type === "PRODUCT_SELECTED") {
      const rowId = String(d.row_id || "");
      const p = d.product || {};
      const tr = document.querySelector(`#grid tbody tr[data-row-id="${rowId}"]`);
      if (!tr) return;

      tr.querySelector(".scode").value = p.product_cd ?? "";
      const snameCell = tr.querySelector(".sname");
      if (snameCell) {
        snameCell.textContent = p.product_name ?? "";
        snameCell.title = snameCell.textContent || "";
      }
      tr.querySelector(".hinban").textContent = p.maker_part_no ?? "";
      tr.querySelector(".kikaku").textContent = p.spec ?? "";

      const makerCdEl = tr.querySelector(".maker_cd");
      const makerNameEl = tr.querySelector(".maker_name");
      if (makerCdEl && !(makerCdEl.value || "").trim()) makerCdEl.value = p.maker_cd ?? "";
      if (makerNameEl && !(makerNameEl.textContent || "").trim()) makerNameEl.textContent = p.maker_name ?? "";

      resolveUnits(tr, tr.querySelector(".unit_select")?.value ?? "").catch(() => {});
      saveDraft();
      return;
    }
  } catch (err) {
    console.error("[ui_main] message error", err);
    setError(String(err));
  }
});

function init() {
  console.log("[ui_main] init start");
  try {
    const restored = restoreDraft(addRow);

    const issueDate = document.getElementById("issue_date");
    if (issueDate && !issueDate.value) issueDate.value = todayISO();

    const addRowBtn = document.getElementById("add_row");
    if (addRowBtn) {
      addRowBtn.addEventListener("click", (e) => {
        e.preventDefault();
        addRow();
        saveDraft();
      });
    }

    const issueBtn = document.getElementById("issue_pdf");
    if (issueBtn) {
      issueBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await handleIssuePdf();
      });
    }

    const tcodeInput = document.getElementById("tcode");
    onEnterOrBlur(tcodeInput, () => {
      resolveCustomerName().catch((err) => setError(String(err)));
      saveDraft();
    });
    tcodeInput?.addEventListener("dblclick", () => {
      saveDraft();
      openCustomerSearch("");
    });

    const jcodeInput = document.getElementById("jcode");
    onEnterOrBlur(jcodeInput, () => {
      resolveShiptoName().catch((err) => setError(String(err)));
      saveDraft();
    });
    jcodeInput?.addEventListener("dblclick", () => {
      saveDraft();
      openShiptoSearch("");
    });

    document.addEventListener("input", () => saveDraft(), { passive: true });
    document.addEventListener("change", () => saveDraft(), { passive: true });

    resolveCustomerName().catch(() => {});
    resolveShiptoName().catch(() => {});

    const tbody = document.querySelector("#grid tbody");
    const hasRows = !!(tbody && tbody.children.length > 0);
    if (!restored || !hasRows) {
      addRow({ scode: "534687", qty: 10 });
      addRow({ scode: "479238", qty: 5 });
      addRow({ scode: "50362", qty: 5 });
      saveDraft();
    }

    console.log("[ui_main] init end");
  } catch (e) {
    console.error("[ui_main] init crashed", e);
    try { setError(String(e)); } catch {}
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function buildPdfPayload() {
  const issueDate = document.getElementById("issue_date")?.value?.trim() || todayISO();
  const tcode = document.getElementById("tcode")?.value?.trim() || "";
  const tname = document.getElementById("tname")?.textContent?.trim() || "";
  const jcode = document.getElementById("jcode")?.value?.trim() || "";
  const jname = document.getElementById("jname")?.textContent?.trim() || "";
  const tantouCd = document.getElementById("tantou_cd")?.value?.trim() || "";
  const tantouName = document.getElementById("tantou_name")?.textContent?.trim() || "";

  const items = [...document.querySelectorAll("#grid tbody tr")]
    .map((tr) => {
      const scode = tr.querySelector(".scode")?.value?.trim() || "";
      const name = tr.querySelector(".sname")?.textContent?.trim() || "";
      const qty = toNum(tr.querySelector(".qty")?.value);
      const price = toNum(tr.querySelector(".sales_price")?.value);
      const salesAmount = toNum(tr.querySelector(".amount")?.textContent);
      const purchasePrice = toNum(tr.querySelector(".purchase_price")?.value);
      const purchaseAmount = toNum(tr.querySelector(".shiire_amount")?.textContent);
      const spec = tr.querySelector(".kikaku")?.textContent?.trim() || "";
      const unitName = tr.querySelector(".unit_select")?.value?.trim() || "";
      const irisuName = tr.querySelector(".irisuu_name")?.textContent?.trim() || "";
      const supplierCode = tr.querySelector(".sup_cd")?.textContent?.trim() || "";
      const supplierName = tr.querySelector(".sup_name")?.textContent?.trim() || "";
      const deliveryPlaceName = tr.querySelector(".nouhin")?.value?.trim() || "";
      const lineNote = tr.querySelector(".biko")?.value?.trim() || "";
      const irank = tr.querySelector(".irisu_rank")?.value?.trim() || "";

      return {
        scode,
        irank,
        qty,
        name: name || scode,
        price,
        sales_amount: salesAmount,
        purchase_price: purchasePrice,
        purchase_amount: purchaseAmount,
        spec,
        unit_name: unitName,
        irisu_name: irisuName,
        supplier_code: supplierCode,
        supplier_name: supplierName,
        delivery_place_name: deliveryPlaceName,
        line_note: lineNote,
      };
    })
    .filter((it) => it.scode && it.qty > 0);

  if (!items.length) {
    throw new Error("明細がありません。商品CDと数量を入力してください。");
  }

  return {
    header: {
      order_date: issueDate,
      customer_cd: tcode || undefined,
      customer_name: tname || undefined,
      shipto_cd: jcode || undefined,
      shipto_name: jname || undefined,
      tantou_cd: tantouCd || undefined,
      tantou_name: tantouName || undefined,
      tcode: tcode || undefined,
      jcode: jcode || undefined,
    },
    items,
  };
}

function extractFilename(res, fallback) {
  const disp = res.headers.get("Content-Disposition") || "";
  const match = disp.match(/filename\*?=(?:UTF-8'')?\"?([^\";]+)\"?/i);
  return match ? decodeURIComponent(match[1]) : fallback;
}

async function handleIssuePdf() {
  setError("");
  setStatus("PDF生成中...");
  try {
    const payload = buildPdfPayload();
    const res = await fetch("/api/orders/pdf_v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`PDF生成失敗: ${res.status}\n${text}`);
    }

    const blob = await res.blob();
    const fallbackName = `order_${payload.header.order_date || todayISO()}.pdf`;
    const filename = extractFilename(res, fallbackName);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setStatus("PDF生成完了");
  } catch (err) {
    console.error("[ui_main] issue pdf failed", err);
    setError(String(err));
    setStatus("PDF生成失敗");
  }
}
