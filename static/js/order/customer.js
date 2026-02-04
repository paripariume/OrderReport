// 得意先・需要先の取得
import { apiGet, setError, setStatus } from "./core.js";
import { refreshPricingAllRows } from "./pricing.js";

export async function resolveCustomerName() {
  setError("");
  const tcodeEl = document.getElementById("tcode");
  const tnameEl = document.getElementById("tname");
  if (!tcodeEl || !tnameEl) throw new Error("Missing element: #tcode or #tname");

  const tcode = tcodeEl.value.trim();
  if (!tcode) {
    tnameEl.textContent = "（得意先名）";
    return;
  }

  setStatus(`得意先名取得中... 得意先CD=${tcode}`);
  const r = await apiGet(`/customers/${encodeURIComponent(tcode)}`);
  tnameEl.textContent = r.customer_name ? r.customer_name : "（未登録）";
  setStatus(`得意先名取得完了: 得意先CD=${tcode}`);

  await refreshPricingAllRows().catch(() => {});
}

export async function resolveShiptoName() {
  setError("");
  const jcodeEl = document.getElementById("jcode");
  const jnameEl = document.getElementById("jname");
  if (!jcodeEl || !jnameEl) throw new Error("Missing element: #jcode or #jname");

  const jcode = jcodeEl.value.trim();
  if (!jcode) {
    jnameEl.textContent = "（需要先名）";
    return;
  }

  setStatus(`需要先名取得中... 需要先CD=${jcode}`);
  const r = await apiGet(`/shipto/${encodeURIComponent(jcode)}`);
  jnameEl.textContent = r.shipto_name ? r.shipto_name : "（未登録）";
  setStatus(`需要先名取得完了: 需要先CD=${jcode}`);

  await refreshPricingAllRows().catch(() => {});
}
