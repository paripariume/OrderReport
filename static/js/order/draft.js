// 下書き保存/復元
const DRAFT_KEY = "order_draft_v3";

export function saveDraft() {
  try {
    const data = {
      issue_date: document.getElementById("issue_date")?.value ?? "",
      tcode: document.getElementById("tcode")?.value ?? "",
      tname: document.getElementById("tname")?.textContent ?? "",
      jcode: document.getElementById("jcode")?.value ?? "",
      jname: document.getElementById("jname")?.textContent ?? "",
      rows: [...document.querySelectorAll("#grid tbody tr")].map((tr) => ({
        maker_cd: tr.querySelector(".maker_cd")?.value ?? "",
        maker_name: tr.querySelector(".maker_name")?.textContent ?? "",
        scode: tr.querySelector(".scode")?.value ?? "",
        sname: tr.querySelector(".sname")?.textContent ?? "",

        qty: Number(tr.querySelector(".qty")?.value ?? 0),

        unit_name: tr.querySelector(".unit_select")?.value ?? "",
        irisuu_name: tr.querySelector(".irisuu_name")?.textContent ?? "",
        irisu_rank: tr.querySelector(".irisu_rank")?.value ?? "",

        teika: Number(tr.querySelector(".teika")?.textContent ?? 0),
        sales_price: Number(tr.querySelector(".sales_price")?.value ?? 0),
        sales_amount: Number(tr.querySelector(".amount")?.textContent ?? 0),
        purchase_price: Number(tr.querySelector(".purchase_price")?.value ?? 0),
        purchase_amount: Number(tr.querySelector(".shiire_amount")?.textContent ?? 0),
        price_src: tr.querySelector(".price_src")?.textContent ?? "",
        supplier_code: tr.querySelector(".sup_cd")?.textContent ?? "",

        nouhin: tr.querySelector(".nouhin")?.value ?? "",
        tehai: tr.querySelector(".tehai")?.value ?? "",
        biko: tr.querySelector(".biko")?.value ?? "",
      })),
    };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("[ui_main] saveDraft failed", e);
  }
}

export function restoreDraft(addRow) {
  const raw3 = sessionStorage.getItem(DRAFT_KEY);
  const raw2 = sessionStorage.getItem("order_draft_v2");
  const raw1 = sessionStorage.getItem("order_draft_v1");
  const raw = raw3 || raw2 || raw1;
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);

    const issue = document.getElementById("issue_date");
    const tcode = document.getElementById("tcode");
    const tname = document.getElementById("tname");
    const jcode = document.getElementById("jcode");
    const jname = document.getElementById("jname");

    if (issue) issue.value = data.issue_date || "";
    if (tcode) tcode.value = data.tcode || "";
    if (tname) tname.textContent = data.tname || "";
    if (jcode) jcode.value = data.jcode || "";
    if (jname) jname.textContent = data.jname || "";

    const tbody = document.querySelector("#grid tbody");
    if (tbody) tbody.innerHTML = "";

    (data.rows || []).forEach((r) => addRow(r));

    try { saveDraft(); } catch {}
    return true;
  } catch (e) {
    console.error("[ui_main] restoreDraft failed", e);
    return false;
  }
}
