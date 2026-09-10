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
  assert.match(html, /<link[^>]+rel="icon"[^>]+href="assets\/icons\/circ-mark.svg"/);
  assert.doesNotMatch(html, /favicon\.(?:ico|svg)/i);
  assert.match(html, /<script[^>]+type="module"[^>]+src="src\/app\.js"/);
  assert.doesNotMatch(html, /<x-dc|<sc-if|<sc-for|support\.js|text\/x-dc/i);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test("public shell exposes the approved name and exact navigation", async () => {
  const html = await readPublicSource("index.html");
  assert.match(html, /<title>CIRC HQ \| The Playbook<\/title>/);
  assert.match(html, />\s*CIRC HQ\s*</);
  assert.match(html, />\s*The Playbook\s*</);
  assert.doesNotMatch(html, /class="brand-mark"/);
  assert.doesNotMatch(html, /<span[^>]*>\s*CIRC\s*<\/span>/);
  assert.doesNotMatch(html, /Mission Control|Teaching Zone/i);
  assert.match(html, /data-route="schedule"[^>]*aria-label="Schedule"/);
  assert.match(html, /data-route="settings"[^>]*aria-label="Settings"/);

  const nav = html.match(/<nav[\s\S]*?<\/nav>/i)?.[0] ?? "";
  const labels = [...nav.matchAll(/<button[^>]+aria-label="([^"]+)"[^>]*>/gi)].map(
    (match) => match[1].trim()
  );
  assert.deepEqual(labels, [
    "Today",
    "Playbooks",
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

test("release documentation names the CIRC HQ repository URL and current content scope", async () => {
  const readme = await readPublicSource("README.md");

  assert.match(readme, /^# CIRC HQ \| The Playbook$/m);
  assert.match(readme, /Repository: `percycodesiOS\/CIRC-HQ`/);
  assert.match(readme, /Intended release URL: `https:\/\/percycodesios\.github\.io\/CIRC-HQ\/`/);
  assert.match(readme, /one shared 36-experience Grades 5-6 yearly path/i);
  assert.match(readme, /does not publish those raw documents/i);
  assert.doesNotMatch(readme, /https:\/\/percycodesios\.github\.io\/5_MissionControl_6\//);
  assert.doesNotMatch(readme, /127\.0\.0\.1:4173/);
  assert.match(readme, /127\.0\.0\.1:4273/);
});

test("release documentation makes the ordinary editor primary without requiring a file", async () => {
  const readme = await readPublicSource("README.md");

  assert.match(readme, /Set up my schedule/i);
  assert.match(readme, /ordinary schedule editor/i);
  assert.match(readme, /does not require a plan file/i);
  assert.match(readme, /Advanced backup/i);
  assert.match(readme, /backup and restore/i);
  assert.doesNotMatch(readme, /Choose a private teacher-plan JSON file/i);
  assert.doesNotMatch(readme, /each import their own one-teacher private file/i);
});

test("release documentation preserves preview ready and start boundaries", async () => {
  const readme = await readPublicSource("README.md");

  assert.match(readme, /Preview a lesson/i);
  assert.match(readme, /memory-only/i);
  assert.match(readme, /nothing from Preview is saved or synced/i);
  assert.match(readme, /Open class runner creates a Ready runner/i);
  assert.match(readme, /Ready clocks are stationary/i);
  assert.match(readme, /Start class is the only action that starts the clocks/i);
});

test("release documentation keeps sync and Room optional and preserves privacy gates", async () => {
  const readme = await readPublicSource("README.md");

  assert.match(readme, /Private sync is optional/i);
  assert.match(readme, /explicit Google sign-in/i);
  assert.match(readme, /explicit cloud write/i);
  assert.match(readme, /Room is optional/i);
  assert.match(readme, /UID-scoped private cloud namespace/i);
  assert.match(readme, /trusted members/i);
  assert.match(readme, /Board and Student remain account-free/i);
  assert.match(readme, /Ready, Repeat, and Park each require Confirm/i);
});

test("release documentation does not call the intended URL live before authorization and verification", async () => {
  const readme = await readPublicSource("README.md");

  assert.match(readme, /not called live/i);
  assert.match(readme, /authorized push/i);
  assert.match(readme, /deploy verification/i);
  assert.match(readme, /HTTP 200/i);
  assert.match(readme, /clean-browser acceptance/i);
  assert.doesNotMatch(readme, /[\u2013\u2014]/u);
});

test("release documentation states classroom behavior and excluded data truthfully", async () => {
  const [readme, firebaseGate] = await Promise.all([
    readPublicSource("README.md"),
    readPublicSource("docs/FIREBASE-ACTIVATION-GATE.md")
  ]);

  assert.match(readme, /schedule-aware class clock/i);
  assert.match(readme, /Question Detour/);
  assert.match(readme, /Safe Landing/);
  assert.match(readme, /compact cues/i);
  assert.match(readme, /early-finish guidance/i);
  assert.match(readme, /no grades, gradebook, student accounts, rosters, or performance records/i);
  assert.match(readme, /configured Firebase project/i);
  assert.match(firebaseGate, /configured Firebase project/i);
  assert.match(readme, /not proof that Google Auth is enabled/i);
  assert.match(firebaseGate, /not proof that Google Auth is enabled/i);
  assert.match(readme, /old Mission Control repository and site remain separate/i);
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
  const commandBarRule = /\.runner-command-bar\s*\{([^}]*)\}/s.exec(css)?.[1] ?? "";
  assert.match(commandBarRule, /position:\s*sticky/);
  assert.match(
    commandBarRule,
    /top:\s*calc\(8px \+ env\(safe-area-inset-top\)\);/,
    "the focused runner command bar should use the top edge released by its hidden site header"
  );
  assert.match(
    css,
    /html,\s*\nbody\s*\{[^}]*overflow-x:\s*clip;/s,
    "the document must not create an overflow scroll container that breaks sticky lesson controls"
  );
  assert.match(
    css,
    /\.runner-controls\.runner-command-controls\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s,
    "phone lesson controls must stay in one four-button row"
  );
  assert.match(
    css,
    /\.runner-controls\.runner-command-controls\s*\{[^}]*margin:\s*0;[^}]*gap:\s*7px;/s,
    "the ordinary runner-control margins must not inflate the sticky command bar"
  );
  assert.match(
    css,
    /\.runner-command-bar \[data-runner-timer="class"\]\s*\{[^}]*font-size:/s,
    "the narrower class clock needs its own fit-safe value size"
  );
  assert.match(
    css,
    /@media \(max-width:\s*900px\)\s*\{[\s\S]*?\.runner-command-bar,[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/s,
    "tablet-width runner controls must stack before their desktop minimum columns can clip"
  );
  assert.doesNotMatch(
    css,
    /\.runner-focus-art\s*\{[^}]*grid-row:\s*1;/s,
    "phone layouts must keep current directions before optional artwork"
  );
  assert.match(
    css,
    /\.runner-command-controls \.runner-control\s*\{[^}]*font-size:\s*0\.8rem;/s,
    "phone command labels must remain glance-readable"
  );
  const stepRailRule = /\.runner-step-rail\s*\{([^}]*)\}/s.exec(css)?.[1] ?? "";
  assert.match(stepRailRule, /repeat\(auto-fit,\s*minmax\(92px, 1fr\)\)/);
  assert.doesNotMatch(stepRailRule, /repeat\(9,/);
  assert.match(
    css,
    /@media \(max-width:\s*900px\)\s*\{[\s\S]*?\.runner-step-rail\s*\{[^}]*grid-auto-flow:\s*column;[^}]*grid-auto-columns:/s,
    "tablet and phone rails should create one scrolling track per real lesson step"
  );
  assert.match(
    css,
    /@media \(max-width:\s*620px\)\s*\{[\s\S]*?\.runner-schedule\s*\{[^}]*white-space:\s*nowrap;/s,
    "phone class and cleanup times should remain on one readable line"
  );
  assert.match(
    css,
    /@media \(max-width:\s*420px\)\s*\{[\s\S]*?\.schedule-editor-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s,
    "phone schedule tabs must not force the schedule form wider than the viewport"
  );

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

test("disabled actions are visibly muted, retain opaque contrast, and never show a pointer cursor", async () => {
  const css = await readPublicSource("app.css");
  const rule = /button:disabled\s*\{([^}]*)\}/i.exec(css)?.[1] ?? "";
  assert.match(rule, /cursor:\s*not-allowed/i);
  assert.match(rule, /opacity:\s*1(?:\.0+)?\s*;/i);
  assert.match(rule, /background(?:-color)?:\s*#[0-9a-f]{6}\s*;/i);
  assert.match(rule, /color:\s*#[0-9a-f]{6}\s*;/i);
});
