import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminPlanDocument } from "../src/model/admin-plan.js";

function project(overrides = {}) {
  return {
    number: 2,
    title: "Tech Terrarium",
    objective: "Build, test, and improve one shared feature.",
    teacherSay: [
      "Today we will build with purpose.",
      "Test one small change at a time."
    ],
    teacherDo: [
      "Model one safe tool choice.",
      "Pause for a midpoint test."
    ],
    studentSteps: [
      "Plan one feature.",
      "Build, test, and improve."
    ],
    materials: ["Reclaimed materials", "Posca markers"],
    safety: "Use tools only as demonstrated.",
    cleanup: "Sort scraps and return tools.",
    exitEvidence: "Name one change made after testing.",
    admin: {
      duration: "35 minutes",
      standardsTitle: "Pennsylvania STEELS crosswalk",
      standards: [
        "PA STEELS Grades 3-5 | 3.5.3-5.M",
        "PA STEELS Grades 3-5 | 3.5.3-5.R"
      ]
    },
    privateNote: "Do not include this teacher-only note.",
    schedule: { start: "09:05", className: "Private Class" },
    ...overrides
  };
}

test("builds a complete printable project plan from approved project fields", () => {
  const html = buildAdminPlanDocument(project());

  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>Project 2: Tech Terrarium<\/title>/);
  assert.match(html, /font-family:\s*"Aptos",\s*"Segoe UI",\s*system-ui,\s*sans-serif/);
  assert.doesNotMatch(html, /Arial/);

  for (const expected of [
    "Project 2",
    "Tech Terrarium",
    "Build, test, and improve one shared feature.",
    "Today we will build with purpose.",
    "Test one small change at a time.",
    "Model one safe tool choice.",
    "Pause for a midpoint test.",
    "Plan one feature.",
    "Build, test, and improve.",
    "Reclaimed materials",
    "Posca markers",
    "Use tools only as demonstrated.",
    "Sort scraps and return tools.",
    "Name one change made after testing.",
    "35 minutes",
    "Pennsylvania STEELS crosswalk",
    "PA STEELS Grades 3-5 | 3.5.3-5.M",
    "PA STEELS Grades 3-5 | 3.5.3-5.R"
  ]) {
    assert.equal(html.includes(expected), true, `missing ${expected}`);
  }

  assert.match(html, /@media print/);
  assert.match(html, /<\/body>\s*<\/html>\s*$/);
});

test("escapes every injected project value and ignores private or schedule fields", () => {
  const unsafe = '<script>alert("owned")<\/script> & <img src=x onerror=alert(1)>';
  const html = buildAdminPlanDocument(project({
    number: unsafe,
    title: unsafe,
    objective: unsafe,
    teacherSay: [unsafe],
    teacherDo: [unsafe],
    studentSteps: [unsafe],
    materials: [unsafe],
    safety: unsafe,
    cleanup: unsafe,
    exitEvidence: unsafe,
    admin: { duration: unsafe, standards: [unsafe] },
    privateNote: "SECRET PRIVATE NOTE",
    schedule: { label: "SECRET SCHEDULE", start: "07:00" }
  }));

  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes("onerror="), false);
  assert.equal(html.includes("&lt;script&gt;"), true);
  assert.equal(html.includes("&amp;"), true);
  assert.equal(html.includes("SECRET PRIVATE NOTE"), false);
  assert.equal(html.includes("SECRET SCHEDULE"), false);
  assert.equal(html.includes("07:00"), false);
});

test("accepts grouped standards without exposing unrelated project data", () => {
  const html = buildAdminPlanDocument(project({
    admin: {
      duration: "35 minutes",
      standardsTitle: "Pennsylvania STEELS crosswalk",
      standards: {
        grade5: ["5.3.5.A", "5.3.5.B"],
        grade6: ["6.3.6.A"]
      }
    },
    internalMetadata: "PRIVATE INTERNAL DATA"
  }));

  assert.match(html, /Grade 5/);
  assert.match(html, /Pennsylvania STEELS crosswalk/);
  assert.match(html, /5\.3\.5\.A/);
  assert.match(html, /5\.3\.5\.B/);
  assert.match(html, /Grade 6/);
  assert.match(html, /6\.3\.6\.A/);
  assert.equal(html.includes("PRIVATE INTERNAL DATA"), false);
});

test("contains no em dash, en dash, external links, or DOM sink code", () => {
  const html = buildAdminPlanDocument(project());

  assert.equal(/[\u2013\u2014]/u.test(html), false);
  assert.equal(/https?:\/\//i.test(html), false);
  assert.equal(/<link\b/i.test(html), false);
  assert.equal(/<script\b/i.test(html), false);
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML/.test(html), false);
});
