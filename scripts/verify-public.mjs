import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getPublicStaticManifest } from "./dev-server.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const LEGACY_NORMALIZED_SHA256 =
  "6E7FF5AA3B15A57A44F0D3351C6C6A5A3B3D14813E9B5616AF3D138C5E41B69F";
const EXPECTED_ROOT_GITIGNORE = "/.superpowers/\n/.worktrees/\n/.firebase/\n/.firebaserc\n/firebase-debug.log\n/firestore-debug.log\n/ui-debug.log\n/node_modules/\n";
const ALLOWED_UNTRACKED = new Set([
  "_config.yml",
  "design-qa.md",
  "assets/circ-hq-maker.webp",
  "assets/designers-challenge-sketch.webp",
  "assets/icons/LICENSE-phosphor.txt",
  "assets/icons/arrow-right.svg",
  "assets/icons/books.svg",
  "assets/icons/calendar-dots.svg",
  "assets/icons/chalkboard-teacher.svg",
  "assets/icons/cloud-lightning.svg",
  "assets/icons/cloud-rain.svg",
  "assets/icons/cloud-sun.svg",
  "assets/icons/cloud.svg",
  "assets/icons/download-simple.svg",
  "assets/icons/gear-six.svg",
  "assets/icons/house.svg",
  "assets/icons/play-circle.svg",
  "assets/icons/presentation-chart.svg",
  "assets/icons/snowflake.svg",
  "assets/icons/student.svg",
  "assets/icons/sun.svg",
  "assets/icons/warning-circle.svg",
  "assets/tech-terrarium-hero.webp",
  "src/model/admin-plan.js",
  "src/model/experience-runner.js",
  "src/model/experience-timing-plans.js",
  "src/model/project-catalog.js",
  "src/model/shared-artifact.js",
  "src/model/schema-admission.js",
  "src/model/step-timer.js",
  "src/model/setup-flow.js",
  "src/ui/project-home.js",
  "scripts/verify-public.mjs",
  "tests/admin-plan.test.mjs",
  "tests/experience-runner.test.mjs",
  "tests/experience-timing-plans.test.mjs",
  "tests/project-catalog.test.mjs",
  "tests/project-home.test.mjs",
  "tests/shared-artifact.test.mjs",
  "tests/step-timer.test.mjs",
  "tests/security.test.mjs"
]);
const FORBIDDEN_CANDIDATE_ROOTS = new Set([
  ".git",
  ".superpowers",
  "internal",
  "node_modules",
  "private",
  "private-data",
  "test-results"
]);
const GATE_NAMES = Object.freeze([
  "candidate-boundary",
  "pages-boundary",
  "runtime-import-boundary",
  "entrypoint-identity",
  "legacy-lock",
  "asset-lock",
  "firebase-placeholders",
  "typography-scan",
  "credential-scan",
  "local-path-scan",
  "privacy-sentinel-scan",
  "public-runtime-policy",
  "dom-sink-scan",
  "server-allowlist",
  "javascript-syntax",
  "node-tests"
]);
const EXPECTED_PUBLIC_MANIFEST = Object.freeze([
  "app.css",
  "assets/circ-hq-maker.webp",
  "assets/designers-challenge-sketch.webp",
  "assets/icons/arrow-right.svg",
  "assets/icons/books.svg",
  "assets/icons/calendar-dots.svg",
  "assets/icons/chalkboard-teacher.svg",
  "assets/icons/cloud-lightning.svg",
  "assets/icons/cloud-rain.svg",
  "assets/icons/cloud-sun.svg",
  "assets/icons/cloud.svg",
  "assets/icons/download-simple.svg",
  "assets/icons/gear-six.svg",
  "assets/icons/house.svg",
  "assets/icons/play-circle.svg",
  "assets/icons/presentation-chart.svg",
  "assets/icons/snowflake.svg",
  "assets/icons/student.svg",
  "assets/icons/sun.svg",
  "assets/icons/warning-circle.svg",
  "assets/tech-terrarium-hero.webp",
  "index.html",
  "mission-control.html",
  "src/app.js",
  "src/model/access.js",
  "src/model/admin-plan.js",
  "src/model/experience-runner.js",
  "src/model/experience-timing-plans.js",
  "src/model/lesson-guide.js",
  "src/model/project-catalog.js",
  "src/model/schedule.js",
  "src/model/schema-admission.js",
  "src/model/shared-artifact.js",
  "src/model/state.js",
  "src/model/setup-flow.js",
  "src/model/step-timer.js",
  "src/model/teacher-plan-v1.js",
  "src/model/teacher-plan.js",
  "src/services/weather.js",
  "src/storage/local-store.js",
  "src/ui/board.js",
  "src/ui/project-home.js",
  "src/ui/room.js",
  "src/ui/settings.js",
  "src/ui/today-ui.js",
  "src/ui/view-model.js"
]);
const REVIEWED_CANDIDATE_MANIFEST = new Set([
  "_config.yml",
  ".gitignore",
  "BUILDLOG.md",
  "design-qa.md",
  "README.md",
  ...EXPECTED_PUBLIC_MANIFEST,
  "assets/icons/LICENSE-phosphor.txt",
  "classroom-legacy.html",
  "docs/FIREBASE-ACTIVATION-GATE.md",
  "docs/superpowers/plans/2026-09-01-circ-hq-cloud-setup.md",
  "docs/superpowers/specs/2026-09-01-circ-hq-cloud-setup-design.md",
  "firebase-config.example.js",
  ".firebaserc.example",
  "firebase.json",
  "firestore.rules",
  "package-lock.json",
  "package.json",
  "scripts/dev-server.mjs",
  "scripts/verify-public.mjs",
  "src/storage/cloud-domains.js",
  "src/storage/cloud-sync.js",
  "src/storage/firebase-adapter.js",
  "src/storage/room-sync.js",
  "src/storage/sync-engine.js",
  "src/model/experience-runner.js",
  "src/model/experience-timing-plans.js",
  "src/model/step-timer.js",
  "src/ui/curriculum.js",
  "tests/access.test.mjs",
  "tests/admin-plan.test.mjs",
  "tests/app-render.test.mjs",
  "tests/board-view.test.mjs",
  "tests/cloud-domains.test.mjs",
  "tests/cloud-sync.test.mjs",
  "tests/dev-server.test.mjs",
  "tests/firestore-rules.test.mjs",
  "tests/firebase-adapter.test.mjs",
  "tests/room-sync.test.mjs",
  "tests/experience-runner.test.mjs",
  "tests/experience-timing-plans.test.mjs",
  "tests/lesson-guide.test.mjs",
  "tests/local-store.test.mjs",
  "tests/public-shell.test.mjs",
  "tests/release-final-fixes.test.mjs",
  "tests/project-catalog.test.mjs",
  "tests/project-home.test.mjs",
  "tests/schedule.test.mjs",
  "tests/security.test.mjs",
  "tests/shared-artifact.test.mjs",
  "tests/settings.test.mjs",
  "tests/state.test.mjs",
  "tests/sync-engine.test.mjs",
  "tests/setup-flow.test.mjs",
  "tests/step-timer.test.mjs",
  "tests/teacher-plan-v1.test.mjs",
  "tests/teacher-plan.test.mjs",
  "tests/today-render.test.mjs",
  "tests/today-ui.test.mjs",
  "tests/view-model.test.mjs",
  "tests/weather.test.mjs"
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
  ".rules",
  ".yml",
  ".md",
  ".mjs",
  ".svg",
  ".txt"
]);
const REVIEWED_BINARY_ASSETS = new Map([
  [
    "assets/circ-hq-maker.webp",
    "5F725CE9D91E94BD753435F493892CAC0B3FB63C73E48F5A45608348118204A3"
  ],
  [
    "assets/designers-challenge-sketch.webp",
    "207704BEEF933454EE3BEFF35C345F940605E946E60FD786409E5A1A3AA5F17F"
  ],
  [
    "assets/tech-terrarium-hero.webp",
    "0854D643412ADAF5F720818DB9F665397D1942C721CDFCC096CA1A80A9DE2109"
  ]
]);

function normalizedPath(value) {
  return String(value).replaceAll("\\", "/");
}

function normalizedText(value) {
  let text;
  try {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  const normalized = text.replaceAll("\r\n", "\n");
  return normalized.includes("\r") ? null : normalized;
}

export function normalizedTextSha256(value) {
  const normalized = normalizedText(value);
  return normalized === null
    ? null
    : createHash("sha256").update(normalized, "utf8").digest("hex").toUpperCase();
}

export async function inspectReleaseLocks(root = ROOT) {
  const [legacyBytes, firebaseBytes] = await Promise.all([
    readFile(path.join(root, "classroom-legacy.html")),
    readFile(path.join(root, "firebase-config.example.js"))
  ]);
  return {
    legacyOk: normalizedTextSha256(legacyBytes) === LEGACY_NORMALIZED_SHA256,
    firebaseOk: normalizedText(firebaseBytes) === EXPECTED_FIREBASE_EXAMPLE
  };
}

export async function inspectAssetLocks(root = ROOT) {
  let violations = 0;
  for (const [relativePath, expectedHash] of REVIEWED_BINARY_ASSETS) {
    try {
      const bytes = await readFile(path.join(root, ...relativePath.split("/")));
      const actualHash = createHash("sha256").update(bytes).digest("hex").toUpperCase();
      if (actualHash !== expectedHash) violations += 1;
    } catch {
      violations += 1;
    }
  }
  return violations === 0
    ? { ok: true, count: REVIEWED_BINARY_ASSETS.size }
    : { ok: false, count: violations };
}

export async function inspectRepositoryIgnore(root = ROOT) {
  try {
    const ignoreBytes = await readFile(path.join(root, ".gitignore"));
    return normalizedText(ignoreBytes) === EXPECTED_ROOT_GITIGNORE;
  } catch {
    return false;
  }
}

function isForbiddenCandidatePath(value) {
  const candidate = normalizedPath(value);
  const segments = candidate.split("/");
  if (
    candidate === "" ||
    candidate.startsWith("/") ||
    /^[a-z]:/i.test(candidate) ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) return true;
  if (!new Set([".gitignore", ".firebaserc.example"]).has(candidate) && segments.some((segment) => segment.startsWith("."))) {
    return true;
  }
  const root = segments[0].toLowerCase();
  return FORBIDDEN_CANDIDATE_ROOTS.has(root) ||
    segments.some((segment) => segment.toLowerCase() === "__private__");
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
  let forbiddenCandidateCount = 0;
  let unreviewedCandidateCount = 0;
  let unsupportedCandidateCount = 0;

  for (const rawPath of candidatePaths) {
    const candidate = normalizedPath(rawPath);
    if (isForbiddenCandidatePath(candidate)) forbiddenCandidateCount += 1;
    if (!REVIEWED_CANDIDATE_MANIFEST.has(candidate)) unreviewedCandidateCount += 1;
    if (!isSupportedCandidate(candidate)) unsupportedCandidateCount += 1;
    if (tracked.has(candidate)) trackedCount += 1;
    else if (ALLOWED_UNTRACKED.has(candidate)) allowedUntrackedCount += 1;
    else unexpectedUntrackedCount += 1;
  }

  return {
    candidateCount: candidatePaths.length,
    trackedCount,
    allowedUntrackedCount,
    unexpectedUntrackedCount,
    forbiddenCandidateCount,
    unreviewedCandidateCount,
    unsupportedCandidateCount
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

function gitListAt(root, argumentsList) {
  const result = runProcess("git", argumentsList, { cwd: root });
  if (result.status !== 0 || result.error) throw new Error("git-list-failed");
  return parseNulList(result.stdout);
}

function gitList(argumentsList) {
  return gitListAt(ROOT, argumentsList);
}

function candidateBoundaryResult(candidatePaths, trackedPaths) {
  const counts = classifyCandidatePaths(candidatePaths, trackedPaths);
  const tracked = new Set(trackedPaths.map(normalizedPath));
  const violations = candidatePaths.reduce((count, rawPath) => {
    const candidate = normalizedPath(rawPath);
    const unexpected = !tracked.has(candidate) && !ALLOWED_UNTRACKED.has(candidate);
    const violates = unexpected ||
      isForbiddenCandidatePath(candidate) ||
      !REVIEWED_CANDIDATE_MANIFEST.has(candidate) ||
      !isSupportedCandidate(candidate);
    return count + Number(violates);
  }, 0);
  return {
    ok: violations === 0,
    count: violations === 0 ? counts.candidateCount : violations,
    ...counts
  };
}

export function inspectCandidateBoundary(root = ROOT) {
  return candidateBoundaryResult(
    gitListAt(root, ["ls-files", "-co", "--exclude-standard", "-z"]),
    gitListAt(root, ["ls-files", "-z"])
  );
}

function isAutomaticallyJekyllHidden(relativePath) {
  const candidate = normalizedPath(relativePath);
  return candidate === "_config.yml" || candidate.split("/").some((segment) =>
    segment.startsWith(".") || segment.startsWith("_")
  );
}

export function parseJekyllExcludes(value) {
  const text = normalizedText(value);
  if (text === null) return null;
  let insideExcludeList = false;
  const excludes = [];
  for (const line of text.split("\n")) {
    if (line === "" || line.startsWith("#")) continue;
    if (!insideExcludeList) {
      if (line !== "exclude:") return null;
      insideExcludeList = true;
      continue;
    }
    const match = line.match(/^  - (\.?[A-Za-z0-9][A-Za-z0-9._/-]*)$/);
    if (!match) return null;
    const exclusion = normalizedPath(match[1]);
    if (
      exclusion.endsWith("/") ||
      isForbiddenCandidatePath(exclusion) ||
      excludes.includes(exclusion)
    ) return null;
    excludes.push(exclusion);
  }
  return insideExcludeList ? excludes : null;
}

function isExactlyExcluded(relativePath, exclusions) {
  const candidate = normalizedPath(relativePath);
  return exclusions.some((exclusion) =>
    candidate === exclusion || candidate.startsWith(`${exclusion}/`)
  );
}

export function pagesPublicationBoundaryResult(candidatePaths, exclusions) {
  if (!Array.isArray(exclusions)) return { ok: false, count: 1 };
  const runtime = new Set(EXPECTED_PUBLIC_MANIFEST);
  let violations = 0;
  for (const rawPath of candidatePaths) {
    const candidate = normalizedPath(rawPath);
    const hidden = isAutomaticallyJekyllHidden(candidate);
    const excluded = isExactlyExcluded(candidate, exclusions);
    if (runtime.has(candidate)) {
      violations += Number(hidden || excluded);
    } else {
      violations += Number(!hidden && !excluded);
    }
  }
  return violations === 0
    ? { ok: true, count: candidatePaths.length }
    : { ok: false, count: violations };
}

export async function inspectPagesPublicationBoundary(root = ROOT) {
  const candidates = gitListAt(root, ["ls-files", "-co", "--exclude-standard", "-z"]);
  try {
    const config = await readFile(path.join(root, "_config.yml"));
    return pagesPublicationBoundaryResult(candidates, parseJekyllExcludes(config));
  } catch {
    return { ok: false, count: 1 };
  }
}

function staticModuleSpecifiers(source) {
  const specifiers = [];
  const pattern = /^\s*(?:import\s+(?:(?:[\s\S]*?)\s+from\s+)?|export\s+(?:[\s\S]*?)\s+from\s+)["']([^"']+)["']/gm;
  for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  return specifiers;
}

function resolveRelativeModulePath(importer, specifier) {
  if (typeof specifier !== "string" || !specifier.startsWith(".")) return null;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
  return resolved.startsWith("src/") && resolved.endsWith(".js") ? resolved : null;
}

export async function inspectRuntimeImportBoundary(root = ROOT) {
  const runtime = new Set(EXPECTED_PUBLIC_MANIFEST);
  const pending = ["src/app.js"];
  const inspected = new Set();
  let violations = 0;

  while (pending.length > 0) {
    const importer = pending.pop();
    if (inspected.has(importer)) continue;
    inspected.add(importer);

    let source;
    try {
      source = await readFile(path.join(root, ...importer.split("/")), "utf8");
    } catch {
      violations += 1;
      continue;
    }

    for (const specifier of staticModuleSpecifiers(source)) {
      const imported = resolveRelativeModulePath(importer, specifier);
      if (!imported || !runtime.has(imported)) {
        violations += 1;
        continue;
      }
      pending.push(imported);
    }
  }

  return violations === 0
    ? { ok: true, count: inspected.size }
    : { ok: false, count: violations };
}

function isTextCandidate(relativePath) {
  const basename = path.posix.basename(relativePath);
  return basename === ".gitignore" || basename === ".firebaserc.example" ||
    basename === "README" ||
    TEXT_EXTENSIONS.has(path.posix.extname(relativePath));
}

function isSupportedCandidate(relativePath) {
  return isTextCandidate(relativePath) || REVIEWED_BINARY_ASSETS.has(relativePath);
}

async function readCandidate(root, relativePath) {
  return readFile(path.join(root, ...relativePath.split("/")), "utf8");
}

async function createContext(root) {
  const candidates = gitListAt(root, ["ls-files", "-co", "--exclude-standard", "-z"]);
  const tracked = gitListAt(root, ["ls-files", "-z"]);
  const reviewedCandidates = candidates.filter((candidate) =>
    REVIEWED_CANDIDATE_MANIFEST.has(candidate) &&
    !isForbiddenCandidatePath(candidate) &&
    isSupportedCandidate(candidate)
  );
  const textPaths = reviewedCandidates.filter(isTextCandidate);
  const trackedTextPaths = tracked.filter(isTextCandidate);
  const textEntries = await Promise.all(textPaths.map(async (relativePath) => ({
    relativePath,
    text: await readCandidate(root, relativePath)
  })));
  const trackedTextEntries = await Promise.all(trackedTextPaths.map(async (relativePath) => ({
    relativePath,
    text: await readCandidate(root, relativePath)
  })));
  return { root, candidates, tracked, reviewedCandidates, textEntries, trackedTextEntries };
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

export function countLocalPathViolations(text) {
  const slash = "[\\\\/]";
  const dotCodex = ["\\.", "codex"].join("");
  const unixUsers = ["/", "Users", "/"].join("");
  const unixHome = ["/", "home", "/"].join("");
  const tildeHome = ["~", "/"].join("");
  const dollarHome = ["\\$", "(?:\\{)?", "HOME", "(?:\\})?"].join("");
  const userProfile = [
    "(?:%", "USERPROFILE", "%|\\$", "(?:env:)?", "USERPROFILE", "|\\$\\{", "USERPROFILE", "\\})"
  ].join("");
  const homeDrive = ["HOME", "DRIVE"].join("");
  const homePath = ["HOME", "PATH"].join("");
  const homeDrivePath = [
    "(?:%", homeDrive, "%%", homePath, "%|",
    "\\$(?:env:)?", homeDrive, "\\$(?:env:)?", homePath, "|",
    "\\$\\{", homeDrive, "\\}\\$\\{", homePath, "\\})"
  ].join("");
  const patterns = [
    new RegExp(`(?:^|[\\s(\"'\\x60=])[A-Za-z]:${slash}[^\\s<>\"']+`, "i"),
    /(?:^|[\s("'`=])\\\\(?:\?\\(?:UNC\\)?|\.\\)?[a-z0-9._:-]+[\\/][^\s<>"']+/i,
    /file:(?:\/\/\/[A-Za-z]:[\\/]|\/\/[^/\s]+\/)[^\s<>"']+/i,
    new RegExp(`(?:^|${slash})${dotCodex}(?:${slash}|$)`, "im"),
    new RegExp(`${unixUsers}[^/\\s]+(?:/[^\\s<>\"']*)?`),
    new RegExp(`${unixHome}[^/\\s]+(?:/[^\\s<>\"']*)?`),
    new RegExp(`(?:^|[\\s(\"'\\x60])${tildeHome}[^\\s<>\"']*`),
    new RegExp(`${dollarHome}(?:${slash}|\\b)`),
    new RegExp(`${userProfile}(?:${slash}|\\b)`, "i"),
    new RegExp(`${homeDrivePath}(?:${slash}|\\b)`, "i")
  ];
  return String(text).split(/\r?\n/).reduce(
    (count, line) => count + Number(patterns.some((pattern) => pattern.test(line))),
    0
  );
}

export async function inspectLocalPaths(root = ROOT) {
  const tracked = gitListAt(root, ["ls-files", "-z"]);
  const textPaths = tracked.filter(isTextCandidate);
  let violations = 0;
  for (const relativePath of textPaths) {
    violations += countLocalPathViolations(await readCandidate(root, relativePath));
  }
  return resultFromViolations(textPaths.length, violations);
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
    (relativePath.startsWith("assets/icons/") && relativePath.endsWith(".svg")) ||
    (relativePath.startsWith("src/") && relativePath.endsWith(".js"));
}

async function candidateBoundaryGate(context) {
  const result = candidateBoundaryResult(context.candidates, context.tracked);
  const ignoreEntry = context.textEntries.find((entry) => entry.relativePath === ".gitignore");
  const ignoreViolation = Number(
    !ignoreEntry || normalizedText(ignoreEntry.text) !== EXPECTED_ROOT_GITIGNORE
  );
  if (result.ok && ignoreViolation === 0) return { ok: true, count: result.count };
  return {
    ok: false,
    count: (result.ok ? 0 : result.count) + ignoreViolation
  };
}

async function pagesBoundaryGate(context) {
  try {
    const config = await readFile(path.join(context.root, "_config.yml"));
    return pagesPublicationBoundaryResult(context.candidates, parseJekyllExcludes(config));
  } catch {
    return { ok: false, count: 1 };
  }
}

async function runtimeImportBoundaryGate(context) {
  return inspectRuntimeImportBoundary(context.root);
}

async function entrypointIdentityGate(context) {
  const [indexBytes, mirrorBytes] = await Promise.all([
    readFile(path.join(context.root, "index.html")),
    readFile(path.join(context.root, "mission-control.html"))
  ]);
  return resultFromViolations(2, Number(!indexBytes.equals(mirrorBytes)));
}

async function legacyLockGate(context) {
  const locks = await inspectReleaseLocks(context.root);
  return resultFromViolations(1, Number(!locks.legacyOk));
}

async function assetLockGate(context) {
  return inspectAssetLocks(context.root);
}

async function firebasePlaceholdersGate(context) {
  const locks = await inspectReleaseLocks(context.root);
  return resultFromViolations(1, Number(!locks.firebaseOk));
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

async function localPathGate(context) {
  let violations = 0;
  for (const entry of context.trackedTextEntries) {
    violations += countLocalPathViolations(entry.text);
  }
  return resultFromViolations(context.trackedTextEntries.length, violations);
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
  const scripts = context.reviewedCandidates.filter((candidate) => /\.(?:js|mjs)$/i.test(candidate));
  let violations = 0;
  for (const relativePath of scripts) {
    const result = runProcess(process.execPath, ["--check", relativePath], { cwd: context.root });
    if (result.status !== 0 || result.error) violations += 1;
  }
  return resultFromViolations(scripts.length, violations);
}

async function nodeTestsGate(context) {
  const tests = context.reviewedCandidates.filter(
    (candidate) => candidate.startsWith("tests/") && candidate.endsWith(".test.mjs")
  );
  if (tests.length === 0) return passCount(0);
  const result = runProcess(process.execPath, ["--test", ...tests], { cwd: context.root });
  return resultFromViolations(tests.length, Number(result.status !== 0 || Boolean(result.error)));
}

const GATES = Object.freeze([
  ["candidate-boundary", candidateBoundaryGate],
  ["pages-boundary", pagesBoundaryGate],
  ["runtime-import-boundary", runtimeImportBoundaryGate],
  ["entrypoint-identity", entrypointIdentityGate],
  ["legacy-lock", legacyLockGate],
  ["asset-lock", assetLockGate],
  ["firebase-placeholders", firebasePlaceholdersGate],
  ["typography-scan", typographyGate],
  ["credential-scan", credentialGate],
  ["local-path-scan", localPathGate],
  ["privacy-sentinel-scan", privacySentinelGate],
  ["public-runtime-policy", publicRuntimePolicyGate],
  ["dom-sink-scan", domSinkGate],
  ["server-allowlist", serverAllowlistGate],
  ["javascript-syntax", javascriptSyntaxGate],
  ["node-tests", nodeTestsGate]
]);

export async function runPublicVerification(root = ROOT) {
  const resolvedRoot = path.resolve(root);
  const results = new Map();
  let testContext;
  try {
    testContext = await createContext(resolvedRoot);
  } catch {
    for (const name of GATE_NAMES) process.stdout.write(`FAIL ${name} count=1\n`);
    return false;
  }

  async function runGate(name, gate, context) {
    let result;
    try {
      result = await gate(context);
    } catch {
      result = { ok: false, count: 1 };
    }
    results.set(name, result);
  }

  await runGate("node-tests", nodeTestsGate, testContext);

  let syntaxContext;
  try {
    syntaxContext = await createContext(resolvedRoot);
    await runGate("javascript-syntax", javascriptSyntaxGate, syntaxContext);
  } catch {
    results.set("javascript-syntax", { ok: false, count: 1 });
  }

  let finalContext;
  try {
    finalContext = await createContext(resolvedRoot);
    for (const [name, gate] of GATES) {
      if (name === "node-tests" || name === "javascript-syntax") continue;
      await runGate(name, gate, finalContext);
    }
  } catch {
    for (const [name] of GATES) {
      if (!results.has(name)) results.set(name, { ok: false, count: 1 });
    }
  }

  let passed = true;
  for (const name of GATE_NAMES) {
    const result = results.get(name) ?? { ok: false, count: 1 };
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
