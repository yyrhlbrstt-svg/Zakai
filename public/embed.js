/**
 * Zakai B2B embed — drop-in widget for banks / fintech / employers.
 *
 * Usage:
 *   <div id="zakai-embed" data-locale="he" data-ref="partner-acme" data-path="money"></div>
 *   <script src="https://zakai-3uxj.vercel.app/embed.js" async></script>
 *
 * data-path options: money (default) | cancel | what-am-i-owed | leaks | electricity
 * Opens the chosen entry door with UTM + partner ref. No credentials, no
 * callback phone number — the closed-loop doctrine holds for B2B too.
 */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined") return;

  var ORIGIN = (function () {
    var s = document.currentScript && document.currentScript.src;
    if (s) {
      try {
        return new URL(s).origin;
      } catch (e) {}
    }
    return "https://zakai-3uxj.vercel.app";
  })();

  var ALLOWED_PATHS = {
    money: "/money",
    cancel: "/cancel",
    "what-am-i-owed": "/what-am-i-owed",
    rights: "/what-am-i-owed",
    leaks: "/leaks",
    start: "/start",
    electricity: "/electricity",
    power: "/electricity",
  };

  function qs(el, name, fallback) {
    var v = el.getAttribute("data-" + name);
    return v && v.trim() ? v.trim() : fallback;
  }

  function mount(el) {
    if (el.getAttribute("data-zakai-mounted")) return;
    el.setAttribute("data-zakai-mounted", "1");

    var locale = qs(el, "locale", "he");
    var ref = qs(el, "ref", "embed");
    var pathKey = qs(el, "path", "money").toLowerCase();
    var path = ALLOWED_PATHS[pathKey] || ALLOWED_PATHS.money;

    var label =
      qs(el, "label", null) ||
      (pathKey === "cancel"
        ? locale === "he" || locale === "ar"
          ? "בטל מנוי עם סוכן זכאי"
          : "Cancel a subscription with Zakai agent"
        : pathKey === "what-am-i-owed" || pathKey === "rights"
          ? locale === "he" || locale === "ar"
            ? "מה מגיע לי? בדוק עם זכאי"
            : "What am I owed? Check with Zakai"
          : pathKey === "electricity" || pathKey === "power"
            ? locale === "he" || locale === "ar"
              ? "השווה ספקי חשמל — הסוכן עובר בשמך"
              : "Compare electricity — agent switches for you"
            : locale === "he" || locale === "ar"
              ? "בדוק זכויות וחיסכון עם זכאי"
              : "Check rights & savings with Zakai");

    var sub =
      qs(el, "sub", null) ||
      (locale === "he" || locale === "ar"
        ? "בלי מוקד · בלי להשאיר טלפון · עמלה רק על חיסכון מתועד"
        : "No call center · no phone left behind · fee only on documented savings");

    var href =
      ORIGIN +
      "/" +
      encodeURIComponent(locale) +
      path +
      "?utm_source=embed&utm_medium=partner&utm_campaign=" +
      encodeURIComponent(ref);

    el.innerHTML = "";
    el.style.cssText =
      (el.getAttribute("style") || "") +
      ";font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px";

    var card = document.createElement("div");
    card.style.cssText =
      "border:1px solid rgba(63,203,155,0.35);border-radius:16px;padding:18px 20px;" +
      "background:linear-gradient(145deg,#0a1119 0%,#0d1a14 100%);color:#e8f0ef";

    var kicker = document.createElement("div");
    kicker.style.cssText =
      "font-size:11px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;" +
      "color:#3FCB9B;margin-bottom:8px";
    kicker.textContent = "Zakai · Money OS";

    var title = document.createElement("div");
    title.style.cssText = "font-size:16px;font-weight:800;line-height:1.35;margin-bottom:6px";
    title.textContent = label;

    var desc = document.createElement("div");
    desc.style.cssText = "font-size:12.5px;opacity:0.72;line-height:1.45;margin-bottom:14px";
    desc.textContent = sub;

    var btn = document.createElement("a");
    btn.href = href;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.style.cssText =
      "display:inline-block;text-decoration:none;font-weight:800;font-size:14px;" +
      "padding:11px 18px;border-radius:12px;color:#06121A;" +
      "background:linear-gradient(105deg,#3FCB9B,#23cbb6)";
    btn.textContent =
      locale === "he" || locale === "ar" ? "התחל עכשיו →" : "Start now →";

    card.appendChild(kicker);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(btn);
    el.appendChild(card);
  }

  function boot() {
    var nodes = document.querySelectorAll("[data-zakai-embed], #zakai-embed");
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
