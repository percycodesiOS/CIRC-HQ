import { generateEventId, isEventId } from "./schema-admission.js";
import { validateTeacherPlan } from "./teacher-plan.js";

const EVENT_TYPES = new Set(["teach", "prep", "lunch", "support", "duty", "special"]);
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

function clone(value) {
  return structuredClone(value);
}

function requireRecord(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(message);
  }
}

function requireCycleDay(value) {
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 5) {
    throw new TypeError("Cycle Day must be from 1 through 5.");
  }
  return String(day);
}

function teacherById(draft, teacherId) {
  const teacher = draft.teachers.find((candidate) => candidate.id === teacherId);
  if (!teacher) throw new TypeError("Choose a teacher before changing the schedule.");
  return teacher;
}

function eventById(teacher, day, eventId) {
  const index = teacher.days[day].findIndex((event) => event.id === eventId);
  if (index < 0) throw new TypeError("Choose a schedule item that still exists.");
  return index;
}

function allEventIds(draft) {
  const ids = new Set();
  for (const teacher of draft.teachers) {
    for (const events of Object.values(teacher.days)) {
      for (const event of events) ids.add(event.id);
    }
  }
  for (const event of draft.specialEvents ?? []) ids.add(event.id);
  return ids;
}

function nextEventId(draft, eventIdFactory) {
  const id = eventIdFactory();
  if (!isEventId(id) || allEventIds(draft).has(id)) {
    throw new TypeError("A new private schedule ID could not be created.");
  }
  return id;
}

function normalizedDays(days = {}) {
  return Object.fromEntries(
    [1, 2, 3, 4, 5].map((day) => [String(day), clone(days[String(day)] ?? [])])
  );
}

function normalizedDraft(value) {
  requireRecord(value, "Schedule draft is unavailable.");
  if (!Array.isArray(value.teachers) || value.teachers.length === 0) {
    throw new TypeError("Add a teacher before changing the schedule.");
  }
  const result = clone(value);
  result.teachers = result.teachers.map((teacher) => ({
    ...teacher,
    days: normalizedDays(teacher.days)
  }));
  result.specialEvents = Array.isArray(result.specialEvents) ? result.specialEvents : [];
  result.resources = Array.isArray(result.resources) ? result.resources : [];
  return result;
}

function editableEvent(event, id) {
  requireRecord(event, "Enter the schedule item details.");
  const result = { ...clone(event), id };
  if (result.type !== "duty") delete result.dutyDetails;
  if (result.type !== "teach") {
    delete result.classId;
    delete result.lessonGuideId;
  }
  return result;
}

function parseMinutes(value) {
  if (typeof value !== "string") return null;
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 24 || minute > 59 || (hour === 24 && minute !== 0)) return null;
  return hour * 60 + minute;
}

function error(code, message, field) {
  return { code, message, field };
}

function draftErrors(draft) {
  const errors = [];
  if (typeof draft.calendar?.anchorDate !== "string" || !draft.calendar.anchorDate.trim()) {
    errors.push(error("anchor-date-required", "Enter the first school date.", "calendar.anchorDate"));
  }
  if (typeof draft.calendar?.lastDate !== "string" || !draft.calendar.lastDate.trim()) {
    errors.push(error("last-date-required", "Enter the last school date.", "calendar.lastDate"));
  }

  for (const [teacherIndex, teacher] of draft.teachers.entries()) {
    if (Object.hasOwn(teacher, "name") && (typeof teacher.name !== "string" || !teacher.name.trim())) {
      errors.push(error("teacher-name-required", "Enter the teacher name.", `teachers.${teacherIndex}.name`));
    }
    for (let cycleDay = 1; cycleDay <= 5; cycleDay += 1) {
      const events = teacher.days[String(cycleDay)] ?? [];
      const timed = [];
      for (const [eventIndex, eventValue] of events.entries()) {
        const path = `teachers.${teacherIndex}.days.${cycleDay}.${eventIndex}`;
        const label = typeof eventValue.label === "string" ? eventValue.label.trim() : "";
        const startMissing = typeof eventValue.start !== "string" || !eventValue.start.trim();
        const endMissing = typeof eventValue.end !== "string" || !eventValue.end.trim();
        if (!label) {
          errors.push(error("event-name-required", "Enter a name for this schedule item.", `${path}.label`));
        }
        if (startMissing) {
          errors.push(error("event-start-required", "Enter a start time for this schedule item.", `${path}.start`));
        }
        if (endMissing) {
          errors.push(error("event-end-required", "Enter an end time for this schedule item.", `${path}.end`));
        }
        if (!EVENT_TYPES.has(eventValue.type)) {
          errors.push(error("event-type-invalid", "Choose a schedule item type.", `${path}.type`));
        }
        const start = startMissing ? null : parseMinutes(eventValue.start);
        const end = endMissing ? null : parseMinutes(eventValue.end);
        if (!startMissing && start === null) {
          errors.push(error("event-start-invalid", "Enter a valid start time.", `${path}.start`));
        }
        if (!endMissing && end === null) {
          errors.push(error("event-end-invalid", "Enter a valid end time.", `${path}.end`));
        }
        if (start !== null && end !== null) {
          if (end <= start) {
            errors.push(error("event-time-reversed", "End time must be later than start time.", `${path}.end`));
          } else {
            timed.push({ start, end, label, index: eventIndex });
          }
        }
      }

      timed.sort((left, right) => left.start - right.start || left.end - right.end);
      let latest = null;
      for (const entry of timed) {
        if (latest && entry.start < latest.end) {
          errors.push(error(
            "event-overlap",
            `${latest.label || "One schedule item"} overlaps ${entry.label || "another schedule item"} on Cycle Day ${cycleDay}.`,
            `teachers.${teacherIndex}.days.${cycleDay}.${entry.index}.start`
          ));
          if (entry.end > latest.end) latest = entry;
        } else {
          latest = entry;
        }
      }
    }
  }
  return errors;
}

export function createBlankScheduleDraft({ teacherId, teacherName = "", calendar } = {}) {
  if (typeof teacherId !== "string" || !teacherId.trim()) {
    throw new TypeError("Teacher setup is missing a private ID.");
  }
  requireRecord(calendar, "Enter the school calendar dates.");
  return {
    format: "playbook.teacherPlan.v2",
    version: 1,
    calendar: clone(calendar),
    teachers: [{ id: teacherId, name: teacherName, days: normalizedDays() }],
    specialEvents: [],
    resources: []
  };
}

export function createScheduleDraftFromPlan(plan) {
  const validation = validateTeacherPlan(plan);
  if (!validation.ok) throw new TypeError("This saved schedule cannot be edited safely.");
  return normalizedDraft(validation.value);
}

export function addScheduleEvent(
  draft,
  { teacherId, cycleDay, event } = {},
  { eventIdFactory = generateEventId } = {}
) {
  const next = normalizedDraft(draft);
  const day = requireCycleDay(cycleDay);
  const teacher = teacherById(next, teacherId);
  const id = nextEventId(next, eventIdFactory);
  teacher.days[day].push(editableEvent(event, id));
  return next;
}

export function editScheduleEvent(draft, { teacherId, cycleDay, eventId, changes } = {}) {
  const next = normalizedDraft(draft);
  const day = requireCycleDay(cycleDay);
  const teacher = teacherById(next, teacherId);
  const index = eventById(teacher, day, eventId);
  requireRecord(changes, "Enter the schedule changes.");
  const { id: ignoredId, ...allowedChanges } = clone(changes);
  teacher.days[day][index] = editableEvent({
    ...teacher.days[day][index],
    ...allowedChanges
  }, eventId);
  return next;
}

export function duplicateScheduleEvent(
  draft,
  { teacherId, cycleDay, eventId } = {},
  { eventIdFactory = generateEventId } = {}
) {
  const source = normalizedDraft(draft);
  const day = requireCycleDay(cycleDay);
  const teacher = teacherById(source, teacherId);
  const index = eventById(teacher, day, eventId);
  return addScheduleEvent(
    source,
    { teacherId, cycleDay: day, event: teacher.days[day][index] },
    { eventIdFactory }
  );
}

export function removeScheduleEvent(draft, { teacherId, cycleDay, eventId } = {}) {
  const next = normalizedDraft(draft);
  const day = requireCycleDay(cycleDay);
  const teacher = teacherById(next, teacherId);
  const index = eventById(teacher, day, eventId);
  teacher.days[day].splice(index, 1);
  return next;
}

export function copyScheduleDay(
  draft,
  { teacherId, sourceDay, targetDay } = {},
  { eventIdFactory = generateEventId } = {}
) {
  const next = normalizedDraft(draft);
  const source = requireCycleDay(sourceDay);
  const target = requireCycleDay(targetDay);
  const teacher = teacherById(next, teacherId);
  if (source === target) throw new TypeError("Choose a different Cycle Day to copy to.");
  const copies = [];
  for (const event of teacher.days[source]) {
    const id = nextEventId(next, eventIdFactory);
    const copy = editableEvent(event, id);
    copies.push(copy);
    teacher.days[target] = copies;
  }
  teacher.days[target] = copies;
  return next;
}

export function compileScheduleDraft(draft) {
  let candidate;
  try {
    candidate = normalizedDraft(draft);
  } catch {
    return {
      ok: false,
      errors: [error("schedule-unavailable", "This schedule cannot be opened safely.", "schedule")],
      value: null
    };
  }
  const errors = draftErrors(candidate);
  if (errors.length) return { ok: false, errors, value: null };

  const validation = validateTeacherPlan(candidate);
  if (!validation.ok) {
    return {
      ok: false,
      errors: [error(
        "schedule-invalid",
        "This schedule contains information CIRC HQ cannot use yet.",
        "schedule"
      )],
      value: null
    };
  }
  return { ok: true, errors: [], value: validation.value };
}
