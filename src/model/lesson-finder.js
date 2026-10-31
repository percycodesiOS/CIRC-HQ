// Lesson finder and handout index shared by the student page, the resource hub
// and the handout build script. Pure data and functions over the playbooks:
// this module never reads storage, a schedule, a class list or cloud data.
import { PLAYBOOKS, STRANDS, getLessonForRef, getPlaybook, lessonTitleForRef, listMeetings, meetingTitle, pathLabel } from "./playbooks.js";

export const HANDOUT_FOLDER = "assets/handouts";
const SMALL_WORDS = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with", "without"]);

function freeze(value) { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

// "Logo to jingle: Give your brand a sound" becomes "Logo-to-Jingle". The part
// before a colon names the lesson; the rest is a subtitle. Letters, digits and
// single hyphens only, so the name is safe on every file system and in Teams.
export function handoutStem(title) {
  const head = String(title ?? "").split(/:\s/)[0].trim() || String(title ?? "").trim();
  const words = head.replace(/[^A-Za-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const cased = words.map((word, index) => {
    const lower = word.toLowerCase();
    if (index > 0 && SMALL_WORDS.has(lower)) return lower;
    return /^[a-z]/.test(word) ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  });
  return cased.join("-").slice(0, 60).replace(/-+$/, "");
}

function gradeSummary(places) {
  const paths = new Set(places.map(place => place.path));
  if (paths.has("both") || paths.has("catch-up") || paths.has("on-track")) return "both";
  if (paths.has("g5") && paths.has("g6")) return "mixed";
  if (paths.has("g5")) return "5";
  return "6";
}

function gradeLabel(summary) {
  return summary === "both" ? "Grades 5 and 6" : summary === "mixed" ? "Grade 5 or 6, by meeting" : `Grade ${summary}`;
}

function placeLabel(place) {
  const playbook = getPlaybook(place.playbook);
  const base = `${playbook.name} meeting ${place.meeting}`;
  if (place.path === "g5" || place.path === "g6") return `${base}, ${pathLabel(place.path).toLowerCase()} path`;
  if (place.path === "on-track") return `${base}, on-track choice`;
  if (place.path === "catch-up") return `${base}, catch up`;
  return base;
}

function searchText(lesson, places) {
  const strands = lesson.strands.map(id => STRANDS.find(strand => strand.id === id)?.label ?? "").join(" ");
  const units = places.map(place => place.unit).join(" ");
  return [lesson.title, lesson.goal, strands, units, ...lesson.materials, lesson.turnIn, lesson.fallback]
    .join(" ")
    .toLowerCase();
}

let handoutCache = null;

// One entry per unique lesson across both playbooks, in Playbook A order, then
// lessons that only Playbook B uses. Stems are unique.
export function listHandouts() {
  if (handoutCache) return handoutCache;
  const entries = new Map();
  for (const playbook of PLAYBOOKS) {
    for (const meeting of listMeetings(playbook.id)) {
      for (const [path, ref] of Object.entries(meeting.paths)) {
        const place = { playbook: playbook.id, meeting: meeting.number, path, unit: meeting.unit, season: meeting.season, kind: meeting.kind, done: Boolean(meeting.done) };
        if (entries.has(ref)) { entries.get(ref).places.push(place); continue; }
        const lesson = getLessonForRef(ref);
        if (!lesson) continue;
        entries.set(ref, { ref, lesson, places: [place] });
      }
    }
  }
  const used = new Map();
  const list = [...entries.values()].map(({ ref, lesson, places }) => {
    let stem = handoutStem(lesson.title) || "Lesson";
    const count = used.get(stem) ?? 0;
    used.set(stem, count + 1);
    if (count) stem = `${stem}-${count + 1}`;
    const grades = gradeSummary(places);
    return {
      ref,
      stem,
      title: lesson.title,
      goal: lesson.goal,
      minutes: lesson.minutes,
      stepCount: lesson.steps.length,
      strands: [...lesson.strands],
      grades,
      gradeLabel: gradeLabel(grades),
      hasPaperPath: Boolean(lesson.paperPath),
      hasResources: Boolean(lesson.resources?.some(resource => !resource.teacherOnly)),
      places: places.map(place => ({ ...place, label: placeLabel(place) })),
      files: {
        pdf: `${HANDOUT_FOLDER}/CIRC-${stem}-Student.pdf`,
        docx: `${HANDOUT_FOLDER}/CIRC-${stem}-Response.docx`
      },
      search: searchText(lesson, places)
    };
  });
  handoutCache = freeze(list);
  return handoutCache;
}

export function handoutForRef(ref) {
  return listHandouts().find(entry => entry.ref === ref) ?? null;
}

export function handoutForMeeting(playbookId, number, path) {
  return listHandouts().find(entry => entry.places.some(place => place.playbook === playbookId && place.meeting === number && place.path === path)) ?? null;
}

function normalizeQuery(query) {
  return String(query ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
}

// Resource hub filter. grade: null, 5 or 6. playbook: null, "a" or "b".
// format: null, "pdf", "docx" or "paper" (lessons with a no-device paper path).
export function searchHandouts({ query = "", grade = null, playbook = null, format = null } = {}) {
  const terms = normalizeQuery(query);
  return listHandouts().filter(entry => {
    if (grade === 5 && entry.grades === "6") return false;
    if (grade === 6 && entry.grades === "5") return false;
    if (grade && entry.grades === "mixed" && !entry.places.some(place => place.path === `g${grade}`)) return false;
    if (playbook && !entry.places.some(place => place.playbook === playbook)) return false;
    if (format === "paper" && !entry.hasPaperPath) return false;
    return terms.every(term => entry.search.includes(term));
  });
}

// Student finder for one playbook. Returns the meeting list with the title a
// student in that grade would see, filtered by a plain search.
export function findMeetings(playbookId, { query = "", grade = null, paperOnly = false } = {}) {
  const terms = normalizeQuery(query);
  const playbook = getPlaybook(playbookId);
  if (!playbook) return [];
  return listMeetings(playbookId).map(meeting => {
    const split = !meeting.paths.both && meeting.kind === "lesson";
    const path = meeting.paths.both ? "both" : split ? (grade ? `g${grade}` : null) : meeting.kind === "flex" ? "on-track" : "catch-up";
    const refs = path ? [meeting.paths[path]] : Object.values(meeting.paths);
    const entries = refs.map(ref => handoutForRef(ref)).filter(Boolean);
    const title = split && grade
      ? lessonTitleForRef(meeting.paths[`g${grade}`])
      : meetingTitle(meeting);
    const otherGrade = split && grade ? `Grade ${grade === 5 ? 6 : 5} does ${lessonTitleForRef(meeting.paths[grade === 5 ? "g6" : "g5"])}.` : "";
    const text = `${title} ${meeting.unit} ${meeting.season} ${entries.map(entry => entry.search).join(" ")}`.toLowerCase();
    const matches = terms.every(term => text.includes(term)) && (!paperOnly || entries.some(entry => entry.hasPaperPath));
    return { meeting, title, otherGrade, split, entries, matches };
  }).filter(item => item.matches);
}

export function strandLabel(id) {
  return STRANDS.find(strand => strand.id === id)?.short ?? "";
}
