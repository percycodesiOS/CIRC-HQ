import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const LEGACY_SHA256 =
  "5DF75CEA0693920856A95949F6EFBBE54961EAA77117637EA433D786AF5205E3";

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
  assert.match(html, /<script[^>]+type="module"[^>]+src="src\/app\.js"/);
  assert.doesNotMatch(html, /<x-dc|<sc-if|<sc-for|support\.js|text\/x-dc/i);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test("public shell exposes the approved name and exact navigation", async () => {
  const html = await readPublicSource("index.html");
  assert.match(html, />\s*CIRC HQ\s*</);
  assert.match(html, />\s*The Playbook\s*</);
  assert.doesNotMatch(html, /Mission Control|Teaching Zone/i);

  const nav = html.match(/<nav[\s\S]*?<\/nav>/i)?.[0] ?? "";
  const labels = [...nav.matchAll(/<button[^>]*>([^<]+)<\/button>/gi)].map(
    (match) => match[1].trim()
  );
  assert.deepEqual(labels, [
    "Today",
    "Curriculum",
    "Schedule",
    "Room",
    "Settings"
  ]);
});

test("legacy classroom snapshot retains the locked pre-task bytes", async () => {
  const bytes = await readFile(path.join(ROOT, "classroom-legacy.html"));
  const digest = createHash("sha256").update(bytes).digest("hex").toUpperCase();
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
