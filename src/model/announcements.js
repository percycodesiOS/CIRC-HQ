export const GRADE_SIX_ANNOUNCEMENT_RESPONSIBILITY =
  "Grade 6 Morning Announcements is a rite-of-passage responsibility. Grade 6 students prepare, rehearse, deliver, and reset the broadcast with teacher supervision.";

export const ANNOUNCEMENT_LOCAL_STORAGE_KEY = "circHQ.announcements.local.v1";
export const ANNOUNCEMENT_ARCHIVE_STORAGE_KEY = "circHQ.announcements.archive.v1";

export const ANNOUNCEMENT_CREW_TIMES = Object.freeze({
  arrival: "08:50", backup: "08:52", finalCheck: "08:54", broadcast: "08:55"
});
const ANNOUNCER_SLOTS = ["announcer1", "announcer2"];
const CREW_CHECKS = ["homeroomConfirmed", "arrived", "ready", "lateNotified", "teacherCovers", "backupActive"];

function blankCrewChecks() {
  return Object.fromEntries(CREW_CHECKS.map((field) => [field, false]));
}

export function getAnnouncementCrew(draft) {
  const stored = draft?.crew;
  const times = Object.fromEntries(Object.entries(ANNOUNCEMENT_CREW_TIMES).map(([field, fallback]) => [
    field, stored?.times?.[field] ?? fallback
  ]));
  const orderedTimes = Object.values(times);
  if (orderedTimes.some((time) => typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) ||
      orderedTimes.some((time, index) => index > 0 && time <= orderedTimes[index - 1])) {
    throw new TypeError("Keep arrival, backup decision, final check and broadcast times in that order.");
  }
  return {
    times,
    announcers: Object.fromEntries(ANNOUNCER_SLOTS.map((slot) => [slot,
      Object.fromEntries(CREW_CHECKS.map((field) => [field, stored?.announcers?.[slot]?.[field] === true]))
    ]))
  };
}

function clearCrewChecks(draft) {
  const crew = getAnnouncementCrew(draft);
  crew.announcers = Object.fromEntries(ANNOUNCER_SLOTS.map((slot) => [slot, blankCrewChecks()]));
  return crew;
}

export function setAnnouncementCrewCheck(draft, slot, field, checked) {
  if (!ANNOUNCER_SLOTS.includes(slot) || !CREW_CHECKS.includes(field) || typeof checked !== "boolean") {
    throw new TypeError("Choose a valid private crew check.");
  }
  const next = normalizedDraft(draft);
  next.crew = getAnnouncementCrew(next);
  const member = next.crew.announcers[slot];
  // A replacement person must make their own confirmations. No names are stored.
  if (field === "backupActive" && member.backupActive !== checked) {
    next.crew.announcers[slot] = { ...blankCrewChecks(), backupActive: checked };
  } else {
    member[field] = checked;
  }
  return next;
}

export function updateAnnouncementCrewTime(draft, field, value) {
  if (!Object.hasOwn(ANNOUNCEMENT_CREW_TIMES, field)) throw new TypeError("Choose a valid crew time.");
  const next = normalizedDraft(draft);
  next.crew = getAnnouncementCrew(next);
  next.crew.times[field] = value;
  next.crew = getAnnouncementCrew(next);
  return next;
}

export function resetAnnouncementCrew(draft) {
  const next = normalizedDraft(draft);
  next.crew = clearCrewChecks(next);
  return next;
}

export const ANNOUNCEMENT_CREW_ROLES = Object.freeze([
  Object.freeze({
    id: "producer",
    label: "Producers (up to 2, optional)",
    responsibility: "Keep the crew on the checklist, time rehearsal and help the teacher prepare. Each producer has a backup."
  }),
  Object.freeze({
    id: "leadReader",
    label: "Announcers (2)",
    responsibility: "Read the approved script as Announcer 1 and Announcer 2. Each announcer has a rehearsed backup."
  }),
  Object.freeze({
    id: "coReader",
    label: "Reporters (4)",
    responsibility: "Prepare assigned school stories or segments for teacher review. Each reporter has a backup."
  }),
  Object.freeze({
    id: "timekeeper",
    label: "Camera operators (2)",
    responsibility: "Practice framing and equipment checks with the teacher. Each camera operator has a backup."
  }),
  Object.freeze({
    id: "techLead",
    label: "Director: Teacher",
    responsibility: "Assigns work, approves the script, handles crew changes and makes the final decision to broadcast."
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
const MAX_ARCHIVE_LENGTH = 4_000_000;
const MAX_ARCHIVE_DATES = 1000;
const OUTLINE_PLACEHOLDER = /\[\[|\]\]/;

function spokenAnnouncementDate(value) {
  if (!validCalendarDate(value)) return null;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC"
  }).format(new Date(`${value}T12:00:00Z`));
}

export function hasAnnouncementScript(draft) {
  return Object.values(normalizedDraft(draft).script).some((text) => text.trim() !== "");
}

export function applyEcmsAnnouncementOutline(draft, { replaceExisting = false } = {}) {
  const prior = admitAnnouncementDraft(draft);
  const date = spokenAnnouncementDate(prior.date);
  if (!date) throw new TypeError("Choose the announcement date before using the ECMS outline.");
  if (hasAnnouncementScript(prior) && replaceExisting !== true) {
    throw new TypeError("Confirm before replacing the current announcement script.");
  }
  const next = createAnnouncementDraft({ date: prior.date, targetMinutes: prior.timing.targetMinutes });
  next.script = {
    opening: `Announcer 1: Good morning, ECMS! Today is ${date}. It is cycle day [[CYCLE DAY]].\nAnnouncer 1: My name is [[ANNOUNCER 1 FIRST NAME]].\nAnnouncer 2: And my name is [[ANNOUNCER 2 FIRST NAME]].`,
    pledgeSchoolItems: "Announcer 2: Please rise for a moment of silence, followed by the Pledge of Allegiance.\n[Pause silently for at least 20 seconds.]\n[Wait 5 seconds before Announcer 1 begins.]\nAnnouncer 1: I pledge allegiance to the flag of the United States of America, and to the republic for which it stands, one nation under God, indivisible, with liberty and justice for all.\nAnnouncer 2: Thank you. You may be seated.\nAnnouncer 1: Here are today's announcements.\nAnnouncer 1: [[HEATHER'S REQUIRED NOTICES]]\nAnnouncer 2: [[EMILY'S REQUIRED NOTICES]]",
    birthdaysEvents: "Announcer 2: For lunch today, we are having [[TODAY'S LUNCH]].",
    weather: "Announcer 1: A reminder: [[OPTIONAL REMINDER OR DELETE THIS LINE]]",
    closing: "Announcer 2: That's all for today's announcements.\nAnnouncer 1: Have a great day of learning, ECMS!"
  };
  return next;
}

export const PREPARED_ECMS_BROADCASTS = Object.freeze([
  Object.freeze({ date: "2026-09-09", label: "Load Wednesday, September 9 script", cycleDay: 4 }),
  Object.freeze({ date: "2026-09-10", label: "Load Thursday, September 10 script", cycleDay: 5 }),
  Object.freeze({ date: "2026-09-11", label: "Load Friday, September 11 script", cycleDay: 1 })
]);

// Public school notices only. Names and Friday's approved message stay unresolved until local teacher review.
export function applyPreparedEcmsAnnouncement(draft, date, { replaceExisting = false } = {}) {
  const prior = admitAnnouncementDraft(draft);
  const prepared = PREPARED_ECMS_BROADCASTS.find((item) => item.date === date);
  if (!prepared) throw new TypeError("Choose one of the prepared September 9-11 broadcasts.");
  if (hasAnnouncementScript(prior) && replaceExisting !== true) {
    throw new TypeError("Confirm before replacing the current announcement script.");
  }
  const next = createAnnouncementDraft({ date, targetMinutes: 3 });
  const friday = date === "2026-09-11";
  const audition = date === "2026-09-09"
    ? "tomorrow, Thursday, September 10, at 5:30 p.m."
    : "this evening at 5:30 p.m.";
  const lunch = {
    "2026-09-09": "Announcer 2: For Lunch 1 today, it's breakfast for lunch! We are having pancakes, a sausage patty, and warm cinnamon fruit.",
    "2026-09-10": "Announcer 2: For Lunch 1 today, we are having pasta with meat sauce or marinara sauce, a breadstick, and a steamed vegetable.",
    "2026-09-11": "Announcer 1: For Lunch 1 today, we are having popcorn chicken, Smiles potatoes, a roll, and a steamed vegetable."
  }[date];
  const office = [
    "Announcer 1: Here are today's announcements. Chorus sign-ups are happening now. Listen for more information in your music class.",
    ...(!friday ? [`Announcer 2: Attention, fifth graders: auditions for the musical, Little Shop of Horrors, are ${audition} at Ryan Gloyer Middle School. These auditions are for fifth graders only.`] : []),
    `Announcer ${friday ? 2 : 1}: Yearbooks are available to order through the Ehrman Crest PTO website. Please remind your family that the yearbook discount ends October 31.`
  ].join("\n");
  next.script = {
    opening: `Announcer 1: Good morning, ECMS! Today is ${spokenAnnouncementDate(date)}. It is cycle day ${prepared.cycleDay}.\nAnnouncer 1: My name is [[ANNOUNCER 1 FIRST NAME]].\nAnnouncer 2: And my name is [[ANNOUNCER 2 FIRST NAME]].`,
    pledgeSchoolItems: [
      "Announcer 2: Please rise for a moment of silence, followed by the Pledge of Allegiance.",
      "[Pause silently for at least 20 seconds.]",
      "[Wait 5 additional seconds before Announcer 1 begins.]",
      "Announcer 1: Please join me in the Pledge of Allegiance.",
      "I pledge allegiance to the flag of the United States of America, and to the republic for which it stands, one nation under God, indivisible, with liberty and justice for all.",
      "Announcer 2: Thank you. You may be seated.",
      ...(friday ? ["[[TIM AND IVAN APPROVED SEPTEMBER 11 MESSAGE WITH SPEAKER]]"] : []),
      office
    ].join("\n"),
    birthdaysEvents: `${lunch}\nAnnouncer ${friday ? 2 : 1}: Looking ahead, the ECMS and Haine Academic Games teams have their first tournament next Thursday, September 17, at Ryan Gloyer Middle School. Good luck to both teams!`,
    weather: "",
    closing: friday
      ? "Announcer 1: That's all for today's announcements. Thank you for listening.\nAnnouncer 2: Have a thoughtful day of learning and a safe weekend, ECMS. Embrace the challenge!"
      : "Announcer 2: That's all for today's announcements. Thank you for listening.\nAnnouncer 1: Have a great day of learning, ECMS, and embrace the challenge!"
  };
  return next;
}

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
    teacherReview: { approved: value.teacherReview?.approved === true },
    // Optional so existing version-one working drafts and strict dated archives retain their exact shape.
    ...(Object.hasOwn(value, "crew") ? { crew: getAnnouncementCrew(value) } : {})
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

function emptyAnnouncementArchive() {
  return { format: "circ.announcements.archive.v1", version: 1, scope: "local-only", drafts: {} };
}

function sameStoredShape(value, admitted) {
  if (value === admitted) return true;
  if (!value || !admitted || typeof value !== "object" || typeof admitted !== "object" ||
      Array.isArray(value) || Array.isArray(admitted)) return false;
  const keys = Object.keys(admitted);
  return Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key) && sameStoredShape(value[key], admitted[key]));
}

function readAnnouncementArchive(storage) {
  const fallback = (status, raw = null) => ({ archive: emptyAnnouncementArchive(), status, raw });
  if (!storage || typeof storage.getItem !== "function") return fallback("unavailable");
  let raw;
  try {
    raw = storage.getItem(ANNOUNCEMENT_ARCHIVE_STORAGE_KEY);
  } catch {
    return fallback("unavailable");
  }
  if (raw === null) return fallback("empty");
  try {
    if (typeof raw !== "string" || raw.length > MAX_ARCHIVE_LENGTH) throw new TypeError("archive-too-large");
    const value = JSON.parse(raw);
    requireRecord(value, "archive-invalid");
    requireRecord(value.drafts, "archive-invalid");
    if (value.format !== "circ.announcements.archive.v1" || value.version !== 1 || value.scope !== "local-only" ||
        Object.keys(value.drafts).length > MAX_ARCHIVE_DATES) throw new TypeError("archive-invalid");
    const archive = emptyAnnouncementArchive();
    for (const date of Object.keys(value.drafts).sort()) {
      if (!validCalendarDate(date)) throw new TypeError("archive-date-invalid");
      const draft = admitAnnouncementDraft(value.drafts[date]);
      if (draft.date !== date || !sameStoredShape(value.drafts[date], draft)) throw new TypeError("archive-draft-invalid");
      archive.drafts[date] = draft;
    }
    if (!sameStoredShape(value, archive)) throw new TypeError("archive-invalid");
    return { archive, status: "saved", raw };
  } catch {
    return fallback("invalid", raw);
  }
}

export function loadLocalAnnouncementArchive(storage) {
  const { archive, status } = readAnnouncementArchive(storage);
  return { archive, status };
}

function requireUsableArchive(result) {
  if (result.status === "invalid") {
    throw new TypeError("Saved broadcast scripts could not be read and were left untouched. The current draft is still open.");
  }
  if (result.status === "unavailable") {
    throw new TypeError("Saved broadcast scripts are unavailable on this device. The current draft is still open.");
  }
}

export function loadArchivedAnnouncementDraft(storage, date) {
  if (typeof date !== "string" || !validCalendarDate(date)) throw new TypeError("Choose a valid announcement date.");
  const result = readAnnouncementArchive(storage);
  requireUsableArchive(result);
  if (!Object.hasOwn(result.archive.drafts, date)) throw new TypeError("No saved broadcast exists for that date on this device.");
  return clone(result.archive.drafts[date]);
}

export function saveDatedAnnouncementDraft(storage, draft) {
  const admitted = admitAnnouncementDraft(draft);
  if (!validCalendarDate(admitted.date)) throw new TypeError("Choose a valid announcement date before saving a dated script.");
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function" ||
      typeof storage.removeItem !== "function") {
    throw new TypeError("Local announcement storage is unavailable on this device.");
  }
  // Read current storage for each save so another open tab's dated copies are retained.
  const result = readAnnouncementArchive(storage);
  requireUsableArchive(result);
  let previousWorking;
  try {
    previousWorking = storage.getItem(ANNOUNCEMENT_LOCAL_STORAGE_KEY);
  } catch {
    throw new TypeError("The dated script could not be saved. Existing saved values were left untouched.");
  }
  const archive = result.archive;
  // Preserve a legacy saved date when the teacher first saves a different day.
  if (typeof previousWorking === "string" && previousWorking.length <= MAX_STORED_DRAFT_LENGTH) {
    try {
      const legacy = admitAnnouncementDraft(JSON.parse(previousWorking));
      if (validCalendarDate(legacy.date) && !Object.hasOwn(archive.drafts, legacy.date)) archive.drafts[legacy.date] = legacy;
    } catch {
      // The existing working-draft loader already reports malformed legacy data.
    }
  }
  archive.drafts[admitted.date] = admitted;
  const archiveText = JSON.stringify(archive);
  if (Object.keys(archive.drafts).length > MAX_ARCHIVE_DATES || archiveText.length > MAX_ARCHIVE_LENGTH) {
    throw new TypeError("The local saved-script library is full. No dated copies were removed or overwritten.");
  }
  try {
    storage.setItem(ANNOUNCEMENT_ARCHIVE_STORAGE_KEY, archiveText);
  } catch {
    throw new TypeError("The dated script could not be saved. Existing saved values were left untouched.");
  }
  try {
    storage.setItem(ANNOUNCEMENT_LOCAL_STORAGE_KEY, JSON.stringify(admitted));
  } catch {
    try {
      if (result.raw === null) storage.removeItem(ANNOUNCEMENT_ARCHIVE_STORAGE_KEY);
      else storage.setItem(ANNOUNCEMENT_ARCHIVE_STORAGE_KEY, result.raw);
    } catch {
      throw new TypeError("The working draft could not be saved. A dated copy may have been saved; reload the saved-date list before trying again.");
    }
    throw new TypeError("The dated script could not be saved. Existing saved values were restored.");
  }
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
  if (Object.hasOwn(changes, "date")) {
    if (next.date !== changes.date && next.crew) next.crew = clearCrewChecks(next);
    const previousCue = `Announcer 1: Good morning, ECMS! Today is ${spokenAnnouncementDate(next.date) ?? "[[ANNOUNCEMENT DATE]]"}.`;
    const newDate = spokenAnnouncementDate(changes.date) ?? "[[ANNOUNCEMENT DATE]]";
    if (next.script.opening.startsWith(previousCue)) {
      next.script.opening = next.script.opening.replace(previousCue,
        `Announcer 1: Good morning, ECMS! Today is ${newDate}.`);
    }
    next.date = changes.date;
  }
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
  // Introductions contain the broadcast names. Editing them requires fresh role confirmations.
  if (section === "opening" && next.script.opening !== value && next.crew) next.crew = clearCrewChecks(next);
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
    throw new TypeError("Teacher approval and current crew confirmations or arranged coverage are required before going live.");
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
    if (OUTLINE_PLACEHOLDER.test(value.script[section])) {
      errors.push(error(
        "outline-placeholder-unresolved",
        "Resolve every [[placeholder]] with broadcast-approved wording, or remove the optional reminder, before teacher review.",
        `script.${section}`
      ));
    }
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
  const crew = getAnnouncementCrew(value);
  const crewReady = Object.values(crew.announcers).every((member) =>
    member.teacherCovers || (member.homeroomConfirmed && member.arrived && member.ready));
  const canGoLive = reviewReady && value.teacherReview.approved && crewReady;
  return {
    errors,
    incompletePrepare,
    incompleteRehearse,
    prepareComplete,
    rehearseComplete,
    reviewReady,
    crewReady,
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
