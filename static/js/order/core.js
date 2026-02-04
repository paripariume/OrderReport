// 共通ユーティリティ
export const API_BASE = "/api";

export function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg || "";
  else console.log("[status]", msg);
}

export function setError(msg) {
  const el = document.getElementById("error");
  if (el) el.textContent = msg || "";
  else console.error("[error]", msg);
}

export async function apiGet(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${path} failed: ${res.status}\n${text}`);
  }
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${path} failed: ${res.status}\n${text}`);
  }
  return res.json();
}

export function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function onEnterOrBlur(inputEl, fn) {
  if (!inputEl) return;
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fn();
    }
  });
  inputEl.addEventListener("blur", fn);
}

export function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function setText(el, v) {
  if (!el) return;
  el.textContent = v == null ? "" : String(v);
}
