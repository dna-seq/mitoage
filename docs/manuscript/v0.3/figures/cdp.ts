// Headless Google Chrome over the DevTools protocol, for the screenshot figures of the MitoAge 2 manuscript
// (capture-figures-3-4.ts, capture-figure-5.ts). Bun's own WebSocket, no other dependency.
//
// Light theme. Headless Chrome 157 returns a stale getComputedStyle() colour after an inline style changes
// within one task, so the tree and the alignment drew every mark in one colour; every page is given a
// getComputedStyle that reads a fresh clone of any element with a style attribute (docs/manuscript/NOTES.md,
// "Figures").

import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type Rect = { x: number; y: number; width: number; height: number };

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The preview's origin from the command line, or exit with the usage line. */
export function originArg(script: string): string {
  const origin = (process.argv[2] ?? "").replace(/\/$/, "");
  if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
    console.error(`usage: bun docs/manuscript/v0.2/figures/${script} http://localhost:<port of bun run preview>`);
    process.exit(1);
  }
  return origin;
}

const COLOUR_WORKAROUND = `
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
  })();`;

export async function openChrome(prefix: string) {
  const work = mkdtempSync(join(tmpdir(), prefix));
  const profile = join(work, "chrome");
  const chrome = Bun.spawn(
    ["google-chrome", "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${profile}`, "--remote-debugging-port=0", "--window-size=1440,1400", "about:blank"],
    { stdout: "ignore", stderr: "ignore" },
  );
  const close = async () => {
    chrome.kill();
    await chrome.exited;
    rmSync(profile, { recursive: true, force: true });
  };
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
    ws.onmessage = (m) => {
      const msg = JSON.parse(String(m.data));
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id)!;
        pending.delete(msg.id);
        msg.error ? p.rej(new Error(`${msg.error.message} ${msg.error.data ?? ""}`)) : p.res(msg.result);
      }
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
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: COLOUR_WORKAROUND });

    /** Set the viewport (CSS px) and the device scale, then load a page and wait for it. */
    const load = async (url: string, width: number, height: number, scale: number) => {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });
      await send("Page.navigate", { url });
      await sleep(300);
      await waitFor(`location.href.startsWith(${JSON.stringify(url.split("?")[0])}) && document.readyState === "complete"`, `${url} to load`);
    };
    /** Islands hydrate when visible: scroll the element into view, force a frame, wait. */
    const show = async (sel: string, ms = 2000) => {
      await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); window.scrollTo({ top: e.getBoundingClientRect().top + scrollY - 40, behavior: "instant" }); })()`);
      await send("Page.captureScreenshot", { format: "png" });
      await sleep(ms);
    };
    /** The page rectangle of the first element a selector (or an expression returning an element) finds. */
    const rect = (sel: string) =>
      evaluate<Rect>(`(() => { const e = ${sel.startsWith("(") ? sel : `document.querySelector(${JSON.stringify(sel)})`}; if (!e) throw new Error("no element: " + ${JSON.stringify(sel)}); const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; })()`);
    /**
     * Sticky bars (the site header, a page's tab bar) are painted over a capture taken below the viewport:
     * sticky elements become relative (they keep their place in the flow) and fixed ones are hidden.
     */
    const unstick = () =>
      evaluate(`(() => {
        for (const e of document.querySelectorAll("body *")) {
          const p = getComputedStyle(e).position;
          if (p === "sticky") e.style.position = "relative";
          else if (p === "fixed") e.style.visibility = "hidden";
        }
      })()`);
    /** Screenshot a page rectangle into a PNG file. */
    const shot = async (clip: Rect, file: string) => {
      const r = await send("Page.captureScreenshot", { format: "png", clip: { ...clip, scale: 1 }, captureBeyondViewport: true });
      writeFileSync(file, Buffer.from(r.data, "base64"));
    };
    /**
     * The smallest font size (CSS px) and the smallest cap height of visible text inside a page rectangle,
     * HTML text and SVG text alike, with an example of that text; elements hidden by a rule passed in `skip`
     * (a selector) are left out.
     */
    const smallestText = (clip: Rect, skip = "") =>
      evaluate<{ px: number; text: string }>(`(() => {
        const clip = ${JSON.stringify(clip)};
        let best = { px: Infinity, text: "" };
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const t = n.textContent.trim();
          if (!t) continue;
          const el = n.parentElement;
          if (!el || ${JSON.stringify(skip)} && el.closest(${JSON.stringify(skip || "x")})) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          const rs = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
          if (!rs.length) continue;
          const inside = rs.some((r) => r.left + scrollX >= clip.x - 1 && r.right + scrollX <= clip.x + clip.width + 1 &&
                                       r.top + scrollY >= clip.y - 1 && r.bottom + scrollY <= clip.y + clip.height + 1);
          if (!inside) continue;
          // An SVG text's font-size is in user units; scale it by the SVG's rendered size.
          let px = parseFloat(cs.fontSize);
          const svg = el.closest("svg");
          if (svg && el instanceof SVGElement) {
            const m = el.getScreenCTM();
            if (m) px *= Math.hypot(m.a, m.b);
          }
          if (px < best.px) best = { px, text: t.slice(0, 40) };
        }
        return best;
      })()`);

    return { work, send, evaluate, waitFor, load, show, rect, shot, smallestText, unstick, close: async () => (ws.close(), await close()) };
  } catch (e) {
    await close();
    throw e;
  }
}

/** Run ImageMagick; throw with its stderr on failure. */
export function magick(args: string[]) {
  const r = Bun.spawnSync(["magick", ...args], { stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`magick: ${r.stderr.toString()}`);
}

/** Pixel width and height of an image file. */
export function size(file: string): { w: number; h: number } {
  const r = Bun.spawnSync(["magick", "identify", "-format", "%w %h", file], { stdout: "pipe" });
  const [w, h] = r.stdout.toString().trim().split(" ").map(Number);
  return { w, h };
}

/** Printed size in points of text `px` CSS px tall in a capture `capturePx` CSS px wide, printed `mm` wide. */
export const printedPt = (px: number, captureCssWidth: number, mm: number) => (px * mm) / captureCssWidth / 25.4 * 72;

export { writeFileSync, join };
