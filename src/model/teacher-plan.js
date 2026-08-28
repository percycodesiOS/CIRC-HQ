import { parseLocalDate } from "./schedule.js";

const PLAN_FORMAT = "playbook.teacherPlan.v2";
const ALLOWED_EVENT_TYPES = new Set([
  "teach",
  "prep",
  "lunch",
  "support",
  "duty",
  "special"
]);
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneCandidate(candidate) {
  try {
    return { ok: true, value: structuredClone(candidate) };
  } catch {
    return { ok: false, value: null };
  }
}

function parseTimeMinutes(value) {
  if (typeof value !== "string") return null;

  const match = TIME_PATTERN.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) {
    return null;
  }
  return hours * 60 + minutes;
}

function dateNumber(value) {
  const parts = parseLocalDate(value);
  if (!parts) return null;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function validateDate(value, path, errors) {
  if (!parseLocalDate(value)) {
    errors.push(`${path} must be a valid YYYY-MM-DD date`);
    return false;
  }
  return true;
}

function validateEventTime(event, path, errors, required) {
  const hasStart = event.start !== undefined;
  const hasEnd = event.end !== undefined;
  if (!required && !hasStart && !hasEnd) return;

  const startMinutes = parseTimeMinutes(event.start);
  const endMinutes = parseTimeMinutes(event.end);
  if (startMinutes === null) {
    errors.push(`${path}.start must be a valid HH:MM time`);
  }
  if (endMinutes === null) {
    errors.push(`${path}.end must be a valid HH:MM time`);
  }
  if (
    startMinutes !== null &&
    endMinutes !== null &&
    endMinutes <= startMinutes
  ) {
    errors.push(`${path}.end must be after start`);
  }
}

function validateEvent(event, path, errors, eventIds, timeRequired) {
  if (!isRecord(event)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (typeof event.id !== "string" || event.id.trim() === "") {
    errors.push(`${path}.id must be a nonempty string`);
  } else if (eventIds.has(event.id)) {
    errors.push(`${path} has duplicate event id "${event.id}"`);
  } else {
    eventIds.add(event.id);
  }

  if (!ALLOWED_EVENT_TYPES.has(event.type)) {
    errors.push(`${path} has unsupported type "${String(event.type)}"`);
  }

  validateEventTime(event, path, errors, timeRequired);
}

function validateCalendar(calendar, errors) {
  if (!isRecord(calendar)) {
    errors.push("calendar must be an object");
    return;
  }

  const anchorValid = validateDate(
    calendar.anchorDate,
    "calendar.anchorDate",
    errors
  );
  const lastValid = validateDate(
    calendar.lastDate,
    "calendar.lastDate",
    errors
  );
  if (
    anchorValid &&
    lastValid &&
    dateNumber(calendar.lastDate) < dateNumber(calendar.anchorDate)
  ) {
    errors.push("calendar.lastDate must not be before calendar.anchorDate");
  }

  if (
    !Number.isInteger(calendar.anchorDay) ||
    calendar.anchorDay < 1 ||
    calendar.anchorDay > 5
  ) {
    errors.push("calendar.anchorDay must be an integer from 1 through 5");
  }

  for (const field of ["noSchool", "conditionalMakeup"]) {
    if (!Array.isArray(calendar[field])) {
      errors.push(`calendar.${field} must be an array`);
      continue;
    }
    calendar[field].forEach((dateKey, index) => {
      validateDate(dateKey, `calendar.${field}[${index}]`, errors);
    });
  }

  if (!isRecord(calendar.overrides)) {
    errors.push("calendar.overrides must be an object");
    return;
  }

  for (const [dateKey, override] of Object.entries(calendar.overrides)) {
    validateDate(dateKey, `calendar.overrides[${dateKey}]`, errors);
    if (!isRecord(override)) {
      errors.push(`calendar.overrides[${dateKey}] must be an object`);
      continue;
    }
    if (!["cycle", "instructional", "closed"].includes(override.kind)) {
      errors.push(`calendar.overrides[${dateKey}] has unsupported kind`);
    }
    if (
      override.kind === "cycle" &&
      (!Number.isInteger(override.day) || override.day < 1 || override.day > 5)
    ) {
      errors.push(
        `calendar.overrides[${dateKey}].day must be an integer from 1 through 5`
      );
    }
  }
}

function validateTeachers(teachers, errors, eventIds) {
  if (!Array.isArray(teachers)) {
    errors.push("teachers must be an array");
    return;
  }
  if (teachers.length === 0) {
    errors.push("teachers must include at least one teacher");
    return;
  }

  const teacherIds = new Set();
  teachers.forEach((teacher, teacherIndex) => {
    const teacherPath = `teachers[${teacherIndex}]`;
    if (!isRecord(teacher)) {
      errors.push(`${teacherPath} must be an object`);
      return;
    }

    if (typeof teacher.id !== "string" || teacher.id.trim() === "") {
      errors.push(`${teacherPath}.id must be a nonempty string`);
    } else if (teacherIds.has(teacher.id)) {
      errors.push(`${teacherPath} has duplicate teacher id "${teacher.id}"`);
    } else {
      teacherIds.add(teacher.id);
    }

    if (!isRecord(teacher.days)) {
      errors.push(`${teacherPath}.days must be an object`);
      return;
    }

    for (const [dayKey, events] of Object.entries(teacher.days)) {
      if (!/^[1-5]$/.test(dayKey)) {
        errors.push(`${teacherPath}.days has invalid cycle day "${dayKey}"`);
      }
      if (!Array.isArray(events)) {
        errors.push(`${teacherPath}.days[${dayKey}] must be an array`);
        continue;
      }
      events.forEach((event, eventIndex) => {
        validateEvent(
          event,
          `${teacherPath}.days[${dayKey}][${eventIndex}]`,
          errors,
          eventIds,
          true
        );
      });
    }
  });
}

function validateSpecialEvents(specialEvents, errors, eventIds) {
  if (!Array.isArray(specialEvents)) {
    errors.push("specialEvents must be an array");
    return;
  }

  specialEvents.forEach((event, index) => {
    const path = `specialEvents[${index}]`;
    validateEvent(event, path, errors, eventIds, false);
    if (isRecord(event)) validateDate(event.date, `${path}.date`, errors);
  });
}

export function validateTeacherPlan(candidate) {
  const cloned = cloneCandidate(candidate);
  if (!cloned.ok) {
    return {
      ok: false,
      errors: ["candidate must contain cloneable plain data"],
      value: null
    };
  }

  const value = cloned.value;
  const errors = [];
  if (!isRecord(value)) {
    return {
      ok: false,
      errors: ["candidate must be an object"],
      value
    };
  }

  if (value.format !== PLAN_FORMAT) {
    errors.push(`format must be "${PLAN_FORMAT}"`);
  }
  if (value.version !== 1) {
    errors.push("version must be exactly 1");
  }

  validateCalendar(value.calendar, errors);
  const eventIds = new Set();
  validateTeachers(value.teachers, errors, eventIds);
  validateSpecialEvents(value.specialEvents, errors, eventIds);
  if (!Array.isArray(value.resources)) {
    errors.push("resources must be an array");
  }

  return { ok: errors.length === 0, errors, value };
}

function collectEvents(plan) {
  const events = new Map();
  for (const teacher of Array.isArray(plan?.teachers) ? plan.teachers : []) {
    if (!isRecord(teacher?.days)) continue;
    for (const [cycleDay, dayEvents] of Object.entries(teacher.days)) {
      for (const event of Array.isArray(dayEvents) ? dayEvents : []) {
        if (typeof event?.id !== "string") continue;
        events.set(event.id, {
          event: structuredClone(event),
          location: { kind: "teacher", teacherId: teacher.id, cycleDay }
        });
      }
    }
  }

  for (const event of Array.isArray(plan?.specialEvents)
    ? plan.specialEvents
    : []) {
    if (typeof event?.id !== "string") continue;
    events.set(event.id, {
      event: structuredClone(event),
      location: { kind: "special", date: event.date ?? null }
    });
  }
  return events;
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    return (
      left.length === right.length &&
      left.every((value, index) => deepEqual(value, right[index]))
    );
  }
  if (typeof left !== "object") return false;

  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    deepEqual(leftKeys, rightKeys) &&
    leftKeys.every((key) => deepEqual(left[key], right[key]))
  );
}

export function diffTeacherPlans(previous, next) {
  const previousEvents = collectEvents(previous);
  const nextEvents = collectEvents(next);
  const added = [];
  const removed = [];
  const changed = [];

  for (const [id, nextEntry] of nextEvents) {
    const previousEntry = previousEvents.get(id);
    if (!previousEntry) {
      added.push(nextEntry.event);
      continue;
    }
    if (
      !deepEqual(previousEntry.event, nextEntry.event) ||
      !deepEqual(previousEntry.location, nextEntry.location)
    ) {
      changed.push({
        id,
        before: previousEntry.event,
        after: nextEntry.event,
        beforeLocation: previousEntry.location,
        afterLocation: nextEntry.location
      });
    }
  }

  for (const [id, previousEntry] of previousEvents) {
    if (!nextEvents.has(id)) removed.push(previousEntry.event);
  }

  added.sort((left, right) => left.id.localeCompare(right.id));
  removed.sort((left, right) => left.id.localeCompare(right.id));
  changed.sort((left, right) => left.id.localeCompare(right.id));
  return { added, removed, changed };
}
