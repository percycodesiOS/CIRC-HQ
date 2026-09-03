export const GRADE_SIX_ANNOUNCEMENT_RESPONSIBILITY =
  "Grade 6 Morning Announcements is a rite-of-passage responsibility. Grade 6 students prepare, rehearse, deliver, and reset the broadcast with teacher supervision.";

export const ANNOUNCEMENT_LOCAL_STORAGE_KEY = "circHQ.announcements.local.v1";

export const ANNOUNCEMENT_CREW_ROLES = Object.freeze([
  Object.freeze({
    id: "producer",
    label: "Producer",
    responsibility: "Keeps the crew on the checklist and moves each section forward."
  }),
  Object.freeze({
    id: "leadReader",
    label: "Lead reader",
    responsibility: "Reads the opening and closing, then keeps a clear pace."
  }),
  Object.freeze({
    id: "coReader",
    label: "Co-reader",
    responsibility: "Reads the approved school items, events, and weather sections."
  }),
  Object.freeze({
    id: "timekeeper",
    label: "Timekeeper",
    responsibility: "Times rehearsal and signals when the crew needs to speed up or slow down."
  }),
  Object.freeze({
    id: "techLead",
    label: "Tech lead",
    responsibility: "Checks the microphone or display and resets equipment afterward."
  })
]);

export const ANNOUNCEMENT_WORKFLOW = Object.freeze([
  Object.freeze({
    id: "prepare",
    label: "Prepare",
    items: Object.freeze([
      Object.freeze({ id: "crewAssigned", label: "Assign today's crew with role cards or a private teacher roster." }),
      Object.freeze({ id: "scriptReady", label: "Finish every script section needed today." }),
      Object.freeze({ id: "factsChecked", label: "Check the date, weather, events, and approved school items." })
    ])
  }),
  Object.freeze({
    id: "rehearse",
    label: "Rehearse",
    items: Object.freeze([
      Object.freeze({ id: "fullRead", label: "Read the full script aloud." }),
      Object.freeze({ id: "timingChecked", label: "Check the rehearsal time against the target." }),
      Object.freeze({ id: "pronunciationsChecked", label: "Practice approved names and unfamiliar words." })
    ])
  }),
  Object.freeze({
    id: "go-live",
    label: "Go live",
    items: Object.freeze([
      Object.freeze({ id: "teacherReview", label: "Teacher reviews and approves the final script.", kind: "review" }),
      Object.freeze({ id: "broadcastComplete", label: "Mark the broadcast finished." })
    ])
  }),
  Object.freeze({
    id: "reset",
    label: "Reset",
    items: Object.freeze([
      Object.freeze({ id: "equipmentReset", label: "Reset or power down the equipment." }),
      Object.freeze({ id: "roleCardsReturned", label: "Return the crew role cards." }),
      Object.freeze({ id: "localDraftCleared", label: "Start a blank local draft for the next broadcast." })
    ])
  })
]);

const SCRIPT_SECTIONS = Object.freeze([
  "opening",
  "pledgeSchoolItems",
  "birthdaysEvents",
  "weather",
  "closing"
]);
const SCRIPT_SECTION_SET = new Set(SCRIPT_SECTIONS);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SCRIPT_LENGTH = 2000;
const MAX_STORED_DRAFT_LENGTH = 15000;

function clone(value) {
  return structuredClone(value);
}

function requireRecord(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(message);
}

function checklistTemplate() {
  return Object.fromEntries(ANNOUNCEMENT_WORKFLOW.map((phase) => [
    phase.id,
    Object.fromEntries(
      phase.items
        .filter(({ kind }) => kind !== "review")
        .map(({ id }) => [id, false])
    )
  ]));
}

function normalizedDraft(value) {
  requireRecord(value, "The local announcement draft is unavailable.");
  if (value.format !== "circ.announcements.local.v1" || value.scope !== "local-only") {
    throw new TypeError("Only a local CIRC announcement draft can be used here.");
  }
  const template = checklistTemplate();
  const script = Object.fromEntries(SCRIPT_SECTIONS.map((section) => [
    section,
    typeof value.script?.[section] === "string" ? value.script[section] : ""
  ]));
  const checklist = Object.fromEntries(ANNOUNCEMENT_WORKFLOW.map((phase) => [
    phase.id,
    Object.fromEntries(Object.keys(template[phase.id]).map((itemId) => [
      itemId,
      value.checklist?.[phase.id]?.[itemId] === true
    ]))
  ]));
  return {
    format: "circ.announcements.local.v1",
    version: 1,
    scope: "local-only",
    date: typeof value.date === "string" ? value.date : "",
    timing: {
      targetMinutes: value.timing?.targetMinutes,
      rehearsalSeconds: value.timing?.rehearsalSeconds ?? null
    },
    script,
    checklist,
    teacherReview: { approved: value.teacherReview?.approved === true }
  };
}

function validCalendarDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function error(code, message, field) {
  return { code, message, field };
}

function invalidatesTeacherReview(draft) {
  const next = clone(draft);
  next.teacherReview.approved = false;
  next.checklist["go-live"].broadcastComplete = false;
  for (const itemId of Object.keys(next.checklist.reset)) next.checklist.reset[itemId] = false;
  return next;
}

export function createAnnouncementDraft({ date = "", targetMinutes = 3 } = {}) {
  return {
    format: "circ.announcements.local.v1",
    version: 1,
    scope: "local-only",
    date,
    timing: {
      targetMinutes,
      rehearsalSeconds: null
    },
    script: Object.fromEntries(SCRIPT_SECTIONS.map((section) => [section, ""])),
    checklist: checklistTemplate(),
    teacherReview: { approved: false }
  };
}

export function admitAnnouncementDraft(value) {
  requireRecord(value, "The local announcement draft is unavailable.");
  if (value.version !== 1) {
    throw new TypeError("Only a local CIRC announcement draft can be used here.");
  }
  const admitted = normalizedDraft(value);
  if (admitted.date !== "" && !validCalendarDate(admitted.date)) {
    throw new TypeError("Choose a valid announcement date.");
  }
  if (!Number.isInteger(admitted.timing.targetMinutes) ||
      admitted.timing.targetMinutes < 1 || admitted.timing.targetMinutes > 15) {
    throw new TypeError("Choose a target from 1 through 15 minutes.");
  }
  if (admitted.timing.rehearsalSeconds !== null &&
      (!Number.isInteger(admitted.timing.rehearsalSeconds) ||
       admitted.timing.rehearsalSeconds < 1 || admitted.timing.rehearsalSeconds > 900)) {
    throw new TypeError("Enter a rehearsal time from 1 through 900 seconds, or leave it blank.");
  }
  for (const section of SCRIPT_SECTIONS) {
    if (admitted.script[section].length > MAX_SCRIPT_LENGTH) {
      throw new TypeError("Shorten this script section to 2,000 characters or fewer.");
    }
  }
  return clone(admitted);
}

export function loadLocalAnnouncementDraft(storage, { date = "" } = {}) {
  const fallback = () => createAnnouncementDraft({ date });
  if (!storage || typeof storage.getItem !== "function") {
    return { draft: fallback(), status: "unavailable" };
  }
  let raw;
  try {
    raw = storage.getItem(ANNOUNCEMENT_LOCAL_STORAGE_KEY);
  } catch {
    return { draft: fallback(), status: "unavailable" };
  }
  if (raw === null) return { draft: fallback(), status: "empty" };
  try {
    if (typeof raw !== "string" || raw.length > MAX_STORED_DRAFT_LENGTH) {
      throw new TypeError("local-announcement-draft-invalid");
    }
    return { draft: admitAnnouncementDraft(JSON.parse(raw)), status: "saved" };
  } catch {
    return { draft: fallback(), status: "invalid" };
  }
}

export function saveLocalAnnouncementDraft(storage, draft) {
  if (!storage || typeof storage.setItem !== "function") {
    throw new TypeError("Local announcement storage is unavailable on this device.");
  }
  const admitted = admitAnnouncementDraft(draft);
  storage.setItem(ANNOUNCEMENT_LOCAL_STORAGE_KEY, JSON.stringify(admitted));
  return clone(admitted);
}

export function clearLocalAnnouncementDraft(storage) {
  if (!storage || typeof storage.removeItem !== "function") {
    throw new TypeError("The local announcement draft could not be cleared on this device.");
  }
  try {
    storage.removeItem(ANNOUNCEMENT_LOCAL_STORAGE_KEY);
  } catch {
    throw new TypeError("The local announcement draft could not be cleared on this device.");
  }
}

export function updateAnnouncementDetails(draft, changes = {}) {
  requireRecord(changes, "Enter the announcement details.");
  const unknown = Object.keys(changes).filter((key) => !["date", "targetMinutes", "rehearsalSeconds"].includes(key));
  if (unknown.length) throw new TypeError("Choose a valid announcement detail.");
  let next = normalizedDraft(draft);
  if (Object.hasOwn(changes, "date")) next.date = changes.date;
  if (Object.hasOwn(changes, "targetMinutes")) next.timing.targetMinutes = changes.targetMinutes;
  if (Object.hasOwn(changes, "rehearsalSeconds")) next.timing.rehearsalSeconds = changes.rehearsalSeconds;
  next = invalidatesTeacherReview(next);
  return next;
}

export function updateAnnouncementSection(draft, section, value) {
  if (!SCRIPT_SECTION_SET.has(section) || typeof value !== "string") {
    throw new TypeError("Choose a valid announcement script section.");
  }
  const next = invalidatesTeacherReview(normalizedDraft(draft));
  next.script[section] = value;
  return next;
}

export function setAnnouncementCheck(draft, phaseId, itemId, complete) {
  const next = normalizedDraft(draft);
  if (!Object.hasOwn(next.checklist, phaseId) || !Object.hasOwn(next.checklist[phaseId], itemId)) {
    throw new TypeError("Choose a valid announcement checklist item.");
  }
  if (phaseId === "go-live" && itemId === "broadcastComplete" && complete === true &&
      !evaluateAnnouncementDraft(next).canGoLive) {
    throw new TypeError("Teacher approval is required before going live.");
  }
  next.checklist[phaseId][itemId] = complete === true;
  if (["prepare", "rehearse"].includes(phaseId)) next.teacherReview.approved = false;
  return next;
}

export function evaluateAnnouncementDraft(draft) {
  const value = normalizedDraft(draft);
  const errors = [];
  if (!validCalendarDate(value.date)) {
    errors.push(error("date-required", "Choose the announcement date.", "date"));
  }
  if (!value.script.opening.trim()) {
    errors.push(error("opening-required", "Write the opening.", "script.opening"));
  }
  if (!value.script.closing.trim()) {
    errors.push(error("closing-required", "Write the closing.", "script.closing"));
  }
  for (const section of SCRIPT_SECTIONS) {
    if (value.script[section].length > MAX_SCRIPT_LENGTH) {
      errors.push(error(
        "section-too-long",
        "Shorten this script section to 2,000 characters or fewer.",
        `script.${section}`
      ));
    }
  }
  if (!Number.isInteger(value.timing.targetMinutes) || value.timing.targetMinutes < 1 || value.timing.targetMinutes > 15) {
    errors.push(error("target-time-invalid", "Choose a target from 1 through 15 minutes.", "timing.targetMinutes"));
  }
  if (value.timing.rehearsalSeconds !== null &&
      (!Number.isInteger(value.timing.rehearsalSeconds) || value.timing.rehearsalSeconds < 1 ||
       value.timing.rehearsalSeconds > 900)) {
    errors.push(error(
      "rehearsal-time-invalid",
      "Enter a rehearsal time from 1 through 900 seconds, or leave it blank.",
      "timing.rehearsalSeconds"
    ));
  }

  const incompletePrepare = Object.entries(value.checklist.prepare)
    .filter(([, complete]) => !complete)
    .map(([itemId]) => itemId);
  const incompleteRehearse = Object.entries(value.checklist.rehearse)
    .filter(([, complete]) => !complete)
    .map(([itemId]) => itemId);
  const prepareComplete = incompletePrepare.length === 0;
  const rehearseComplete = incompleteRehearse.length === 0;
  const reviewReady = errors.length === 0 && prepareComplete && rehearseComplete;
  const canGoLive = reviewReady && value.teacherReview.approved;
  return {
    errors,
    incompletePrepare,
    incompleteRehearse,
    prepareComplete,
    rehearseComplete,
    reviewReady,
    canGoLive,
    broadcastComplete: value.checklist["go-live"].broadcastComplete,
    resetComplete: Object.values(value.checklist.reset).every(Boolean)
  };
}

export function setAnnouncementTeacherReview(draft, approved) {
  const next = normalizedDraft(draft);
  if (approved === true && !evaluateAnnouncementDraft(next).reviewReady) {
    throw new TypeError("Finish the script and rehearsal checklist before teacher approval.");
  }
  next.teacherReview.approved = approved === true;
  if (!next.teacherReview.approved) next.checklist["go-live"].broadcastComplete = false;
  return next;
}

export function resetAnnouncementDraft(draft, { date = "" } = {}) {
  const prior = normalizedDraft(draft);
  return createAnnouncementDraft({ date, targetMinutes: prior.timing.targetMinutes });
}
