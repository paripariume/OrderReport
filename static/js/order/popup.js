// ポップアップ操作
import { setError } from "./core.js";

export function openPopup(absUrl, name, w = 1200, h = 750) {
  const left = Math.max(0, (screen.width - w) / 2);
  const top = Math.max(0, (screen.height - h) / 2);
  const features = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`;

  const win = window.open(absUrl, name, features);
  if (!win) {
    setError("ポップアップがブロックされました。ブラウザ設定で許可してください。");
    return null;
  }
  try { win.focus(); } catch {}
  return win;
}

export function openCustomerSearch(initQ = "") {
  const u = new URL(window.location.origin + "/customer_search.html");
  u.searchParams.set("mode", "customer");
  if (initQ) u.searchParams.set("q", initQ);
  openPopup(u.toString(), "customer_search", 1100, 700);
}

export function openShiptoSearch(initQ = "") {
  const u = new URL(window.location.origin + "/customer_search.html");
  u.searchParams.set("mode", "shipto");
  if (initQ) u.searchParams.set("q", initQ);
  openPopup(u.toString(), "shipto_search", 1100, 700);
}

export function openMakerSearch(rowId, initQ = "") {
  const u = new URL(window.location.origin + "/maker_search.html");
  u.searchParams.set("row_id", String(rowId || ""));
  if (initQ) u.searchParams.set("q", initQ);
  openPopup(u.toString(), "maker_search", 1100, 700);
}

export function openProductSearch(rowId, initMakerCd = "") {
  const u = new URL(window.location.origin + "/product_search.html");
  u.searchParams.set("row_id", String(rowId || ""));
  if (initMakerCd) u.searchParams.set("maker_cd", initMakerCd);
  openPopup(u.toString(), "product_search", 1200, 750);
}
