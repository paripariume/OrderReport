// メーカ取得と行反映
import { apiGet, setError, setStatus } from "./core.js";

export async function resolveMakerName(tr) {
  setError("");

  const makerCdEl = tr?.querySelector?.(".maker_cd");
  const makerNameEl = tr?.querySelector?.(".maker_name");
  if (!makerCdEl || !makerNameEl) throw new Error("Missing row elements: .maker_cd or .maker_name");

  const makerCode = makerCdEl.value.trim();
  if (!makerCode) {
    makerNameEl.textContent = "";
    return;
  }

  setStatus(`メーカ名取得中... ﾒｰｶCD=${makerCode}`);
  const r = await apiGet(`/makers/${encodeURIComponent(makerCode)}`);
  makerNameEl.textContent = r.maker_name ? r.maker_name : "（未登録）";
  setStatus(`メーカ名取得完了: ﾒｰｶCD=${makerCode}`);
}
