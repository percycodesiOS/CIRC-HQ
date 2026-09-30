// Private dated updates: appointments, meetings and assignment changes that are
// not part of the five-day schedule. A person or an authorized process reads
// the school calendar in the school browser and saves a small file. The
// teacher imports it on this device. This static site never reads Outlook,
// email or any school account by itself. Local to this browser, never synced.
export const DATED_UPDATES_STORAGE_KEY = "circHQ.datedUpdates.local.v1";
export const DATED_UPDATES_FORMAT = "circHQ.datedUpdates.v1";
export const STALE_AFTER_DAYS = 7;
const MAX_UPDATES = 300;
const MAX_RANGE_DAYS = 120;
const MAX_TEXT = 2000000;
const FUTURE_SKEW_MS = 10 * 60 * 1000;
const TOP_KEYS = ["checkedFrom", "checkedThrough", "format", "preparedAt", "updates"];
const REQUIRED_UPDATE_KEYS = ["date", "end", "id", "source", "start", "status", "title", "verifiedAt"];
const OPTIONAL_UPDATE_KEYS = ["kind", "place"];
const STATUSES = new Set(["confirmed", "tentative", "cancelled"]);
const KINDS = new Set(["appointment", "assignment", "duty", "meeting", "event"]);
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function record(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }

export function isDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function dayNumber(dateKey) { return Date.UTC(Number(dateKey.slice(0, 4)), Number(dateKey.slice(5, 7)) - 1, Number(dateKey.slice(8, 10))) / 86400000; }

export function timeMinutes(value) {
  const match = typeof value === "string" ? /^(\d{2}):(\d{2})$/.exec(value) : null;
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

function isoTime(value) {
  if (typeof value !== "string" || !ISO_DATE_TIME.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function label(value, max) {
  return typeof value === "string" && value === value.trim() && value.length > 0 && value.length <= max &&
    !/[<>\u0000-\u001f]/.test(value) && !/@|https?:|www\./i.test(value);
}

// Returns { ok, value, errors }. All or nothing: one bad entry rejects the file.
export function validateDatedUpdates(candidate, { now = new Date() } = {}) {
  const errors = [];
  const nowMs = now.getTime();
  if (!record(candidate)) return { ok: false, value: null, errors: ["The file must be one JSON object."] };
  const keys = Object.keys(candidate).sort();
  if (keys.join(",") !== TOP_KEYS.join(",")) errors.push(`Use exactly these fields: ${TOP_KEYS.join(", ")}.`);
  if (candidate.format !== DATED_UPDATES_FORMAT) errors.push(`format must be "${DATED_UPDATES_FORMAT}".`);
  const fromOk = isDateKey(candidate.checkedFrom);
  const throughOk = isDateKey(candidate.checkedThrough);
  if (!fromOk) errors.push("checkedFrom must be a YYYY-MM-DD date.");
  if (!throughOk) errors.push("checkedThrough must be a YYYY-MM-DD date.");
  if (fromOk && throughOk) {
    const span = dayNumber(candidate.checkedThrough) - dayNumber(candidate.checkedFrom);
    if (span < 0) errors.push("checkedThrough must not be before checkedFrom.");
    else if (span > MAX_RANGE_DAYS) errors.push(`The checked range can cover at most ${MAX_RANGE_DAYS} days.`);
  }
  const prepared = isoTime(candidate.preparedAt);
  if (prepared === null) errors.push("preparedAt must be a date and time with a time zone, like 2026-09-29T14:05:00-04:00.");
  else if (prepared > nowMs + FUTURE_SKEW_MS) errors.push("preparedAt is in the future. Check the device clock or the file.");
  if (!Array.isArray(candidate.updates)) {
    errors.push("updates must be a list. Use [] when the checked range has nothing to add.");
    return { ok: false, value: null, errors };
  }
  if (candidate.updates.length > MAX_UPDATES) errors.push(`A file can hold at most ${MAX_UPDATES} updates.`);
  const ids = new Set();
  const updates = [];
  candidate.updates.forEach((update, index) => {
    const where = `Update ${index + 1}`;
    if (!record(update)) { errors.push(`${where} must be an object.`); return; }
    const updateKeys = Object.keys(update);
    const missing = REQUIRED_UPDATE_KEYS.filter(key => !updateKeys.includes(key));
    const extra = updateKeys.filter(key => !REQUIRED_UPDATE_KEYS.includes(key) && !OPTIONAL_UPDATE_KEYS.includes(key));
    if (missing.length) errors.push(`${where} is missing: ${missing.join(", ")}.`);
    if (extra.length) errors.push(`${where} has fields this app does not accept: ${extra.join(", ")}.`);
    if (typeof update.id !== "string" || !/^[A-Za-z0-9-]{1,40}$/.test(update.id)) errors.push(`${where} id must be 1 to 40 letters, numbers or hyphens.`);
    else if (ids.has(update.id)) errors.push(`${where} repeats the id "${update.id}".`);
    else ids.add(update.id);
    if (!isDateKey(update.date)) errors.push(`${where} date must be a YYYY-MM-DD date.`);
    else if (fromOk && throughOk && (update.date < candidate.checkedFrom || update.date > candidate.checkedThrough)) errors.push(`${where} date is outside the checked range.`);
    const start = timeMinutes(update.start);
    const end = timeMinutes(update.end);
    if (start === null) errors.push(`${where} start must be HH:MM in 24 hour time.`);
    if (end === null) errors.push(`${where} end must be HH:MM in 24 hour time.`);
    if (start !== null && end !== null && end <= start) errors.push(`${where} end must be after start.`);
    if (!label(update.title, 120)) errors.push(`${where} title must be 1 to 120 characters with no email address, link or brackets.`);
    if (update.place !== undefined && !label(update.place, 120)) errors.push(`${where} place must be 1 to 120 characters with no email address, link or brackets.`);
    if (!label(update.source, 160)) errors.push(`${where} source must say where it was checked, in 1 to 160 characters, with no email address or link.`);
    if (!STATUSES.has(update.status)) errors.push(`${where} status must be confirmed, tentative or cancelled.`);
    if (update.kind !== undefined && !KINDS.has(update.kind)) errors.push(`${where} kind must be appointment, assignment, duty, meeting or event.`);
    const verified = isoTime(update.verifiedAt);
    if (verified === null) errors.push(`${where} verifiedAt must be a date and time with a time zone.`);
    else if (verified > nowMs + FUTURE_SKEW_MS || (prepared !== null && verified > prepared + FUTURE_SKEW_MS)) errors.push(`${where} verifiedAt is later than the file was prepared.`);
    updates.push({
      id: update.id, date: update.date, start: update.start, end: update.end, title: update.title,
      ...(update.place !== undefined ? { place: update.place } : {}),
      kind: update.kind ?? "event", status: update.status, source: update.source, verifiedAt: update.verifiedAt
    });
  });
  if (errors.length) return { ok: false, value: null, errors };
  updates.sort((left, right) => left.date.localeCompare(right.date) || left.start.localeCompare(right.start) || left.id.localeCompare(right.id));
  return {
    ok: true,
    errors: [],
    value: { format: DATED_UPDATES_FORMAT, checkedFrom: candidate.checkedFrom, checkedThrough: candidate.checkedThrough, preparedAt: candidate.preparedAt, updates }
  };
}

export function previewDatedUpdatesText(text, options = {}) {
  if (typeof text !== "string" || !text.trim()) return { ok: false, value: null, errors: ["Choose or paste a dated update file first."] };
  if (text.length > MAX_TEXT) return { ok: false, value: null, errors: ["That file is too large for dated updates."] };
  let parsed;
  try { parsed = JSON.parse(text); } catch { return { ok: false, value: null, errors: ["That is not valid JSON. Nothing was imported."] }; }
  return validateDatedUpdates(parsed, options);
}

export function loadDatedUpdates(storage, options = {}) {
  try {
    if (!storage?.getItem) return { status: "unavailable", book: null };
    const raw = storage.getItem(DATED_UPDATES_STORAGE_KEY);
    if (raw === null) return { status: "empty", book: null };
    if (typeof raw !== "string" || raw.length > MAX_TEXT) return { status: "invalid", book: null };
    let stored;
    try { stored = JSON.parse(raw); } catch { return { status: "invalid", book: null }; }
    if (!record(stored) || typeof stored.importedAt !== "string" || isoTime(stored.importedAt) === null) return { status: "invalid", book: null };
    const { importedAt, ...document } = stored;
    const checked = validateDatedUpdates(document, { now: options.now ?? new Date(Math.max(Date.now(), isoTime(importedAt))) });
    return checked.ok ? { status: "saved", book: { ...checked.value, importedAt } } : { status: "invalid", book: null };
  } catch { return { status: "unavailable", book: null }; }
}

export function saveDatedUpdates(storage, value, { now = new Date() } = {}) {
  const checked = validateDatedUpdates(value, { now });
  if (!checked.ok) throw new TypeError(checked.errors[0]);
  const raw = JSON.stringify({ ...checked.value, importedAt: now.toISOString() });
  try {
    storage.setItem(DATED_UPDATES_STORAGE_KEY, raw);
    if (storage.getItem(DATED_UPDATES_STORAGE_KEY) !== raw) throw new Error("readback");
  } catch {
    throw new TypeError("The dated updates could not be verified as saved on this browser. Nothing else changed.");
  }
  return { ...checked.value, importedAt: now.toISOString() };
}

export function clearDatedUpdates(storage) {
  try {
    storage.removeItem(DATED_UPDATES_STORAGE_KEY);
    return storage.getItem(DATED_UPDATES_STORAGE_KEY) === null;
  } catch { return false; }
}

function ageLabel(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 2) return "just now";
  if (minutes < 90) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function overlaps(left, right) { return left.startMinutes < right.endMinutes && right.startMinutes < left.endMinutes; }

// scheduleEvents: today's timed schedule entries ({ id, title, startMinutes, endMinutes }).
export function datedUpdatesForDate(book, dateKey, { now = new Date(), scheduleEvents = [] } = {}) {
  if (!book) return { coverage: "none", items: [], stale: false, freshness: "No dated updates imported on this browser." };
  const preparedMs = isoTime(book.preparedAt);
  const ageMs = now.getTime() - preparedMs;
  const stale = ageMs > STALE_AFTER_DAYS * 86400000;
  const freshness = `Dated updates checked ${ageLabel(ageMs)}, covering ${book.checkedFrom} to ${book.checkedThrough}.`;
  const inRange = isDateKey(dateKey) && dateKey >= book.checkedFrom && dateKey <= book.checkedThrough;
  if (!inRange) return { coverage: "not-checked", items: [], stale, freshness };
  const timed = book.updates
    .filter(update => update.date === dateKey)
    .map(update => ({
      ...update,
      startMinutes: timeMinutes(update.start),
      endMinutes: timeMinutes(update.end),
      stale: now.getTime() - isoTime(update.verifiedAt) > STALE_AFTER_DAYS * 86400000,
      verifiedLabel: `Verified ${ageLabel(now.getTime() - isoTime(update.verifiedAt))}`
    }));
  const active = timed.filter(update => update.status !== "cancelled");
  const schedule = scheduleEvents.filter(event => Number.isInteger(event.startMinutes) && Number.isInteger(event.endMinutes));
  const items = timed.map(update => ({
    ...update,
    conflicts: update.status === "cancelled" ? [] : [
      ...schedule.filter(event => overlaps(update, event)).map(event => event.title),
      ...active.filter(other => other.id !== update.id && overlaps(update, other)).map(other => other.title)
    ]
  }));
  return { coverage: "checked", items, stale, freshness };
}

// Past dates are expired. They stay in the file until the next import but are
// never shown as upcoming.
export function upcomingDatedUpdates(book, dateKey) {
  if (!book || !isDateKey(dateKey)) return [];
  return book.updates.filter(update => update.date >= dateKey && update.status !== "cancelled");
}
