import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PLAYBOOKS,
  STRANDS,
  buildStudentLink,
  getLessonForRef,
  lessonMetaKeys,
  listMeetings,
  parseStudentLink,
  resolveMeeting,
  strandCoverage
} from "../src/model/playbooks.js";
import { PLAYBOOK_LESSONS } from "../src/model/playbook-lessons.js";
import { getExperienceTimingPlan, REPLICA_LESSON_CHOICES, validateExperienceTimingPlan } from "../src/model/experience-timing-plans.js";
import { createExperienceRunner, validateExperienceRunner } from "../src/model/experience-runner.js";

const RESET_LESSONS = new Set(["year:catch-up", "year:reflect-reset"]);

function allPaths(playbookId) {
  return listMeetings(playbookId).flatMap(meeting => Object.entries(meeting.paths).map(([path, ref]) => ({ meeting, path, ref })));
}

test("Playbook A keeps the finished NeuroArt and both Canva visits, then fits 31 meetings plus a buffer", () => {
  const meetings = listMeetings("a");
  assert.equal(meetings.length, 32);
  assert.deepEqual(meetings.map(meeting => meeting.number), Array.from({ length: 32 }, (_, index) => index + 1));
  assert.equal(meetings[0].done, true);
  assert.equal(meetings[0].paths.both, "year:circ-neuro");
  assert.equal(meetings[1].paths.both, "year:circ-canva-template");
  assert.equal(meetings[2].paths.both, "year:circ-logo-jingle");
  assert.equal(PLAYBOOKS[0].nextMeeting, 3);
  assert.equal(meetings.at(-1).kind, "buffer");
  // From September 28, 2026 cycle days 1 to 3 have 31 visits and days 4 and 5 have 30.
  // Meeting 1 was taught before then, so 30 route meetings plus the buffer fill days 1 to 3.
  assert.equal(meetings.filter(meeting => meeting.number > 1 && meeting.kind !== "buffer").length, 30);
});

test("Playbook B is a full year of 35 meetings plus a buffer", () => {
  const meetings = listMeetings("b");
  assert.equal(meetings.length, 36);
  assert.equal(meetings.filter(meeting => meeting.kind !== "buffer").length, 35);
  assert.equal(meetings.at(-1).kind, "buffer");
  assert.equal(PLAYBOOKS[1].nextMeeting, 1);
});

test("every meeting path opens a complete, runnable 35-minute lesson", () => {
  for (const playbook of PLAYBOOKS) {
    for (const { meeting, path, ref } of allPaths(playbook.id)) {
      const where = `${playbook.id} ${meeting.number} ${path} ${ref}`;
      const lesson = getLessonForRef(ref);
      assert.ok(lesson, where);
      assert.equal(lesson.minutes, 35, where);
      assert.ok(lesson.goal && lesson.materials.length && lesson.prep.length, where);
      assert.ok(lesson.steps.length >= 7 && lesson.steps.every(step => step.directions.length && step.minutes > 0), where);
      assert.ok(lesson.steps.some(step => step.kind === "cleanup") && lesson.cleanup.length, where);
      assert.ok(lesson.success && lesson.turnIn && lesson.extension && lesson.fallback, where);
      assert.ok(lesson.fourCs.length, where);
      if (!RESET_LESSONS.has(ref)) assert.ok(lesson.strands.length, where);
      if (path === "both") assert.ok(lesson.adapt.grade5 && lesson.adapt.grade6, `${where} needs grade 5 and grade 6 adaptations`);
      else assert.ok((lesson.adapt.support && lesson.adapt.stretch) || (lesson.adapt.grade5 && lesson.adapt.grade6), where);
      const plan = getExperienceTimingPlan(lesson.runner.projectNumber, lesson.runner.modeId ? { modeId: lesson.runner.modeId } : undefined);
      assert.equal(validateExperienceTimingPlan(plan).ok, true, where);
      const runner = createExperienceRunner(getExperienceTimingPlan(lesson.runner.projectNumber), {
        teacherKey: "teacher:playbook-test",
        nowIso: "2026-09-29T13:00:00.000Z",
        ...(lesson.runner.modeId ? { modeId: lesson.runner.modeId } : {})
      });
      assert.equal(validateExperienceRunner(JSON.parse(JSON.stringify(runner)), { teacherKey: "teacher:playbook-test" }).ok, true, where);
    }
  }
  assert.equal(PLAYBOOK_LESSONS.length, 25);
  for (const key of lessonMetaKeys()) assert.ok(key === "year:circ-canva-original" || PLAYBOOKS.some(playbook => allPaths(playbook.id).some(item => item.ref === key)), `unused lesson metadata ${key}`);
});

test("grade 6 runs all fifteen CIRC Tank lessons in order and grade 5 never enters Tank", () => {
  for (const playbook of PLAYBOOKS) {
    const splits = listMeetings(playbook.id).filter(meeting => meeting.paths.g5);
    const tank = splits.map(meeting => meeting.paths.g6);
    assert.equal(tank.length, 15, playbook.id);
    assert.ok(tank.every(ref => ref.startsWith("year:tank-")), playbook.id);
    assert.equal(new Set(tank).size, 15, playbook.id);
    assert.equal(tank.at(-1), "year:tank-showcase");
    assert.ok(splits.every(meeting => !meeting.paths.g5.startsWith("year:tank-")), playbook.id);
  }
  const text = JSON.stringify(PLAYBOOKS) + JSON.stringify(PLAYBOOK_LESSONS);
  assert.doesNotMatch(text, /Tank Jr|first CIRC Tank/);
});

test("the grade 5 KidWind block sits around December without fixed calendar dates", () => {
  for (const playbook of PLAYBOOKS) {
    const unit = playbook.units.find(item => item.title === "KidWind and CIRC Tank");
    if (playbook.id === "a") assert.equal(unit.season, "About December");
    else {
      // B's full-year position is not a verified 2027-28 placement.
      assert.match(unit.season, /^Late fall\. Teacher places the four visits around December after checking next year's calendar$/);
      assert.match(unit.meetings[0].note, /Not a verified 2027-28 placement/);
      assert.match(unit.meetings[0].note, /Keep the four KidWind visits in order and Tank 1 and 2 before Tank 3/);
    }
    assert.deepEqual(unit.meetings.map(meeting => meeting.paths.g5), ["year:kidwind-lift", "year:kidwind-variable", "year:kidwind-best", "year:kidwind-share"]);
    const before = listMeetings(playbook.id).filter(meeting => meeting.number < unit.meetings[0].number);
    assert.ok(before.some(meeting => meeting.kind === "flex"), "FLEX A comes before the KidWind block");
  }
  assert.doesNotMatch(JSON.stringify(PLAYBOOKS), /\b20\d\d-\d\d-\d\d\b|\b(?:Dec|Jan|Nov) \d{1,2}\b/);
});

test("flex and buffer time are real catch-up slots that never start a multi-meeting unit", () => {
  const series = /^year:(?:kidwind|tank|tinker|b-code|studio|innovation)-/;
  for (const playbook of PLAYBOOKS) {
    const meetings = listMeetings(playbook.id);
    const flex = meetings.filter(meeting => meeting.kind === "flex");
    assert.equal(flex.length, 2, playbook.id);
    for (const meeting of flex) {
      assert.equal(meeting.paths["catch-up"], "year:catch-up");
      assert.doesNotMatch(meeting.paths["on-track"], series);
    }
    assert.equal(resolveMeeting(playbook.id, flex[0].number).lesson.ref, "year:catch-up", "catch-up is the default");
    assert.notEqual(resolveMeeting(playbook.id, flex[0].number, { option: "on-track" }).lesson.ref, "year:catch-up");
  }
});

test("Playbook B is new shared work with the same skills, not Playbook A renamed", () => {
  const shared = id => new Set(listMeetings(id).map(meeting => meeting.paths.both ?? meeting.paths["on-track"]).filter(Boolean));
  const a = shared("a");
  const b = shared("b");
  const repeated = [...b].filter(ref => a.has(ref));
  assert.deepEqual(repeated, ["year:reflect-reset"], "only the end-of-year reflection repeats");
  for (const id of ["a", "b"]) {
    for (const path of ["g5", "g6"]) {
      const coverage = strandCoverage(id, path);
      for (const strand of STRANDS) assert.ok(coverage[strand.id] >= 1, `${id} ${path} ${strand.id}`);
    }
  }
  assert.ok(strandCoverage("b", "g5").library > strandCoverage("a", "g5").library, "B carries more library work");
  assert.ok(strandCoverage("a", "g5").cs >= 6, "A keeps the six-visit Tinkercad block");
});

test("student links carry curriculum identifiers only and survive a reload", () => {
  const link = buildStudentLink({ playbook: "a", meeting: 10, grade: 5 });
  assert.equal(link, "student.html?playbook=a&meeting=10&grade=5");
  assert.deepEqual(parseStudentLink(link.slice(link.indexOf("?"))), { playbook: "a", meeting: 10, grade: 5, option: null });
  const hostile = parseStudentLink("?playbook=a&meeting=12&grade=6&class=PRIVATE_CLASS&teacher=Someone&date=2026-10-01&time=09:00");
  assert.deepEqual(hostile, { playbook: "a", meeting: 12, grade: 6, option: null });
  assert.equal(buildStudentLink({ ...hostile, class: "PRIVATE_CLASS" }), "student.html?playbook=a&meeting=12&grade=6");
  assert.deepEqual(parseStudentLink("?playbook=z&meeting=1"), { playbook: null, meeting: null, grade: null, option: null });
  assert.equal(parseStudentLink("?playbook=b&meeting=99").meeting, null);
  assert.equal(parseStudentLink("#playbook=b&meeting=3&option=on-track").option, "on-track");
});

test("the continuum is described as guidance with no formal standards claim", async () => {
  const source = await readFile(new URL("../src/ui/playbook-view.js", import.meta.url), "utf8");
  assert.match(source, /No formal standards alignment is claimed/);
  const model = await readFile(new URL("../src/model/playbooks.js", import.meta.url), "utf8");
  assert.doesNotMatch(model + source, /aligned to (?:PA )?STEELS/i);
});

const KIDWIND = ["year:kidwind-lift", "year:kidwind-variable", "year:kidwind-best", "year:kidwind-share"];

function studentVisibleText(lesson) {
  return JSON.stringify({
    title: lesson.title, goal: lesson.goal, materials: lesson.materials, safety: lesson.safety,
    steps: lesson.steps.map(step => ({ label: step.label, directions: step.directions })),
    success: lesson.success, turnIn: lesson.turnIn, extension: lesson.extension, fallback: lesson.fallback,
    adapt: lesson.adapt, paperPath: lesson.paperPath
  });
}

test("all four KidWind visits use one bounded measurement, pilot preparation and a labeled paper path", () => {
  for (const ref of KIDWIND) {
    const lesson = getLessonForRef(ref);
    const everything = JSON.stringify(lesson);
    assert.doesNotMatch(everything, /clip|pinwheel|turns? in ten|count the turns|six identical/i, ref);
    assert.match(lesson.turnIn, /centimeters?\b/, ref);
    assert.match(lesson.teacherNotes.join(" "), /10 seconds.*0 to 20.*Stop early at the 20 cm mark/, ref);
    assert.match(lesson.teacherNotes.join(" "), /CIRC adaptation, not an official KidWind lesson/, ref);
    assert.match(lesson.prepRequired, /Build and pilot one working station/, ref);
    assert.match(lesson.prep.join(" "), /Preparation required/, ref);
    assert.equal(lesson.paperPath.note, "Use these paper steps instead when your teacher chooses the no-fan path.");
    assert.equal(lesson.paperPath.goal, "I can explain how wind can lift a load and use sample results to plan a fair test.");
    assert.equal(lesson.paperPath.data.label, "Practice data created for this lesson. These are not student measurements or evidence about a real blade design.");
    assert.match(lesson.paperPath.data.unit, /Centimeters lifted in 10 seconds with one unchanged cup and load/);
    assert.deepEqual(lesson.paperPath.data.rows.map(row => row.slice(2)), [["5", "10", "5"], ["10", "15", "10"], ["10", "10", "15"]]);
    assert.equal(lesson.minutes, 35, ref);
    assert.ok(lesson.steps.filter(step => step.kind !== "cleanup").some(step => /centimeters/i.test(step.directions.join(" "))), ref);
  }
  const variable = getLessonForRef("year:kidwind-variable");
  assert.match(variable.steps.find(step => step.label === "Test A and B").directions.join(" "), /Set A once.*Set B once/, "visit 2 fits one shared station");
  assert.match(variable.turnIn, /first results/);
});

test("no screen or device evidence is required after laptops are put away", () => {
  const deviceCleanup = /laptop|device|Close the lid/i;
  // Pointing at paper is fine; screen, file and model views are not.
  const needsScreen = /screen|simulator|in the folder|file name|animation|from underneath|from the side|matching sides/i;
  for (const lesson of PLAYBOOK_LESSONS) {
    const cleanupIndex = lesson.steps.findIndex(step => step.kind === "cleanup" && deviceCleanup.test(step.directions.join(" ")));
    if (cleanupIndex < 0) continue;
    for (const step of lesson.steps.slice(cleanupIndex + 1)) {
      assert.doesNotMatch(step.directions.join(" "), needsScreen, `${lesson.id} ${step.label}`);
    }
  }
  const moved = { "tinker-move": "Check it", "tinker-holes": "Check the hole", "tinker-mirror": "Check both sides", "tinker-export": "Queue it", "b-code-loops": "Debug" };
  for (const [id, label] of Object.entries(moved)) {
    const lesson = PLAYBOOK_LESSONS.find(item => item.id === id);
    assert.match(lesson.steps.find(step => step.label === label).directions.join(" "), /Show a partner|Show your animation|file name is there/, id);
    assert.equal(lesson.steps.reduce((sum, step) => sum + step.minutes, 0), 35, id);
  }
});

test("Canva turn-in means the teacher can open it, and public lesson text names no teacher", () => {
  for (const ref of ["year:circ-canva-template", "year:circ-canva-original", "year:b-factcard-design"]) {
    const lesson = getLessonForRef(ref);
    assert.match(lesson.turnIn, /^Share with your CIRC teacher's school account\. It is turned in when your teacher can open it\. Keep public and link sharing unchanged\./, ref);
    const share = lesson.steps.find(step => step.label === "Share with teacher");
    assert.match(share.directions.join(" "), /Add your CIRC teacher's school account\. It is turned in when your teacher can open it\./, ref);
    assert.doesNotMatch(JSON.stringify(lesson), /shows in Share|name shows|his name/, ref);
    assert.ok(lesson.fallback.match(/paper/i), ref);
  }
  for (const playbook of PLAYBOOKS) {
    for (const { ref } of allPaths(playbook.id)) {
      assert.doesNotMatch(studentVisibleText(getLessonForRef(ref)), /Macek|\bMr\.|\bMrs\.|\bMs\./, ref);
    }
  }
});

test("teacher-prepared source and AI cards are marked as preparation, not a ready packet", () => {
  for (const ref of ["year:b-factcard-research", "year:b-ai-check"]) {
    assert.match(getLessonForRef(ref).prepRequired, /^Preparation required: .*This packet does not supply/, ref);
  }
  assert.equal(getLessonForRef("year:circ-cardboard").prepRequired, "");
});

test("public cardboard and Circuit Rescue plans retain preparation without personal or class-progress notes", () => {
  const ids = ["replica-cardboard", "circuit-rescue-build", "circuit-rescue-test", "circuit-rescue-share"];
  for (const modeId of ids) {
    const plan = getExperienceTimingPlan(2, { modeId });
    const context = [...REPLICA_LESSON_CHOICES, ...PLAYBOOK_LESSONS].find(lesson => lesson.id === modeId);
    assert.ok(context, modeId);
    const text = JSON.stringify({ plan, context });
    assert.doesNotMatch(text, /Kenny|Macek|expected Friday|photos have not been reviewed|seven classes a day|workload estimate|classes have not touched|untouched Tech Terrarium|October 2 correction/i, modeId);
    assert.equal(plan.steps.reduce((sum, step) => sum + step.minutes, 0), 35, modeId);
    if (modeId === "replica-cardboard" || modeId === "circuit-rescue-build") assert.match(text, /pilot/i, modeId);
  }
  const cardboard = getExperienceTimingPlan(2, { modeId: "replica-cardboard" });
  assert.deepEqual(cardboard.steps.map(step => step.minutes), [3, 6, 3, 15, 3, 3, 2]);
  assert.match(JSON.stringify(cardboard), /six teams/i);
  assert.match(JSON.stringify(REPLICA_LESSON_CHOICES.find(lesson => lesson.id === "replica-cardboard")), /separate adult preparation/i);
});


test("jingle reuses the first logo, exposes usable resources, and retains the older lesson", () => {
  const lesson = resolveMeeting("a", 3).lesson;
  assert.equal(listMeetings("a")[1].done, true);
  assert.equal(lesson.runner.modeId, "circ-logo-jingle");
  assert.deepEqual(lesson.steps.map(step => step.minutes), [4, 5, 7, 8, 4, 3, 4]);
  assert.match(lesson.goal, /first logo/);
  assert.match(lesson.turnIn, /teacher can open it/);
  assert.ok(lesson.resources.some(resource => resource.url === "https://www.beepbox.co/"));
  assert.ok(lesson.resources.every(resource => resource.url.startsWith("https://")));
  assert.ok(getLessonForRef("year:circ-canva-original"), "older saved lesson remains available");
});
