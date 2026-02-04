// UIスクリプトの読み込み
console.log("loader.js loaded");

(() => {
  if (window.__LOADER_RUNNING__) {
    console.warn("loader.js already running - skip");
    return;
  }
  window.__LOADER_RUNNING__ = true;

  function ensureBadge() {
    let el = document.getElementById("app_version_badge");
    if (!el) {
      el = document.createElement("div");
      el.id = "app_version_badge";
      el.style.position = "fixed";
      el.style.right = "10px";
      el.style.bottom = "8px";
      el.style.zIndex = "99999";
      el.style.fontSize = "12px";
      el.style.color = "#666";
      el.style.background = "rgba(255,255,255,0.9)";
      el.style.border = "1px solid #d0d0d0";
      el.style.padding = "4px 8px";
      el.style.borderRadius = "6px";
      el.style.userSelect = "none";
      document.body.appendChild(el);
    }
    return el;
  }

  function badge(text) {
    if (!document.body) return;
    ensureBadge().textContent = text;
  }

  function showFatal(msg) {
    if (!document.body) return;
    const el = ensureBadge();
    el.style.color = "#b00020";
    el.style.borderColor = "#b00020";
    el.textContent = msg;
  }

  window.addEventListener("error", (e) => showFatal(`JS Error: ${e.message}`));
  window.addEventListener("unhandledrejection", (e) =>
    showFatal(`Promise Error: ${String(e.reason)}`)
  );

  function onDomReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load: ${src}`));
      document.head.appendChild(s);
    });
  }

  const BASE = "/static/js";

  const BOOT = Date.now();
  const VERSION_URL = `${BASE}/version.js?boot=${BOOT}`;
  const MAIN_URL = (ver) => `${BASE}/ui_main.js?v=${encodeURIComponent(ver)}&boot=${BOOT}`;

  onDomReady(() => badge("loading..."));

  loadScript(VERSION_URL)
    .then(() => {
      const ver = window.APP_VERSION ?? "dev";
      onDomReady(() => badge(`v${ver}`));
      return loadScript(MAIN_URL(ver));
    })
    .then(() => {
      const ver = window.APP_VERSION ?? "dev";
      onDomReady(() => badge(`v${ver}`));
      console.log("[loader] ui_main loaded:", ver, "base:", BASE, "boot:", BOOT);
    })
    .catch((err) => {
      console.error(err);
      onDomReady(() => showFatal(err.message));
    });
})();
