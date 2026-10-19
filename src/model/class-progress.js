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

// Private teaching notes are separate from curriculum positions. Recording a
// visit never advances a class, changes a plan, or claims a lesson was taught.
export const CLASS_JOURNAL_STORAGE_KEY = "circHQ.classJournal.local.v1";
const JOURNAL_LIMIT = 5000;
const JOURNAL_BYTES = 4000000;
const JOURNAL_STATUSES = new Set(["taught", "continued", "planned"]);
function journalKey(owner) { key(owner); return `${CLASS_JOURNAL_STORAGE_KEY}:${encodeURIComponent(owner)}`; }
function emptyJournal() { return { version: 1, scope: "local-only", entries: [] }; }
function shortText(value, max, required = false) {
  return typeof value === "string" && value.length <= max && (!required || value.trim().length > 0) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
}
function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
function validateJournal(book) {
  if (!record(book) || book.version !== 1 || book.scope !== "local-only" || !Array.isArray(book.entries) || book.entries.length > JOURNAL_LIMIT) throw new TypeError("This is not a readable CIRC teaching record.");
  const ids = new Set();
  for (const entry of book.entries) {
    if (!record(entry) || !shortText(entry.id, 100, true) || ids.has(entry.id) || !classKeyOk(entry.classKey) || !shortText(entry.classLabel, 160, true) || !validDate(entry.date) || !shortText(entry.lessonTitle, 200, true) || !JOURNAL_STATUSES.has(entry.status) || !shortText(entry.note, 3000, true) || !shortText(entry.nextVisit, 1500) || !shortText(entry.recordedAt, 40, true) || !Number.isFinite(Date.parse(entry.recordedAt))) throw new TypeError("This is not a readable CIRC teaching record.");
    ids.add(entry.id);
  }
  if (JSON.stringify(book).length > JOURNAL_BYTES) throw new TypeError("The teaching record is full. Export it before starting a new record.");
  return book;
}
export function loadClassJournal(storage, owner) {
  try {
    if (!storage?.getItem) return { status: "unavailable", book: emptyJournal() };
    const raw = storage.getItem(journalKey(owner));
    if (raw === null) return { status: "empty", book: emptyJournal() };
    try { return { status: "saved", book: validateJournal(JSON.parse(raw)) }; }
    catch { return { status: "invalid", book: emptyJournal() }; }
  } catch { return { status: "unavailable", book: emptyJournal() }; }
}
function writeJournal(storage, owner, book) {
  validateJournal(book);
  const text = JSON.stringify(book);
  try {
    storage.setItem(journalKey(owner), text);
    if (storage.getItem(journalKey(owner)) !== text) throw new Error("readback");
  } catch { throw new TypeError("The teaching record could not be verified as saved. Keep your note and try again."); }
  return book;
}
export function appendClassJournal(storage, owner, entry, { now = new Date() } = {}) {
  const loaded = loadClassJournal(storage, owner);
  if (["invalid", "unavailable"].includes(loaded.status)) throw new TypeError("The saved teaching record could not be read. It was left untouched.");
  const book = structuredClone(loaded.book);
  let id = `visit-${now.getTime()}-${book.entries.length}`;
  while (book.entries.some(item => item.id === id)) id += "x";
  book.entries.push({ id, classKey: entry.classKey, classLabel: entry.classLabel, date: entry.date, lessonTitle: entry.lessonTitle, status: entry.status, note: entry.note, nextVisit: entry.nextVisit ?? "", recordedAt: now.toISOString() });
  return writeJournal(storage, owner, book);
}
export function exportClassJournal(storage, owner) {
  const loaded = loadClassJournal(storage, owner);
  if (["invalid", "unavailable"].includes(loaded.status)) throw new TypeError("The teaching record could not be read, so no empty replacement was exported.");
  // Match the import/storage bound exactly; pretty-printing can expand a valid
  // near-capacity record beyond the size accepted by its own restore path.
  return JSON.stringify(loaded.book);
}
export function importClassJournal(storage, owner, text) {
  if (typeof text !== "string" || text.length > JOURNAL_BYTES) throw new TypeError("Choose a CIRC teaching-record JSON file smaller than 4 MB.");
  let incoming;
  try { incoming = validateJournal(JSON.parse(text)); } catch { throw new TypeError("That file is not a valid CIRC teaching record. Nothing was changed."); }
  const loaded = loadClassJournal(storage, owner);
  if (["invalid", "unavailable"].includes(loaded.status)) throw new TypeError("The saved teaching record could not be read. It was left untouched.");
  const book = structuredClone(loaded.book);
  for (const entry of incoming.entries) {
    const existing = book.entries.find(item => item.id === entry.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(entry)) throw new TypeError("A saved visit conflicts with this file. Nothing was changed.");
    if (!existing) book.entries.push(entry);
  }
  return writeJournal(storage, owner, book);
}
