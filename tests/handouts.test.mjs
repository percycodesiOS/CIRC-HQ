import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { HANDOUT_ASSETS, HANDOUT_FILES } from "../scripts/handout-manifest.mjs";
import { buildResponseSheet } from "../scripts/build-response-sheets.mjs";
import { escapeHtml, renderHandoutHtml } from "../scripts/handout-template.mjs";
import { listHandouts } from "../src/model/lesson-finder.js";
import { getLessonForRef } from "../src/model/playbooks.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// Teacher-only lines that do not also appear in the student-facing fields.
// A sentence the lesson gives students too (for example a sharing rule that
// is both a teacher note and part of what to turn in) is not a leak.
function teacherOnlyText(lesson) {
  const studentText = [
    lesson.title, lesson.goal, lesson.turnIn, lesson.success, lesson.extension, lesson.fallback, lesson.safety,
    ...lesson.materials,
    ...lesson.steps.flatMap(step => step.directions),
    ...Object.values(lesson.adapt ?? {}),
    ...(lesson.resources ?? []).filter(resource => !resource.teacherOnly).flatMap(resource => [resource.label, resource.description, resource.url]),
    ...(lesson.paperPath ? [lesson.paperPath.note, lesson.paperPath.goal, lesson.paperPath.evidence, ...lesson.paperPath.directions] : [])
  ].filter(Boolean).join("\n");
  return [
    ...lesson.prep,
    ...lesson.teacherNotes,
    ...lesson.steps.flatMap(step => step.teacherDirections),
    ...(lesson.resources ?? []).filter(resource => resource.teacherOnly).map(resource => resource.url),
    lesson.prepRequired
  ].filter(text => typeof text === "string" && text.length > 24 && !studentText.includes(text));
}

test("every lesson has a committed student PDF and response sheet, each listed once with a matching lock", async () => {
  const locks = new Map(HANDOUT_ASSETS);
  const handouts = listHandouts();
  assert.equal(HANDOUT_ASSETS.length, handouts.length * 2, "one PDF and one response sheet per unique lesson");
  assert.deepEqual([...HANDOUT_FILES], [...new Set(HANDOUT_FILES)].sort(), "the manifest is sorted and has no duplicates");
  for (const entry of handouts) {
    for (const file of Object.values(entry.files)) {
      assert.ok(locks.has(file), `${file} is in the reviewed manifest`);
      const bytes = await readFile(path.join(ROOT, ...file.split("/")));
      assert.equal(createHash("sha256").update(bytes).digest("hex").toUpperCase(), locks.get(file), `${file} matches its lock`);
    }
  }
});

test("student PDFs are tagged, bookmarked, letter size, unencrypted and carry fixed timestamps", async () => {
  for (const entry of listHandouts()) {
    const bytes = await readFile(path.join(ROOT, ...entry.files.pdf.split("/")));
    const text = bytes.toString("latin1");
    const where = entry.files.pdf;
    assert.ok(text.startsWith("%PDF-1."), where);
    assert.match(text, /\/StructTreeRoot/, `${where} is tagged`);
    assert.match(text, /\/MarkInfo/, `${where} declares tagging`);
    assert.match(text, /\/Outlines/, `${where} has bookmarks`);
    assert.match(text, /\/MediaBox \[0 0 612 792\]/, `${where} is letter size`);
    assert.doesNotMatch(text, /\/Encrypt/, where);
    assert.match(text, /\/Lang \(en\)/, `${where} declares its language`);
    const dates = text.match(/D:\d{14}[+-]\d{2}'\d{2}'/g) ?? [];
    assert.ok(dates.length >= 2 && dates.every(date => date === "D:20261011000000+00'00'"), `${where} timestamps are fixed so rebuilds are byte-identical`);
    assert.ok(bytes.length < 600_000, `${where} stays small enough to open on a phone`);
  }
});

test("response sheets are deterministic stored zips with the lesson's own words and no teacher-only text", async () => {
  for (const entry of listHandouts()) {
    const lesson = getLessonForRef(entry.ref);
    const built = buildResponseSheet(entry);
    const committed = await readFile(path.join(ROOT, ...entry.files.docx.split("/")));
    assert.ok(built.equals(committed), `${entry.files.docx} matches a fresh build`);
    const text = built.toString("utf8");
    assert.equal(text.slice(0, 2), "PK");
    assert.match(text, /\[Content_Types\]\.xml/);
    assert.match(text, /word\/document\.xml/);
    assert.ok(text.includes(xmlEscape(lesson.title)), `${entry.stem} names the lesson`);
    assert.ok(text.includes(xmlEscape(lesson.turnIn)), `${entry.stem} says what to turn in`);
    for (const secret of teacherOnlyText(lesson)) assert.equal(text.includes(xmlEscape(secret)), false, `${entry.stem} leaks teacher text: ${secret.slice(0, 40)}`);
    assert.doesNotMatch(text, /[\u2013\u2014]/u, entry.stem);
  }
});

test("the PDF template prints student content only, in both font modes", () => {
  for (const entry of listHandouts()) {
    const lesson = getLessonForRef(entry.ref);
    for (const webFonts of [false, true]) {
      const html = renderHandoutHtml(entry, { webFonts });
      assert.ok(html.includes(escapeHtml(lesson.title)), entry.stem);
      assert.ok(html.includes(escapeHtml(lesson.goal)), entry.stem);
      assert.ok(html.includes(escapeHtml(lesson.success)), entry.stem);
      assert.ok(html.includes(escapeHtml(lesson.turnIn)), entry.stem);
      assert.ok(html.includes(escapeHtml(lesson.fallback)), entry.stem);
      assert.ok(html.includes(escapeHtml(lesson.extension)), entry.stem);
      for (const step of lesson.steps) assert.ok(html.includes(escapeHtml(step.label)), `${entry.stem} step ${step.label}`);
      for (const secret of teacherOnlyText(lesson)) assert.equal(html.includes(escapeHtml(secret)), false, `${entry.stem} leaks teacher text: ${secret.slice(0, 40)}`);
      assert.doesNotMatch(html, /[\u2013\u2014]/u, entry.stem);
      assert.equal(/fonts\.googleapis\.com/.test(html), webFonts, "web fonts load only when asked");
      assert.match(html, /<html lang="en">/);
      assert.match(html, /<title>[^<]+<\/title>/);
    }
  }
});
