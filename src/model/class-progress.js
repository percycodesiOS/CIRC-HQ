// Where each class is in a playbook. Stored on this browser only, keyed by the
// teacher's own class label. Never synced, never part of a student link.
import { getMeeting, getPlaybook } from "./playbooks.js";

export const CLASS_PROGRESS_STORAGE_KEY = "circHQ.classProgress.local.v1";
const MAX_CLASSES = 120;

function record(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }

function key(owner) {
  if (typeof owner !== "string" || !owner || owner.length > 200) throw new TypeError("Select a teacher before saving class places.");
  return `${CLASS_PROGRESS_STORAGE_KEY}:${encodeURIComponent(owner)}`;
}

function classKeyOk(value) {
  return typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= 80 && !/[<>\u0000-\u001f]/.test(value);
}

function placeOk(place) {
  return record(place) && getPlaybook(place.playbook) && Number.isInteger(place.meeting) && getMeeting(place.playbook, place.meeting) &&
    (place.grade === null || place.grade === 5 || place.grade === 6) &&
    (place.option === null || place.option === "on-track") && typeof place.updatedAt === "string";
}

function empty() { return { version: 1, scope: "local-only", classes: {} }; }

function validate(value) {
  if (!record(value) || value.version !== 1 || value.scope !== "local-only" || !record(value.classes) ||
      Object.keys(value.classes).length > MAX_CLASSES) throw new TypeError("unreadable");
  for (const [classKey, place] of Object.entries(value.classes)) {
    if (!classKeyOk(classKey) || !placeOk(place)) throw new TypeError("unreadable");
  }
  return value;
}

export function guessGrade(label) {
  const match = /(?:^|\b(?:grade|gr)\s*)([56])(?![0-9])/i.exec(String(label ?? "").trim());
  return match ? Number(match[1]) : null;
}

export function loadClassProgress(storage, owner) {
  try {
    if (!storage?.getItem) return { status: "unavailable", book: empty() };
    const raw = storage.getItem(key(owner));
    if (raw === null) return { status: "empty", book: empty() };
    try { return { status: "saved", book: validate(JSON.parse(raw)) }; }
    catch { return { status: "invalid", book: empty() }; }
  } catch { return { status: "unavailable", book: empty() }; }
}

export function classPlace(book, classKey, label = classKey) {
  const saved = book?.classes?.[classKey];
  if (saved) return { ...saved, saved: true };
  return { playbook: "a", meeting: getPlaybook("a").nextMeeting, grade: guessGrade(label), option: null, saved: false };
}

export function saveClassPlace(storage, owner, classKey, place, { now = new Date() } = {}) {
  if (!classKeyOk(classKey)) throw new TypeError("This class needs a short label in the schedule before its place can be saved.");
  const loaded = loadClassProgress(storage, owner);
  if (loaded.status === "invalid" || loaded.status === "unavailable") throw new TypeError("Saved class places could not be read, so nothing was changed.");
  const next = structuredClone(loaded.book);
  const entry = { playbook: place.playbook, meeting: place.meeting, grade: place.grade ?? null, option: place.option ?? null, updatedAt: now.toISOString() };
  if (!placeOk(entry)) throw new TypeError("Choose a playbook meeting that exists.");
  next.classes[classKey] = entry;
  validate(next);
  const raw = JSON.stringify(next);
  try {
    storage.setItem(key(owner), raw);
    if (storage.getItem(key(owner)) !== raw) throw new Error("readback");
  } catch { throw new TypeError("The class place could not be verified as saved on this browser."); }
  return next;
}
