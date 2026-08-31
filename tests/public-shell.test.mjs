import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { normalizedTextSha256 } from "../scripts/verify-public.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const LEGACY_SHA256 =
  "6E7FF5AA3B15A57A44F0D3351C6C6A5A3B3D14813E9B5616AF3D138C5E41B69F";

async function readPublicSource(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJavaScriptFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
  return files;
}

test("public entrypoints are byte-identical ordinary local shells", async () => {
  const [indexBytes, missionBytes] = await Promise.all([
    readFile(path.join(ROOT, "index.html")),
    readFile(path.join(ROOT, "mission-control.html"))
  ]);
  assert.deepEqual(indexBytes, missionBytes);

  const html = indexBytes.toString("utf8");
  assert.match(html, /<link[^>]+href="app\.css"/);
  assert.match(html, /<link[^>]+rel="icon"[^>]+href="data:,"/);
  assert.doesNotMatch(html, /favicon\.(?:ico|svg)/i);
  assert.match(html, /<script[^>]+type="module"[^>]+src="src\/app\.js"/);
  assert.doesNotMatch(html, /<x-dc|<sc-if|<sc-for|support\.js|text\/x-dc/i);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test("public shell exposes the approved name and exact navigation", async () => {
  const html = await readPublicSource("index.html");
  assert.match(html, />\s*CIRC HQ\s*</);
  assert.match(html, />\s*The Playbook\s*</);
  assert.doesNotMatch(html, /class="brand-mark"/);
  assert.doesNotMatch(html, /<span[^>]*>\s*CIRC\s*<\/span>/);
  assert.doesNotMatch(html, /Mission Control|Teaching Zone/i);

  const nav = html.match(/<nav[\s\S]*?<\/nav>/i)?.[0] ?? "";
  const labels = [...nav.matchAll(/<button[^>]+aria-label="([^"]+)"[^>]*>/gi)].map(
    (match) => match[1].trim()
  );
  assert.deepEqual(labels, [
    "Today",
    "Year Map",
    "Schedule",
    "Room",
    "Settings"
  ]);
  assert.equal((nav.match(/<img\b/gi) ?? []).length, 5);
  for (const icon of ["house", "books", "calendar-dots", "chalkboard-teacher", "gear-six"]) {
    assert.match(nav, new RegExp(`assets/icons/${icon}\\.svg`));
  }
  assert.doesNotMatch(nav, /<svg\b/i);
});

test("legacy classroom snapshot retains the locked pre-task bytes", async () => {
  const bytes = await readFile(path.join(ROOT, "classroom-legacy.html"));
  const digest = normalizedTextSha256(bytes);
  assert.equal(digest, LEGACY_SHA256);
});

test("tracked public code contains no private schedule labels or forbidden dashes", async () => {
  const files = [
    path.join(ROOT, "index.html"),
    path.join(ROOT, "mission-control.html"),
    ...(await listJavaScriptFiles(path.join(ROOT, "src")))
  ];
  const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
  const combined = sources.join("\n");

  const privateLabelHashes = new Set([
    "8f1cd8978c4742dd88bbf2ff7e90d8400050a458d83b918f56df6155b5aa73db",
    "0589511a38b0471a42b27f17af23dce45a4d1391520d68cbef2423cc63926b06",
    "617691e80055b0f4c880fc33529f353e163817b68353af20858ae38fd4610946",
    "e532e49622b3677cb9c752f898db641efda10740a1261052a5bb5c1153544f47",
    "5239782b651dbc9eacb7da45bda519277b7c61c37e47c40d753fe7666219b032",
    "2d896fcb5fc39cb6451819f8399161eed315e55386103fcbfbddac8f6a23ec51"
  ]);
  for (const token of combined.toLowerCase().match(/[a-z]+/g) ?? []) {
    const digest = createHash("sha256").update(token).digest("hex");
    assert.equal(privateLabelHashes.has(digest), false);
  }
  assert.doesNotMatch(combined, /\.innerHTML\s*=/);
  assert.doesNotMatch(combined, /[\u2013\u2014]/u);
});

test("normal startup contains no demo schedule and keeps default Today copy quiet", async () => {
  const files = await listJavaScriptFiles(path.join(ROOT, "src"));
  const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
  const combined = sources.join("\n");

  assert.doesNotMatch(combined, /Teacher A|Teacher B|Studio [A-Z]\b|Evening event/);
  assert.doesNotMatch(combined, /No duty now/);
  assert.doesNotMatch(combined, /One-tap reset|Sync status|Duty weather/);
});

test("simplified shell keeps readable colors and 44px controls", async () => {
  const css = await readPublicSource("app.css");
  assert.doesNotMatch(css, /\.brand-mark\b/);
  assert.doesNotMatch(css, /\.brand-lockup strong \+ span\s*\{\s*display:\s*none/);
  assert.match(css, /--ink:\s*#243341/);
  assert.match(css, /--secondary:\s*#526576/);
  assert.match(css, /--canvas:\s*#f5f9fc/);
  assert.match(css, /min-width:\s*44px/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /\.attribution-link,\s*\n\.resource-link\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.runner-timer-bar\s*\{[^}]*top:\s*90px/s);
  assert.match(css, /\.runner-student-timers\s*\{[^}]*top:\s*8px/s);

  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex) => {
    const parts = hex.match(/[0-9a-f]{2}/gi).map((part) => channel(parseInt(part, 16)));
    return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
  };
  const contrast = (first, second) => {
    const light = Math.max(luminance(first), luminance(second));
    const dark = Math.min(luminance(first), luminance(second));
    return (light + 0.05) / (dark + 0.05);
  };

  assert.ok(contrast("243341", "f5f9fc") >= 4.5);
  assert.ok(contrast("526576", "f5f9fc") >= 4.5);
  assert.ok(contrast("101820", "edf6fc") >= 4.5);
});
