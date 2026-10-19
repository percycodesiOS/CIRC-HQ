import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { GUIDES, renderResourceHub } from "../src/resources.js";
import { listHandouts } from "../src/model/lesson-finder.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

class Node {
  constructor(tagName) {
    this.tagName = tagName;
    this.className = "";
    this.textContent = "";
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.value = "";
  }
  append(...children) { this.children.push(...children.filter(Boolean)); }
  replaceChildren(...children) { this.children = children.filter(Boolean); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  click() { this.listeners.get("click")?.({ currentTarget: this }); }
  input(value) { this.value = value; this.listeners.get("input")?.({ currentTarget: this }); }
  change(value) { this.value = value; this.listeners.get("change")?.({ currentTarget: this }); }
}
const documentRef = { createElement: tag => new Node(tag), createElementNS: (_ns, tag) => new Node(tag) };
const textOf = node => [node.textContent, ...node.children.map(textOf)].filter(Boolean).join(" ");
const findAll = (node, predicate, found = []) => { if (predicate(node)) found.push(node); node.children.forEach(child => findAll(child, predicate, found)); return found; };

async function importGraph(entry) {
  const pending = [entry];
  const seen = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = await readFile(path.join(ROOT, file), "utf8");
    for (const match of source.matchAll(/^\s*(?:import|export)\s[^"']*?from\s+["']([^"']+)["']/gm)) {
      pending.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1])));
    }
  }
  return seen;
}

function withTrappedStorage(callback) {
  const saved = {};
  for (const name of ["localStorage", "sessionStorage", "indexedDB"]) {
    saved[name] = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error(`resource hub touched ${name}`); } });
  }
  try { return callback(); } finally {
    for (const [name, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

function render(search = "") {
  const root = new Node("main");
  withTrappedStorage(() => renderResourceHub(root, { location: { search }, documentRef }));
  return root;
}

test("the handouts page imports no storage, schedule, cloud or teacher record module and loads only its own script", async () => {
  const graph = await importGraph("src/resources.js");
  const forbidden = /^src\/(?:storage|runtime|services)\/|src\/model\/(?:schedule|schedule-editor|teacher-plan|teacher-plan-v1|access|state|class-progress|dated-updates|crew-signup|announcements|week|admin-plan|schema-admission)\.js$|src\/app\.js$/;
  for (const file of graph) assert.doesNotMatch(file, forbidden, file);
  for (const file of graph) {
    const source = await readFile(path.join(ROOT, file), "utf8");
    assert.doesNotMatch(source, /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|document\.cookie|\bfetch\(|firebase/i, file);
  }
  const html = await readFile(path.join(ROOT, "resources.html"), "utf8");
  assert.deepEqual([...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(match => match[1]), ["src/resources.js"]);
  assert.doesNotMatch(html, /app\.js|firebase/);
  assert.equal(html.match(/https?:\/\/[^\s"'<>]+/gi), null, "the handouts page makes no third-party request");
});

test("the hub lists every lesson handout with its PDF, response sheet and on-screen link, plus the reviewed guides", () => {
  const root = render();
  const text = textOf(root);
  assert.match(text, /Handouts and guides/);
  assert.match(text, new RegExp(`${listHandouts().length} lessons, both playbooks, grades 5 and 6`));
  const hrefs = findAll(root, node => node.tagName === "a").map(node => node.getAttribute("href"));
  for (const entry of listHandouts()) {
    assert.ok(hrefs.includes(entry.files.pdf), entry.files.pdf);
    assert.ok(hrefs.includes(entry.files.docx), entry.files.docx);
  }
  assert.ok(hrefs.some(href => href === "student.html?playbook=a&meeting=3"));
  for (const guide of GUIDES) assert.ok(hrefs.includes(guide.file), guide.file);
  assert.match(text, /September 30 wording/);
  assert.match(text, /not on this site/);
  assert.ok(hrefs.every(href => !/PRIVATE|__private__/.test(href)));
});

test("filters narrow the list by grade, playbook, format and words without leaving the page", () => {
  const root = render();
  const button = label => findAll(root, node => node.tagName === "button" && textOf(node) === label)[0];
  withTrappedStorage(() => button("Grade 5").click());
  assert.equal(button("Grade 5").getAttribute("aria-pressed"), "true");
  assert.doesNotMatch(textOf(root), /Tank 1: Notice a useful problem/);
  withTrappedStorage(() => button("Playbook A, this year").click());
  assert.doesNotMatch(textOf(root), /Welcome to CIRC/);
  assert.match(textOf(root), /KidWind 1: Make the wind do work/);
  const search = findAll(root, node => node.tagName === "input")[0];
  withTrappedStorage(() => search.input("tinkercad"));
  assert.match(textOf(root), /6 of \d+ lessons, Playbook A, grade 5/);
  withTrappedStorage(() => search.input("zzzz"));
  assert.match(textOf(root), /No lesson matches that/);
  withTrappedStorage(() => search.input(""));
  const format = findAll(root, node => node.tagName === "select")[0];
  withTrappedStorage(() => format.change("paper"));
  assert.match(textOf(root), /4 of \d+ lessons/);
});

test("a teacher deep link preselects the playbook and marks the class's lesson as up next", () => {
  const root = render("?playbook=b&meeting=1&grade=6");
  const text = textOf(root);
  assert.match(text, /Playbook B, grade 6/);
  const now = findAll(root, node => /resource-item/.test(node.className) && /is-now/.test(node.className));
  assert.equal(now.length, 1);
  assert.match(textOf(now[0]), /Welcome to CIRC/);
  assert.match(textOf(now[0]), /Up next/);
});
