import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { findMeetings, handoutForMeeting, handoutForRef, handoutStem, listHandouts, searchHandouts } from "../src/model/lesson-finder.js";
import { PLAYBOOKS, getLessonForRef, listMeetings } from "../src/model/playbooks.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the finder is pure curriculum: no storage, schedule, cloud or teacher record import", async () => {
  const source = await readFile(path.join(ROOT, "src", "model", "lesson-finder.js"), "utf8");
  assert.doesNotMatch(source, /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|document\.cookie|\bfetch\(|firebase/i);
  for (const match of source.matchAll(/from\s+"([^"]+)"/g)) assert.equal(match[1], "./playbooks.js");
});

test("every meeting path in both playbooks has exactly one handout entry with a unique, friendly file name", () => {
  const handouts = listHandouts();
  assert.equal(new Set(handouts.map(entry => entry.stem)).size, handouts.length, "stems are unique");
  for (const entry of handouts) {
    assert.match(entry.stem, /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, entry.stem);
    assert.equal(entry.files.pdf, `assets/handouts/CIRC-${entry.stem}-Student.pdf`);
    assert.equal(entry.files.docx, `assets/handouts/CIRC-${entry.stem}-Response.docx`);
    assert.ok(entry.places.length >= 1 && entry.minutes === 35 && entry.stepCount >= 7, entry.stem);
  }
  for (const playbook of PLAYBOOKS) {
    for (const meeting of listMeetings(playbook.id)) {
      for (const [pathId, ref] of Object.entries(meeting.paths)) {
        const entry = handoutForMeeting(playbook.id, meeting.number, pathId);
        assert.ok(entry, `${playbook.id} ${meeting.number} ${pathId}`);
        assert.equal(entry.ref, ref);
        assert.equal(entry.title, getLessonForRef(ref).title);
      }
    }
  }
});

test("file stems keep the lesson name, drop subtitles and never split a word like Micro:bit", () => {
  assert.equal(handoutStem("Logo to jingle: Give your brand a sound"), "Logo-to-Jingle");
  assert.equal(handoutStem("KidWind 1: Make the wind do work"), "KidWind-1");
  assert.equal(handoutStem("Micro:bit Sensor Station"), "Micro-Bit-Sensor-Station");
  assert.equal(handoutStem("Fix, Remix, or Invent Studio"), "Fix-Remix-or-Invent-Studio");
  assert.equal(handoutForRef("year:circ-logo-jingle").stem, "Logo-to-Jingle");
});

test("grade summaries follow the meeting paths and repeated lessons list every place", () => {
  const kidwind = handoutForRef("year:kidwind-lift");
  assert.equal(kidwind.grades, "5");
  assert.equal(kidwind.gradeLabel, "Grade 5");
  assert.equal(kidwind.hasPaperPath, true);
  assert.deepEqual(kidwind.places.map(place => `${place.playbook}${place.meeting}:${place.path}`), ["a10:g5", "b11:g5"]);
  assert.match(kidwind.places[0].label, /Playbook A meeting 10, grade 5 path/);
  const jingle = handoutForRef("year:circ-logo-jingle");
  assert.equal(jingle.grades, "both");
  assert.equal(jingle.gradeLabel, "Grades 5 and 6");
  const catchUp = handoutForRef("year:catch-up");
  assert.ok(catchUp.places.length >= 4, "catch up is shared by every flex and buffer meeting");
});

test("the resource search filters by grade, playbook, format and plain words", () => {
  const all = searchHandouts();
  assert.equal(all.length, listHandouts().length);
  const tinkercad = searchHandouts({ query: "tinkercad", playbook: "a", grade: 6 });
  assert.deepEqual(tinkercad.map(entry => entry.stem), ["Tinkercad-1", "Tinkercad-2", "Tinkercad-3", "Tinkercad-4", "Tinkercad-5", "Tinkercad-6"]);
  assert.equal(searchHandouts({ grade: 6 }).some(entry => entry.stem === "KidWind-1"), false, "grade 6 never sees the grade 5 KidWind block");
  assert.equal(searchHandouts({ grade: 5 }).some(entry => entry.stem === "Tank-1"), false, "grade 5 never runs Tank");
  assert.deepEqual(searchHandouts({ format: "paper" }).map(entry => entry.stem), ["KidWind-1", "KidWind-2", "KidWind-3", "KidWind-4"]);
  assert.equal(searchHandouts({ query: "zzzz no such lesson" }).length, 0);
  assert.equal(searchHandouts({ playbook: "b" }).some(entry => entry.stem === "Welcome-to-CIRC"), true);
});

test("the student finder shows one title per grade at a split meeting and keeps the other grade visible", () => {
  const grade5 = findMeetings("a", { grade: 5 });
  assert.equal(grade5.length, listMeetings("a").length, "no search means every meeting");
  const ten = grade5.find(item => item.meeting.number === 10);
  assert.equal(ten.title, "KidWind 1: Make the wind do work");
  assert.match(ten.otherGrade, /^Grade 6 does Tank 3/);
  const shared = grade5.find(item => item.meeting.number === 3);
  assert.equal(shared.title, "Logo to jingle: Give your brand a sound");
  assert.equal(shared.otherGrade, "");
  const wind = findMeetings("a", { grade: 5, query: "kidwind" }).map(item => item.meeting.number);
  assert.deepEqual(wind.slice(0, 4), [10, 11, 12, 13], "the four KidWind visits lead the matches");
  assert.equal(wind.includes(6), false, "Paper Bridge does not mention KidWind");
  const paper = findMeetings("a", { grade: 5, paperOnly: true }).map(item => item.meeting.number);
  assert.deepEqual(paper, [10, 11, 12, 13]);
  const bothGrades = findMeetings("a", {}).find(item => item.meeting.number === 10);
  assert.match(bothGrades.title, /^Grade 5: KidWind 1.*Grade 6: Tank 3/);
  assert.deepEqual(findMeetings("nope", {}), []);
});
