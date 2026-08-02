/**
 * Zakai Fairness Widget v1.0 — no data leaves the browser until the user clicks through.
 */
(function () {
  "use strict";

  const script = document.currentScript;
  const apiBase =
    (script && script.getAttribute("data-api-base")) ||
    (script && script.src ? new URL(script.src).origin + "/api" : "/api");
  const appOrigin = apiBase.replace(/\/api\/?$/, "");

  const CONFIG = {
    apiBase,
    appOrigin,
    cssUrl: (script && script.getAttribute("data-css")) || appOrigin + "/widget/zakai-widget.css",
    version: "1.0.0",
  };

  if (!document.getElementById("zakai-widget-css")) {
    const link = document.createElement("link");
    link.id = "zakai-widget-css";
    link.rel = "stylesheet";
    link.href = CONFIG.cssUrl;
    document.head.appendChild(link);
  }

  class ZakaiWidget {
    constructor(container, options) {
      options = options || {};
      this.container = container;
      this.apiKey = options.apiKey || container.dataset.apiKey;
      this.provider = options.provider || container.dataset.provider;
      this.market = options.market || container.dataset.market || "IL";
      if (!this.apiKey) {
        console.error("[Zakai] data-api-key required");
        return;
      }
      this.init();
    }

    async init() {
      this.container.innerHTML =
        '<div class="zakai-widget" data-state="loading"><div class="zakai-spinner"></div><span class="zakai-text">בודק הוגנות...</span></div>';
      try {
        const result = await this.checkFairness();
        this.render(result);
      } catch {
        this.renderError();
      }
    }

    async checkFairness() {
      const url = new URL(CONFIG.apiBase + "/rights/catalog");
      url.searchParams.set("market", this.market);
      url.searchParams.set("category", this.inferCategory());
      const res = await fetch(url, {
        headers: {
          "X-Zakai-Widget-Key": this.apiKey,
          "X-Zakai-Widget-Version": CONFIG.version,
        },
      });
      if (!res.ok) throw new Error("api");
      const data = await res.json();
      return { rights_count: data.total, relevant: (data.rights || []).slice(0, 3) };
    }

    inferCategory() {
      const p = (this.provider || "").toLowerCase();
      if (/cellcom|partner|bezeq|hot|yes|pelephone/.test(p)) return "telecom";
      if (/iec|electric/.test(p)) return "energy";
      return "consumer_protection";
    }

    render(result) {
      const relevant = result.relevant[0];
      const text = relevant
        ? "💡 " + (relevant.display_name.he || relevant.display_name.en || relevant.id)
        : "✓ בדוק זכויות נוספות";
      const ctaUrl = CONFIG.appOrigin + "/he/money";
      this.container.innerHTML =
        '<div class="zakai-widget" data-state="ready">' +
        '<div class="zakai-badge">Zakai Fairness Check</div>' +
        '<div class="zakai-result">' +
        text +
        "</div>" +
        '<a class="zakai-cta" href="' +
        ctaUrl +
        '" target="_blank" rel="noopener">בדוק בחינם →</a>' +
        '<div class="zakai-disclaimer">ללא רישום · הקריאה לקטלוג היא read-only</div></div>';
    }

    renderError() {
      this.container.innerHTML =
        '<div class="zakai-widget" data-state="error">' +
        '<div class="zakai-text">בדיקת זכויות זמינה</div>' +
        '<a href="' +
        CONFIG.appOrigin +
        '" target="_blank" rel="noopener" class="zakai-cta">בדוק בזכאי</a></div>';
    }
  }

  function autoInit() {
    document.querySelectorAll("[data-zakai-widget]").forEach(function (el) {
      if (el._zakai) return;
      el._zakai = new ZakaiWidget(el);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }

  window.ZakaiWidget = ZakaiWidget;
})();
