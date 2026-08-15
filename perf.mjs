import { chromium } from "playwright";

const ROUTES = ["/", "/money", "/pricing", "/leaks", "/what-am-i-owed", "/tools", "/deposit", "/cancel"];
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });

// A mid-range Android on a real Israeli mobile connection — not a laptop on
// fibre, which is the machine nobody actually reads this site on.
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
});
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

console.log("Simulated: 4x CPU throttle, 1.6 Mbps / 150ms RTT (Slow 4G), 390px\n");
console.log("route".padEnd(18) + "LCP".padStart(9) + "CLS".padStart(8) + "TTFB".padStart(9) + "bytes".padStart(11));
const rows = [];
for (const r of ROUTES) {
  let bytes = 0;
  const onResp = (resp) => { const l = resp.headers()["content-length"]; if (l) bytes += Number(l); };
  p.on("response", onResp);
  await p.goto(`http://127.0.0.1:3000/he${r}`, { waitUntil: "load", timeout: 60000 });
  const m = await p.evaluate(() => new Promise((res) => {
    let lcp = 0, cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    setTimeout(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      res({ lcp: Math.round(lcp), cls: Number(cls.toFixed(3)), ttfb: Math.round(nav?.responseStart ?? 0) });
    }, 2500);
  }));
  p.off("response", onResp);
  rows.push({ r, ...m, kb: Math.round(bytes / 1024) });
  const flag = m.lcp > 2500 ? "  <-- over 2.5s" : "";
  console.log(r.padEnd(18) + `${m.lcp}ms`.padStart(9) + String(m.cls).padStart(8) + `${m.ttfb}ms`.padStart(9) + `${Math.round(bytes/1024)}kB`.padStart(11) + flag);
}
const worst = rows.reduce((a, x) => (x.lcp > a.lcp ? x : a));
console.log(`\nworst LCP: ${worst.r} at ${worst.lcp}ms   (Google "good" = under 2500ms)`);
console.log(`worst CLS: ${rows.reduce((a,x)=>x.cls>a.cls?x:a).cls}   (good = under 0.1)`);
await b.close();
