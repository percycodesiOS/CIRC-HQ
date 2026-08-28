import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getPublicStaticManifest } from "./dev-server.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const LEGACY_SHA256 =
  "5DF75CEA0693920856A95949F6EFBBE54961EAA77117637EA433D786AF5205E3";
const ALLOWED_UNTRACKED = new Set([
  "scripts/verify-public.mjs",
  "tests/security.test.mjs"
]);
const GATE_NAMES = Object.freeze([
  "candidate-boundary",
  "entrypoint-identity",
  "legacy-lock",
  "firebase-placeholders",
  "typography-scan",
  "credential-scan",
  "privacy-sentinel-scan",
  "public-runtime-policy",
  "dom-sink-scan",
  "server-allowlist",
  "javascript-syntax",
  "node-tests"
]);
const EXPECTED_PUBLIC_MANIFEST = Object.freeze([
  "app.css",
  "classroom-legacy.html",
  "index.html",
  "mission-control.html",
  "src/app.js",
  "src/model/access.js",
  "src/model/lesson-guide.js",
  "src/model/schedule.js",
  "src/model/state.js",
  "src/model/teacher-plan-v1.js",
  "src/model/teacher-plan.js",
  "src/services/weather.js",
  "src/storage/local-store.js",
  "src/ui/board.js",
  "src/ui/curriculum.js",
  "src/ui/room.js",
  "src/ui/settings.js",
  "src/ui/today-ui.js",
  "src/ui/view-model.js"
]);
const EXPECTED_FIREBASE_EXAMPLE = `export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
`;
const PRIVATE_TOKEN_HASHES = new Set([
  "8f1cd8978c4742dd88bbf2ff7e90d8400050a458d83b918f56df6155b5aa73db",
  "0589511a38b0471a42b27f17af23dce45a4d1391520d68cbef2423cc63926b06",
  "617691e80055b0f4c880fc33529f353e163817b68353af20858ae38fd4610946",
  "e532e49622b3677cb9c752f898db641efda10740a1261052a5bb5c1153544f47",
  "5239782b651dbc9eacb7da45bda519277b7c61c37e47c40d753fe7666219b032",
  "2d896fcb5fc39cb6451819f8399161eed315e55386103fcbfbddac8f6a23ec51"
]);
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".fragment",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".txt"
]);

function normalizedPath(value) {
  return String(value).replaceAll("\\", "/");
}

export function parseNulList(value) {
  const text = Buffer.isBuffer(value) ? value.toString("utf8") : String(value ?? "");
  return text.split("\0").filter(Boolean).map(normalizedPath);
}

export function classifyCandidatePaths(candidatePaths, trackedPaths) {
  const tracked = new Set(trackedPaths.map(normalizedPath));
  let trackedCount = 0;
  let allowedUntrackedCount = 0;
  let unexpectedUntrackedCount = 0;

  for (const rawPath of candidatePaths) {
    const candidate = normalizedPath(rawPath);
    if (tracked.has(candidate)) trackedCount += 1;
    else if (ALLOWED_UNTRACKED.has(candidate)) allowedUntrackedCount += 1;
    else unexpectedUntrackedCount += 1;
  }

  return {
    candidateCount: candidatePaths.length,
    trackedCount,
    allowedUntrackedCount,
    unexpectedUntrackedCount
  };
}

export function getGateNames() {
  return [...GATE_NAMES];
}

function runProcess(command, argumentsList, options = {}) {
  return spawnSync(command, argumentsList, {
    cwd: ROOT,
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    ...options
  });
}

function gitList(argumentsList) {
  const result = runProcess("git", argumentsList);
  if (result.status !== 0 || result.error) throw new Error("git-list-failed");
  return parseNulList(result.stdout);
}

function isTextCandidate(relativePath) {
  const basename = path.posix.basename(relativePath);
  return basename === "README" || TEXT_EXTENSIONS.has(path.posix.extname(relativePath));
}

async function readCandidate(relativePath) {
  return readFile(path.join(ROOT, ...relativePath.split("/")), "utf8");
}

async function createContext() {
  const candidates = gitList(["ls-files", "-co", "--exclude-standard", "-z"]);
  const tracked = gitList(["ls-files", "-z"]);
  const textPaths = candidates.filter(isTextCandidate);
  const textEntries = await Promise.all(textPaths.map(async (relativePath) => ({
    relativePath,
    text: await readCandidate(relativePath)
  })));
  return { candidates, tracked, textEntries };
}

function passCount(count) {
  return { ok: true, count };
}

function resultFromViolations(checkedCount, violations) {
  return violations === 0
    ? passCount(checkedCount)
    : { ok: false, count: violations };
}

export function countCredentialViolations(text) {
  const patterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bAIza[0-9A-Za-z_-]{30,}\b/,
    /\bgh[pousr]_[0-9A-Za-z]{20,}\b/,
    /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.(?:edu|school|k12\.[A-Z]{2}|net)\b/i
  ];
  return patterns.reduce((count, pattern) => count + Number(pattern.test(text)), 0);
}

export function countUnsafeRuntimeLinks(text) {
  const links = text.match(/https?:\/\/[^\s"'`<>)]+/gi) ?? [];
  let unsafe = 0;
  for (const link of links) {
    let parsed;
    try {
      parsed = new URL(link);
    } catch {
      unsafe += 1;
      continue;
    }
    const allowedHttp = parsed.href === "http://www.w3.org/2000/svg" ||
      parsed.hostname === "127.0.0.1";
    const allowedHttpsHosts = new Set([
      "api.open-meteo.com",
      "circ-hq.invalid",
      "open-meteo.com",
      "www.gstatic.com"
    ]);
    if (parsed.protocol === "http:" && !allowedHttp) unsafe += 1;
    else if (parsed.protocol === "https:" && !allowedHttpsHosts.has(parsed.hostname)) unsafe += 1;
    else if (parsed.protocol !== "http:" && parsed.protocol !== "https:") unsafe += 1;
  }
  return unsafe;
}

function isPublicRuntimePath(relativePath) {
  return relativePath === "app.css" ||
    relativePath === "index.html" ||
    relativePath === "mission-control.html" ||
    (relativePath.startsWith("src/") && relativePath.endsWith(".js"));
}

async function candidateBoundaryGate(context) {
  const counts = classifyCandidatePaths(context.candidates, context.tracked);
  return counts.unexpectedUntrackedCount === 0
    ? passCount(counts.candidateCount)
    : { ok: false, count: counts.unexpectedUntrackedCount };
}

async function entrypointIdentityGate() {
  const [indexBytes, mirrorBytes] = await Promise.all([
    readFile(path.join(ROOT, "index.html")),
    readFile(path.join(ROOT, "mission-control.html"))
  ]);
  return resultFromViolations(2, Number(!indexBytes.equals(mirrorBytes)));
}

async function legacyLockGate() {
  const bytes = await readFile(path.join(ROOT, "classroom-legacy.html"));
  const digest = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  return resultFromViolations(1, Number(digest !== LEGACY_SHA256));
}

async function firebasePlaceholdersGate() {
  const source = await readFile(path.join(ROOT, "firebase-config.example.js"), "utf8");
  return resultFromViolations(1, Number(source !== EXPECTED_FIREBASE_EXAMPLE));
}

async function typographyGate(context) {
  const forbidden = new RegExp(`[${String.fromCodePoint(0x2013)}${String.fromCodePoint(0x2014)}]`, "u");
  const violations = context.textEntries.reduce(
    (count, entry) => count + Number(forbidden.test(entry.text)),
    0
  );
  return resultFromViolations(context.textEntries.length, violations);
}

async function credentialGate(context) {
  let violations = 0;
  for (const entry of context.textEntries) {
    violations += countCredentialViolations(entry.text);
  }
  return resultFromViolations(context.textEntries.length, violations);
}

async function privacySentinelGate(context) {
  let tokensChecked = 0;
  let violations = 0;
  for (const entry of context.textEntries) {
    if (entry.relativePath === "classroom-legacy.html") continue;
    for (const token of entry.text.toLowerCase().match(/[a-z]+/g) ?? []) {
      tokensChecked += 1;
      const digest = createHash("sha256").update(token).digest("hex");
      if (PRIVATE_TOKEN_HASHES.has(digest)) violations += 1;
    }
  }
  return resultFromViolations(tokensChecked, violations);
}

async function publicRuntimePolicyGate(context) {
  let violations = 0;
  let checked = 0;
  const policyPatterns = [
    /CyberGrader/i,
    /\b(?:classCode|joinCode|studentAlias|studentAccount|studentRoster)\b/i,
    /\b(?:students|studentAccounts|classCodes)\s*\//i,
    /district[^\n]{0,40}(?:logo|mark)|(?:logo|mark)[^\n]{0,40}district/i
  ];
  for (const entry of context.textEntries) {
    if (!isPublicRuntimePath(entry.relativePath)) continue;
    checked += 1;
    for (const pattern of policyPatterns) violations += Number(pattern.test(entry.text));
    violations += countUnsafeRuntimeLinks(entry.text);
  }
  return resultFromViolations(checked, violations);
}

async function domSinkGate(context) {
  const patterns = [
    /\.innerHTML\s*=/,
    /\.outerHTML\s*=/,
    /\binsertAdjacentHTML\s*\(/,
    /\bdocument\.write\s*\(/,
    /\bcreateContextualFragment\s*\(/
  ];
  let checked = 0;
  let violations = 0;
  for (const entry of context.textEntries) {
    if (!entry.relativePath.startsWith("src/") || !entry.relativePath.endsWith(".js")) continue;
    checked += 1;
    for (const pattern of patterns) violations += Number(pattern.test(entry.text));
  }
  return resultFromViolations(checked, violations);
}

async function serverAllowlistGate() {
  const actual = getPublicStaticManifest();
  const violations = Number(JSON.stringify(actual) !== JSON.stringify(EXPECTED_PUBLIC_MANIFEST));
  return resultFromViolations(actual.length, violations);
}

async function javascriptSyntaxGate(context) {
  const scripts = context.candidates.filter((candidate) => /\.(?:js|mjs)$/i.test(candidate));
  let violations = 0;
  for (const relativePath of scripts) {
    const result = runProcess(process.execPath, ["--check", relativePath]);
    if (result.status !== 0 || result.error) violations += 1;
  }
  return resultFromViolations(scripts.length, violations);
}

async function nodeTestsGate(context) {
  const testCount = context.candidates.filter(
    (candidate) => candidate.startsWith("tests/") && candidate.endsWith(".test.mjs")
  ).length;
  const result = runProcess(process.execPath, ["--test"]);
  return resultFromViolations(testCount, Number(result.status !== 0 || Boolean(result.error)));
}

const GATES = Object.freeze([
  ["candidate-boundary", candidateBoundaryGate],
  ["entrypoint-identity", entrypointIdentityGate],
  ["legacy-lock", legacyLockGate],
  ["firebase-placeholders", firebasePlaceholdersGate],
  ["typography-scan", typographyGate],
  ["credential-scan", credentialGate],
  ["privacy-sentinel-scan", privacySentinelGate],
  ["public-runtime-policy", publicRuntimePolicyGate],
  ["dom-sink-scan", domSinkGate],
  ["server-allowlist", serverAllowlistGate],
  ["javascript-syntax", javascriptSyntaxGate],
  ["node-tests", nodeTestsGate]
]);

export async function runPublicVerification() {
  let context;
  try {
    context = await createContext();
  } catch {
    for (const name of GATE_NAMES) process.stdout.write(`FAIL ${name} count=1\n`);
    return false;
  }

  let passed = true;
  for (const [name, gate] of GATES) {
    let result;
    try {
      result = await gate(context);
    } catch {
      result = { ok: false, count: 1 };
    }
    const status = result.ok ? "PASS" : "FAIL";
    const count = Number.isSafeInteger(result.count) && result.count >= 0 ? result.count : 1;
    process.stdout.write(`${status} ${name} count=${count}\n`);
    if (!result.ok) passed = false;
  }
  return passed;
}

const executedDirectly = process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (executedDirectly) {
  const passed = await runPublicVerification();
  if (!passed) process.exitCode = 1;
}
