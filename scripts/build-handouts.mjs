// Build one student handout PDF per unique lesson from the live lesson data.
//
//   node scripts/build-handouts.mjs            write every PDF to assets/handouts
//   node scripts/build-handouts.mjs --only Logo-to-Jingle
//   node scripts/build-handouts.mjs --locks    print the verifier lock lines
//   node scripts/build-handouts.mjs --check    exit 1 if any PDF is missing or differs
//
// Needs the playwright-core dev dependency plus a Chromium-based browser:
// set CIRC_CHROME to a browser executable, or CIRC_CHROME_CHANNEL to
// "chrome" or "msedge" to use the installed browser. Nothing is downloaded.
// Output is tagged (PDF/UA structure), bookmarked from the headings, real
// text, letter size, with page numbers. The two timestamp strings Chromium
// writes are replaced by a fixed value so a rebuild from unchanged lesson
// data produces identical bytes and the asset lock still matches.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { HANDOUT_FOLDER, listHandouts } from "../src/model/lesson-finder.js";
import { renderHandoutHtml } from "./handout-template.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const FIXED_DATE = "D:20261011000000+00'00'";

function parseArgs(argv) {
  const options = { only: null, locks: false, check: false, manifest: false, out: HANDOUT_FOLDER };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--only") options.only = argv[++index] ?? null;
    else if (value === "--locks") options.locks = true;
    else if (value === "--check") options.check = true;
    else if (value === "--manifest") options.manifest = true;
    else if (value === "--out") options.out = argv[++index] ?? options.out;
  }
  return options;
}

export function stabilizePdfDates(bytes) {
  // Same-length replacement keeps every cross-reference offset valid.
  const text = bytes.toString("latin1");
  const replaced = text.replace(/D:\d{14}[+-]\d{2}'\d{2}'/g, FIXED_DATE);
  return Buffer.from(replaced, "latin1");
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

async function launchBrowser() {
  let playwright;
  try {
    playwright = await import("playwright-core");
  } catch {
    throw new Error("playwright-core is not installed. Run: npm install --save-dev playwright-core");
  }
  const executablePath = process.env.CIRC_CHROME || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
  const channel = !executablePath ? (process.env.CIRC_CHROME_CHANNEL || "chrome") : undefined;
  return playwright.chromium.launch({ executablePath, channel, args: ["--no-sandbox"] });
}

export function footerTemplate(fileName) {
  return `<div style="width:100%;padding:0 14mm;display:flex;justify-content:space-between;font-family:'Nunito Sans','Segoe UI',system-ui,sans-serif;font-size:8pt;color:#52618a"><span>${fileName}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
}

export async function renderHandoutPdf(page, entry) {
  const html = renderHandoutHtml(entry);
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts?.ready);
  const bytes = await page.pdf({
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
    tagged: true,
    outline: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: footerTemplate(path.posix.basename(entry.files.pdf))
  });
  return stabilizePdfDates(bytes);
}

export async function buildHandouts({ only = null, out = HANDOUT_FOLDER, check = false, log = () => {} } = {}) {
  const entries = listHandouts().filter(entry => !only || entry.stem === only);
  if (!entries.length) throw new Error(`No lesson matches ${only}`);
  const outDir = path.join(ROOT, ...out.split("/"));
  if (!check) await mkdir(outDir, { recursive: true });
  const browser = await launchBrowser();
  const results = [];
  try {
    const page = await browser.newPage();
    for (const entry of entries) {
      const bytes = await renderHandoutPdf(page, entry);
      const target = path.join(ROOT, ...entry.files.pdf.split("/"));
      let status = "written";
      if (check) {
        let existing = null;
        try { existing = await readFile(target); } catch { existing = null; }
        status = existing && existing.equals(bytes) ? "same" : existing ? "different" : "missing";
      } else {
        await writeFile(target, bytes);
      }
      results.push({ stem: entry.stem, file: entry.files.pdf, hash: sha256(bytes), bytes: bytes.length, status });
      log(`${status.padEnd(9)} ${entry.files.pdf} (${bytes.length} bytes)`);
    }
  } finally {
    await browser.close();
  }
  return results;
}

export async function hashExisting() {
  const results = [];
  for (const entry of listHandouts()) {
    for (const file of Object.values(entry.files)) {
      const target = path.join(ROOT, ...file.split("/"));
      try {
        results.push({ file, hash: sha256(await readFile(target)) });
      } catch {
        results.push({ file, hash: null });
      }
    }
  }
  return results;
}

// scripts/handout-manifest.mjs is the reviewed literal list the verifier,
// the dev server and the security test share. Only files that exist are
// listed, so a half-built set never claims a lock it cannot keep.
export async function writeManifest() {
  const results = await hashExisting();
  const present = results.filter(result => result.hash).sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0));
  const lines = present.map(result => `  ["${result.file}", "${result.hash}"]`).join(",\n");
  const text = `// Generated by: node scripts/build-handouts.mjs --manifest\n` +
    `// Public lesson handouts and response sheets with their SHA-256 locks.\n` +
    `// Rebuild the files from the live lesson data, then regenerate this list.\n` +
    `// The verifier, the dev server and the security test all read it.\n` +
    `export const HANDOUT_ASSETS = Object.freeze([\n${lines}\n]);\n` +
    `export const HANDOUT_FILES = Object.freeze(HANDOUT_ASSETS.map(([file]) => file));\n`;
  await writeFile(path.join(ROOT, "scripts", "handout-manifest.mjs"), text);
  return { present: present.length, missing: results.length - present.length };
}

const executedDirectly = process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1]).replaceAll("\\", "/")}`).href;
if (executedDirectly) {
  const options = parseArgs(process.argv.slice(2));
  if (options.locks) {
    const results = await hashExisting();
    for (const result of results) {
      process.stdout.write(result.hash ? `  ["${result.file}", "${result.hash}"],\n` : `  MISSING ${result.file}\n`);
    }
  } else if (options.manifest) {
    const summary = await writeManifest();
    process.stdout.write(`scripts/handout-manifest.mjs lists ${summary.present} files; ${summary.missing} missing.\n`);
  } else {
    const results = await buildHandouts({ ...options, log: line => process.stdout.write(`${line}\n`) });
    const bad = results.filter(result => result.status === "different" || result.status === "missing");
    if (options.check && bad.length) {
      process.stderr.write(`${bad.length} handout(s) differ from the committed files.\n`);
      process.exitCode = 1;
    }
    if (!options.check && !options.only) {
      const summary = await writeManifest();
      process.stdout.write(`scripts/handout-manifest.mjs lists ${summary.present} files; ${summary.missing} missing.\n`);
    }
  }
}
