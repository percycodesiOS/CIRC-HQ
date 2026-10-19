import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { renderStudentPage } from "../src/student.js";
import { studentRedirectTarget } from "../src/app.js";
import { buildTeacherHome, buildTeacherAgenda } from "../src/ui/teacher-home.js";
import { PLAYBOOKS, SUPPLEMENTAL_LESSONS, listMeetings, resolveClassLesson, resolveMeeting, resolveSupplementalLesson } from "../src/model/playbooks.js";
import { buildLessonCard } from "../src/ui/playbook-view.js";

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
  click() { this.listeners.get("click")?.({ currentTarget: this, preventDefault() {} }); }
  input(value) { this.value = value; this.listeners.get("input")?.({ currentTarget: this }); }
  change(value) { this.value = value; this.listeners.get("change")?.({ currentTarget: this }); }
  submit() { this.listeners.get("submit")?.({ currentTarget: this, preventDefault() {} }); }
  querySelector(selector) {
    const ids = selector.split(",").map(part => part.trim().replace(/^#/, ""));
    if (ids.includes(this.getAttribute("id"))) return this;
    for (const child of this.children) { const found = child.querySelector?.(selector); if (found) return found; }
    return null;
  }
  focus() { this.focused = true; }
}
const documentRef = { createElement: tag => new Node(tag), createElementNS: (_ns, tag) => new Node(tag) };
const textOf = node => [node.textContent, ...node.children.map(textOf)].filter(Boolean).join(" ");
const findAll = (node, predicate, found = []) => { if (predicate(node)) found.push(node); node.children.forEach(child => findAll(child, predicate, found)); return found; };

test("every teacher lesson has the exact student directions in order, with visible teacher actions", () => {
  const resolved = PLAYBOOKS.flatMap(playbook => listMeetings(playbook.id).flatMap(meeting => [5, 6].map(grade => resolveMeeting(playbook.id, meeting.number, { grade }))));
  resolved.push(...SUPPLEMENTAL_LESSONS.map(item => resolveSupplementalLesson(item.id)));
  const unique = new Map(resolved.filter(item => item?.lesson).map(item => [item.lesson.ref, item]));
  assert.ok(unique.size > 50, "audit both full-year routes, not just a sample screen");
  for (const [ref, item] of unique) {
    const student = buildLessonCard(item, { audience: "student", documentRef });
    const teacher = buildLessonCard(item, { audience: "teacher", documentRef });
    const directions = node => findAll(node, child => child.className === "pb-step-directions").map(step => step.children.map(textOf));
    assert.deepEqual(directions(teacher), directions(student), ref);
    const teacherActions = findAll(teacher, node => node.className === "pb-teacher-step");
    assert.ok(teacherActions.every(node => node.tagName === "section"), `${ref}: teacher actions are visible without opening another control`);
    assert.equal(findAll(student, node => node.className === "pb-teacher-step").length, 0, `${ref}: teacher actions do not leak onto the student page`);
    const teacherPrep = findAll(teacher, node => node.className === "pb-teacher-notes");
    assert.ok(teacherPrep.every(node => node.getAttribute("open") !== null), `${ref}: preparation and examples are open by default`);
  }
});

test("the retained station activity has executable game steps and does not replace next week's saved lesson", () => {
  const station = textOf(buildLessonCard(resolveSupplementalLesson("circ-station-rotation"), { audience: "student", documentRef }));
  for (const text of ["Creative", "Auto or Keyboard and mouse", "On touch screens", "PLAY AS", "top or side of a nearby block", "Right-click", "On a touch screen, tap PLACE", "press Save", "Save, download or load a world", "Download Save", ".json", "Do not choose Reset World or Load World"]) {
    assert.ok(station.includes(text), text);
  }
  assert.doesNotMatch(station, /Aim at empty ground/);
  const held = { playbook: "a", meeting: 3, grade: 5, option: null };
  assert.equal(resolveClassLesson(held, "2026-10-16").supplementalId, "circ-station-rotation");
  assert.equal(resolveClassLesson(held, "2026-10-19").lesson.ref, resolveMeeting("a", 3, { grade: 5 }).lesson.ref);
  assert.equal(held.meeting, 3, "looking at the date does not advance saved class progress");
});

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
  const trap = new Proxy({}, { get() { throw new Error("student page touched browser storage"); } });
  const saved = {};
  for (const name of ["localStorage", "sessionStorage", "indexedDB"]) {
    saved[name] = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error(`student page touched ${name}`); } });
  }
  try { return callback(trap); } finally {
    for (const [name, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

function renderStudent(search, date = "2026-09-29T12:00:00Z") {
  const root = new Node("main");
  const location = { search };
  const pushed = [];
  const history = { pushState: (_state, _title, url) => { pushed.push(url); location.search = url.startsWith("?") ? url : ""; } };
  const page = withTrappedStorage(() => renderStudentPage(root, { location, history, documentRef, scrollTo: () => {}, print: null, now: () => new Date(date) }));
  return { root, location, pushed, page };
}

test("the student page imports no storage, schedule, cloud or teacher record module", async () => {
  const graph = await importGraph("src/student.js");
  const forbidden = /^src\/(?:storage|runtime|services)\/|src\/model\/(?:schedule|schedule-editor|teacher-plan|teacher-plan-v1|access|state|class-progress|dated-updates|crew-signup|announcements|week|admin-plan|schema-admission)\.js$|src\/app\.js$/;
  for (const file of graph) assert.doesNotMatch(file, forbidden, file);
  for (const file of graph) {
    const source = await readFile(path.join(ROOT, file), "utf8");
    assert.doesNotMatch(source, /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|document\.cookie|\bfetch\(|firebase/i, file);
  }
  const html = await readFile(path.join(ROOT, "student.html"), "utf8");
  assert.deepEqual([...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(match => match[1]), ["src/student.js"]);
  assert.doesNotMatch(html, /app\.js|firebase/);
  assert.match(html, /<link rel="stylesheet" href="student\.css">/);
  assert.equal(html.match(/https?:\/\/[^\s"'<>]+/gi), null, "the student page makes no third-party request");
  const css = await readFile(path.join(ROOT, "student.css"), "utf8");
  assert.equal(css.match(/https?:\/\/[^\s"'<>)]+/gi), null, "student.css loads fonts from this site only");
  assert.match(css, /url\("assets\/fonts\/fredoka-latin\.woff2"\)/);
  assert.match(css, /url\("assets\/fonts\/nunito-sans-latin\.woff2"\)/);
  for (const link of ["arcade.html", "fid.html", "ectv.html", "resources.html"]) assert.match(html, new RegExp(`href="${link}"`), `students can reach ${link}`);
});

test("a bookmarked student link shows the goal, done-when check, steps, turn-in, help and next challenge without storage", () => {
  const first = renderStudent("?playbook=a&meeting=10&grade=5");
  const text = textOf(first.root);
  assert.match(text, /KidWind 1: Make the wind do work/);
  assert.equal(findAll(first.root, node => node.getAttribute("id") === "pb-lesson-title")[0].tagName, "h1", "the lesson title is the page heading");
  assert.match(text, /Goal:/);
  assert.ok(text.indexOf("You are done when") < text.indexOf("Steps | 35 minutes"), "the done-when check is visible before the steps");
  assert.match(text, /You will use/);
  assert.match(text, /What to turn in/);
  assert.match(text, /Next challenge \(optional\)/);
  assert.match(text, /Another way to do it/);
  assert.match(text, /Stuck\? Try this order/);
  assert.match(text, /Stay safe/);
  assert.doesNotMatch(text, /Grade 5 target/, "KidWind is grade 5 only, so there is no separate grade target");
  assert.equal(findAll(first.root, node => /\bpb-step\b/.test(node.className) && node.tagName === "li").length, 7);
  assert.equal(findAll(first.root, node => /pb-timebar/.test(node.className)).length, 1, "a time bar shows the shape of the lesson");
  assert.match(text, /No-fan paper path Use these paper steps instead when your teacher chooses the no-fan path\./);
  assert.match(text, /Practice data created for this lesson\. These are not student measurements or evidence about a real blade design\./);
  assert.equal(findAll(first.root, node => node.tagName === "table").length, 1);
  assert.match(text, /centimeters lifted/i);
  assert.doesNotMatch(text, /clip|pinwheel/i);
  const hrefs = findAll(first.root, node => node.tagName === "a").map(node => node.getAttribute("href"));
  assert.ok(hrefs.includes("assets/handouts/CIRC-KidWind-1-Student.pdf"), "the lesson links its own printable handout");
  for (const teacherOnly of [/Teacher moves/, /Before class/, /Teacher notes/, /Support and stretch/, /Start this lesson/, /Four Cs/, /Preparation required/, /Lesson PDF/, /Cleanup/]) {
    assert.doesNotMatch(text, teacherOnly);
  }
  const reload = renderStudent("?playbook=a&meeting=10&grade=5");
  assert.equal(textOf(reload.root), text, "a reload shows the same lesson");

  const shared = textOf(renderStudent("?playbook=a&meeting=6&grade=6").root);
  assert.match(shared, /Paper Bridge/);
  assert.match(shared, /Grade 6 target Record loads in a table/);
  assert.match(shared, /Grade 5 does: Record the most load held with tally marks/);
  assert.doesNotMatch(shared, /Grade 5 target/);
});

test("a split meeting asks for the grade and a flex meeting defaults to catch up", () => {
  const split = renderStudent("?playbook=b&meeting=12");
  assert.match(textOf(split.root), /Which grade are you in\?/);
  const choice = findAll(split.root, node => node.tagName === "button" && /^Grade 6:/.test(textOf(node)))[0];
  withTrappedStorage(() => choice.click());
  assert.equal(split.pushed.at(-1), "?playbook=b&meeting=12&grade=6");
  assert.match(textOf(split.root), /Tank 4: Plan the first build/);
  const flex = renderStudent("?playbook=a&meeting=9");
  assert.match(textOf(flex.root), /Catch up and finish/);
});

test("the student home leads with this year's next meeting and one tap per grade", () => {
  const { root, pushed } = renderStudent("");
  const text = textOf(root);
  assert.match(text, /What are we doing today\?/);
  assert.match(text, /Meeting 3 of 32/);
  assert.match(text, /Logo to jingle: Give your brand a sound/);
  assert.match(text, /Tap your grade to open the steps/);
  const grade5 = findAll(root, node => node.tagName === "a" && /student-grade-button/.test(node.className) && textOf(node) === "Grade 5")[0];
  assert.equal(grade5.getAttribute("href"), "student.html?playbook=a&meeting=3&grade=5", "a real link works without the script and in a new tab");
  withTrappedStorage(() => grade5.click());
  assert.equal(pushed.at(-1), "?playbook=a&meeting=3&grade=5");
  assert.match(textOf(root), /Grade 5 target One short slogan and a simple repeated beat/);
  assert.match(textOf(root), /Links and examples/);
  assert.doesNotMatch(textOf(root), /Suno|AI Jingle Maker/, "teacher-only links stay off the student page");
});

test("a different meeting number from the board opens that meeting and a bad number explains the range", () => {
  const { root, pushed } = renderStudent("");
  const form = findAll(root, node => node.tagName === "form")[0];
  const [playbookSelect] = findAll(form, node => node.tagName === "select");
  const [meetingInput] = findAll(form, node => node.tagName === "input");
  assert.equal(meetingInput.getAttribute("max"), "32");
  withTrappedStorage(() => playbookSelect.change("b"));
  assert.equal(meetingInput.getAttribute("max"), "36");
  meetingInput.value = "99";
  withTrappedStorage(() => form.submit());
  assert.equal(pushed.length, 0);
  assert.match(textOf(root), /Pick a meeting number from 1 to 36/);
  meetingInput.value = "1";
  withTrappedStorage(() => form.submit());
  assert.equal(pushed.at(-1), "?playbook=b&meeting=1");
  assert.match(textOf(root), /Welcome to CIRC/);
});

test("the finder searches and filters both playbooks without leaving the page or touching storage", () => {
  const { root, pushed } = renderStudent("");
  assert.match(textOf(root), /Find any lesson/);
  assert.match(textOf(root), /32 meetings in Playbook A/);
  const button = label => findAll(root, node => node.tagName === "button" && textOf(node) === label)[0];
  withTrappedStorage(() => button("Grade 5").click());
  assert.equal(button("Grade 5").getAttribute("aria-pressed"), "true");
  assert.match(textOf(root), /Grade 5 path shown/);
  assert.match(textOf(root), /10 KidWind 1: Make the wind do work Grade 6 does Tank 3/);
  const search = findAll(root, node => node.tagName === "input" && node.getAttribute("type") === "search")[0];
  withTrappedStorage(() => search.input("kidwind"));
  assert.match(textOf(root), /\d of 32 meetings/);
  assert.match(textOf(root), /KidWind 1: Make the wind do work/);
  assert.doesNotMatch(textOf(root), /Paper Bridge/);
  withTrappedStorage(() => search.input("zzzz"));
  assert.match(textOf(root), /No lesson matches that/);
  withTrappedStorage(() => search.input(""));
  const tabB = findAll(root, node => node.tagName === "button" && /Playbook B/.test(textOf(node)) && /pb-tab/.test(node.className))[0];
  withTrappedStorage(() => tabB.click());
  assert.match(textOf(root), /36 meetings in Playbook B/);
  assert.match(textOf(root), /Welcome to CIRC/);
  const meetingOne = findAll(root, node => node.tagName === "button" && node.getAttribute("aria-label")?.startsWith("Meeting 1:"))[0];
  withTrappedStorage(() => meetingOne.click());
  assert.equal(pushed.at(-1), "?playbook=b&meeting=1&grade=5");
  assert.match(textOf(root), /Welcome to CIRC/);
  assert.match(textOf(root), /Other lessons - open only when your teacher asks/, "the finder stays available under the lesson");
});

test("the index redirect sends student links to the student page before any teacher state is read", async () => {
  assert.equal(studentRedirectTarget({ hash: "#student", search: "" }), "student.html");
  assert.equal(studentRedirectTarget({ hash: "", search: "?view=student&playbook=b&meeting=3&grade=6&class=PRIVATE" }), "student.html?playbook=b&meeting=3&grade=6");
  assert.equal(studentRedirectTarget({ hash: "#student&playbook=a&meeting=2", search: "" }), "student.html?playbook=a&meeting=2");
  assert.equal(studentRedirectTarget({ hash: "", search: "" }), null);
  assert.equal(studentRedirectTarget({ hash: "#dated-updates", search: "?view=teacher" }), null);
  const app = await readFile(path.join(ROOT, "src", "app.js"), "utf8");
  const bootstrap = app.slice(app.lastIndexOf('if (typeof document !== "undefined")'));
  assert.ok(bootstrap.indexOf("studentRedirectTarget") < bootstrap.indexOf("renderApp(root)"), "redirect is decided before the app reads storage");
});

test("the teacher's student link never carries the private class label", () => {
  const agenda = buildTeacherAgenda({ status: "current", nowMinutes: 545, timeline: [{ id: "e1", title: "PRIVATE_CLASS_LABEL", type: "teach", startMinutes: 540, endMinutes: 575 }] });
  const home = buildTeacherHome({
    hasPlan: true,
    agenda,
    dated: { coverage: "none", items: [], stale: false, freshness: "" },
    classCard: {
      label: "PRIVATE_CLASS_LABEL",
      when: "Now",
      classKey: "PRIVATE_CLASS_LABEL",
      place: { playbook: "a", meeting: 4, grade: 5, option: null, saved: true },
      resolved: resolveMeeting("a", 4, { grade: 5 })
    },
    runner: null
  }, {}, { documentRef });
  const links = findAll(home, node => node.tagName === "a").map(node => node.getAttribute("href"));
  assert.ok(links.includes("student.html?playbook=a&meeting=4&grade=5"));
  assert.ok(links.includes("assets/handouts/CIRC-Cardboard-Joins-and-Careful-Cutting-Student.pdf"), "the class card links the lesson's own handout");
  assert.ok(links.includes("resources.html"));
  assert.ok(links.every(href => !/PRIVATE/.test(href)));
  const text = textOf(home);
  assert.match(text, /Materials/);
  assert.match(text, /Safety/);
  assert.match(text, /Pacing: 35 minutes, you press Next/);
});

test("station directions are stable, storage-free and student-safe after the special week", () => {
  const screen = renderStudent("?lesson=circ-station-rotation&grade=6&class=PRIVATE", "2026-10-19T12:00:00Z");
  const text = textOf(screen.root);
  assert.match(text, /CIRC build stations: explore, make, improve/);
  assert.match(text, /Groups work|MYnecraft/);
  assert.match(text, /You are done when Your group can show/);
  assert.match(text, /Retained for next year/);
  assert.doesNotMatch(text, /PRIVATE|Teacher notes|Station week teacher guide|Meeting null/);
  const links = findAll(screen.root, node => node.tagName === "a").map(node => node.getAttribute("href"));
  assert.ok(links.includes("assets/guides/CIRC-Station-Week-Student-Packet.pdf"));
  assert.ok(links.includes("https://percycodesios.github.io/CyberGrader.io/game/mynecraft.html"));
  assert.ok(!links.includes("assets/guides/CIRC-Station-Week-Teacher-Guide.pdf"));
  const grade = findAll(screen.root, node => node.tagName === "button" && textOf(node) === "Grade 5")[0];
  withTrappedStorage(() => grade.click());
  assert.equal(screen.pushed.at(-1), "?lesson=circ-station-rotation&grade=5");
  assert.equal(studentRedirectTarget({ search: "?view=student&lesson=circ-station-rotation&teacher=PRIVATE", hash: "" }), "student.html?lesson=circ-station-rotation");
});

test("the dated student entry opens stations while annual bookmarks keep their lesson", () => {
  const fresh = renderStudent("", "2026-10-12T12:00:00Z");
  assert.match(textOf(fresh.root), /October 12-16 \| This week's CIRC lesson/);
  const open = findAll(fresh.root, node => node.tagName === "button" && textOf(node) === "Open this week's lesson")[0];
  withTrappedStorage(() => open.click());
  assert.equal(fresh.pushed.at(-1), "?lesson=circ-station-rotation");
  assert.match(textOf(fresh.root), /CIRC build stations: explore, make, improve/);
  const booked = renderStudent("?playbook=a&meeting=3", "2026-10-12T12:00:00Z");
  const heading = findAll(booked.root, node => node.getAttribute("id") === "pb-lesson-title")[0];
  assert.match(textOf(heading), /jingle/i);
  assert.doesNotMatch(textOf(booked.root), /This week's CIRC lesson/, "an explicit lesson link is not preceded by a competing weekly task");
  const otherLessons = findAll(booked.root, node => node.getAttribute("id") === "browse")[0];
  assert.equal(otherLessons.tagName, "details");
  assert.equal(otherLessons.getAttribute("open"), null, "other lessons stay collapsed until requested");
  const after = renderStudent("", "2026-10-19T12:00:00Z");
  assert.doesNotMatch(textOf(after.root), /This week's CIRC lesson/);
  assert.match(textOf(after.root), /Retained for next year/);
});
