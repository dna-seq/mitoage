// Figure 5 of the MitoAge 2 manuscript: the plot explorer, captured from the built site.
//
//   bun run build                                                     # if dist/ is not current
//   env SITE_URL=https://just-dna.life BASE_PATH=/mitoage bun run preview --port 4347
//   bun docs/manuscript/figures/capture-figure-5.ts http://localhost:4347
//
// The argument is the preview's origin as its log prints it (the port it actually took). Headless Google
// Chrome is driven over the DevTools protocol with Bun's own WebSocket: light theme, 1,440 x 1,400 CSS px at
// a device scale of 2. Panel A is the plot card with the corrected statistics beside it; panel B is the
// Strongest correlations card as it opens (maximum lifespan, all species), cut below its tenth row.
// ImageMagick labels the panels and writes FIGURE_5_PLOT_EXPLORER.jpg (quality 85).
//
// Headless Chrome 157 returns a stale getComputedStyle() colour after an inline style changes within one
// task; the page is given a getComputedStyle that reads a fresh clone of any element with a style
// attribute (docs/manuscript/NOTES.md, "Figures").

import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
  console.error("usage: bun docs/manuscript/figures/capture-figure-5.ts http://localhost:<port of bun run preview>");
  process.exit(1);
}
const PAGE =
  "/mitoage/compare/plot/?x=maxLongevityYears&y=gc:total_mtDNA&scope=class:Mammalia&fit=1" +
  "&highlight=homo-sapiens,balaena-mysticetus,heterocephalus-glaber,mus-musculus";
const outPath = join(import.meta.dir, "FIGURE_5_PLOT_EXPLORER.jpg");
const BG = "#f4fae6"; // --lime-50, the page background
const INK = "#17305c"; // --navy-900
const font = "DejaVu-Sans-Bold"; // panel letters; ImageMagick cannot read the site's woff2

const work = mkdtempSync(join(tmpdir(), "mitoage-figure-5-"));
const profile = join(work, "chrome");
const chrome = Bun.spawn(
  ["google-chrome", "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${profile}`, "--remote-debugging-port=0", "--window-size=1440,1400", "about:blank"],
  { stdout: "ignore", stderr: "ignore" },
);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

try {
  // Chrome writes the port it took into the profile.
  let port = "";
  for (let i = 0; i < 100 && !port; i++) {
    const f = join(profile, "DevToolsActivePort");
    if (existsSync(f)) port = readFileSync(f, "utf8").split("\n")[0].trim();
    else await sleep(100);
  }
  if (!port) throw new Error("Chrome did not open a DevTools port");
  const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
  const target = targets.find((t) => t.type === "page");
  if (!target) throw new Error("no page target");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => ((ws.onopen = res), (ws.onerror = rej)));
  let nextId = 1;
  const pending = new Map<number, { res: (v: any) => void; rej: (e: Error) => void }>();
  const events: { method: string; params: any }[] = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(String(m.data));
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)!;
      pending.delete(msg.id);
      msg.error ? p.rej(new Error(`${msg.error.message} ${msg.error.data ?? ""}`)) : p.res(msg.result);
    } else if (msg.method) events.push(msg);
  };
  const send = (method: string, params: object = {}): Promise<any> =>
    new Promise((res, rej) => {
      const id = nextId++;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async <T>(expression: string): Promise<T> => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value as T;
  };
  const waitFor = async (expression: string, what: string, ms = 20000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await evaluate<boolean>(`Boolean(${expression})`)) return;
      await sleep(200);
    }
    throw new Error(`timed out waiting for ${what}`);
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1400, deviceScaleFactor: 2, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      try { localStorage.setItem("mitoage-theme", "light"); } catch {}
      (() => {
        const orig = window.getComputedStyle;
        const kebab = (p) => p.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
        window.getComputedStyle = function (el, pseudo) {
          if (pseudo || !(el instanceof Element) || !el.hasAttribute("style") || !el.parentNode) return orig.call(window, el, pseudo);
          const clone = el.cloneNode(false);
          el.parentNode.insertBefore(clone, el);
          const cs = orig.call(window, clone);
          const copy = {};
          for (let i = 0; i < cs.length; i++) copy[cs[i]] = cs.getPropertyValue(cs[i]);
          for (const p of Object.keys(copy)) if (p.startsWith("--")) copy[p] = cs.getPropertyValue(p);
          clone.remove();
          return new Proxy(copy, {
            get(t, p) {
              if (p === "getPropertyValue") return (n) => t[n] ?? orig.call(window, el).getPropertyValue(n);
              if (p === "length") return Object.keys(t).length;
              if (typeof p !== "string") return undefined;
              return t[kebab(p)] ?? "";
            },
          });
        };
      })();`,
  });
  await send("Page.navigate", { url: origin + PAGE });
  await waitFor(`location.pathname.includes("/compare/plot/") && document.readyState === "complete"`, "the page to load");

  // Islands hydrate when visible: bring each card into view before reading it.
  const show = async (sel: string) => {
    await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); window.scrollTo({ top: e.getBoundingClientRect().top + scrollY - 40, behavior: "instant" }); })()`);
    await send("Page.captureScreenshot", { format: "png" }); // forces a frame
    await sleep(2000);
  };
  await show(".xp-plot");
  await waitFor(`document.querySelectorAll(".xp-plot svg circle").length > 100 && document.querySelector(".xp-pre") && /q-value/i.test(document.querySelector(".xp-pre").textContent)`, "the plot and the corrected statistics");
  await show(".xp-strong");
  await waitFor(`document.querySelectorAll(".xp-strong .xp-rows__list > li .xp-row__rank").length >= 10 && /features have q/.test(document.querySelector(".xp-strong__summary")?.textContent ?? "")`, "the Strongest correlations rows");
  await evaluate(`window.scrollTo({ top: 0, behavior: "instant" })`);
  await sleep(1000);

  type Rect = { x: number; y: number; width: number; height: number };
  const rect = (sel: string) =>
    evaluate<Rect>(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; })()`);
  const plot = await rect(".xp-plot");
  const side = await rect(".xp-side .xp-pre");
  const strong = await rect(".xp-strong");
  const row10 = await evaluate<Rect>(
    `(() => { const r = document.querySelectorAll(".xp-strong .xp-rows__list > li")[9].getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; })()`,
  );
  const pad = 12;
  const clipA = {
    x: Math.min(plot.x, side.x) - pad,
    y: Math.min(plot.y, side.y) - pad,
    width: Math.max(plot.x + plot.width, side.x + side.width) - Math.min(plot.x, side.x) + 2 * pad,
    height: Math.max(plot.y + plot.height, side.y + side.height) - Math.min(plot.y, side.y) + 2 * pad,
    scale: 1,
  };
  const clipB = { x: strong.x - pad, y: strong.y - pad, width: strong.width + 2 * pad, height: row10.y + row10.height + 6 - strong.y + pad, scale: 1 };

  // Text the legend quotes, for the report.
  const text = await evaluate<Record<string, string>>(`(() => ({
    pre: document.querySelector(".xp-pre").innerText.replace(/\\s+/g, " "),
    live: document.querySelector(".xp-live")?.innerText.replace(/\\s+/g, " ") ?? "",
    summary: document.querySelector(".xp-strong__summary").innerText.replace(/\\s+/g, " "),
    lede: document.querySelector(".xp-strong__lede")?.innerText.replace(/\\s+/g, " ") ?? "",
  }))()`);
  for (const [k, v] of Object.entries(text)) console.log(`${k}: ${v}`);

  const shot = async (clip: object, file: string) => {
    const r = await send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
    writeFileSync(file, Buffer.from(r.data, "base64"));
  };
  const a = join(work, "5a.png");
  const b = join(work, "5b.png");
  await shot(clipA, a);
  await shot(clipB, b);
  ws.close();

  // Label the panels and stack them on the page background.
  const label = (src: string, letter: string, dst: string) => {
    const r = Bun.spawnSync(
      ["magick", "-background", BG, "-fill", INK, "-font", font, "-pointsize", "84", "-gravity", "west",
        "(", "-size", "x150", `label:${letter}`, "-gravity", "west", "-extent", "x150", ")", src, "-gravity", "west", "-append", dst],
      { stderr: "pipe" },
    );
    if (r.exitCode !== 0) throw new Error(`magick: ${r.stderr.toString()}`);
  };
  label(a, "A", join(work, "5a-l.png"));
  label(b, "B", join(work, "5b-l.png"));
  const r = Bun.spawnSync(
    ["magick", "-background", BG, join(work, "5a-l.png"), join(work, "5b-l.png"), "-gravity", "west", "-append",
      "-bordercolor", BG, "-border", "24", "-quality", "85", outPath],
    { stderr: "pipe" },
  );
  if (r.exitCode !== 0) throw new Error(`magick: ${r.stderr.toString()}`);
  console.log(`wrote ${outPath}; panels in ${work}`);
} finally {
  chrome.kill();
  await chrome.exited;
  rmSync(profile, { recursive: true, force: true });
}
