import {
  admitResource,
  findForbiddenField,
  hasExactKeys,
  isBoundedText,
  isEventId,
  isLocalId,
  isPlainRecord
} from "./schema-admission.js";
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

const PLAN_KEYS = new Set([
  "format", "version", "calendar", "teachers", "specialEvents", "resources", "legacyV1"
]);
const CALENDAR_KEYS = new Set([
  "anchorDate", "anchorDay", "lastDate", "noSchool", "conditionalMakeup", "overrides"
]);
const OVERRIDE_KEYS = new Set(["id", "kind", "day"]);
const TEACHER_KEYS = new Set(["id", "name", "days"]);
const EVENT_KEYS = new Set([
  "id", "type", "label", "start", "end", "classId", "lessonGuideId",
  "rotationId", "unitId", "confirmation", "dutyDetails"
]);
const SPECIAL_EVENT_KEYS = new Set([
  "id", "type", "label", "date", "start", "end", "classId", "lessonGuideId",
  "rotationId", "unitId", "confirmation"
]);

function exactShape(value, keys, required, path, errors) {
  if (!hasExactKeys(value, keys, required)) {
    errors.push(`${path} contains unsupported or missing fields`);
    return false;
  }
  return true;
}

function canonicalDateList(value, path, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  const result = [];
  const seen = new Set();
  value.forEach((date, index) => {
    if (!validateDate(date, `${path}[${index}]`, errors) || seen.has(date)) {
      if (seen.has(date)) errors.push(`${path} must not contain duplicate dates`);
      return;
    }
    seen.add(date);
    result.push(date);
  });
  return result;
}

function canonicalCalendar(calendar, errors) {
  if (!exactShape(calendar, CALENDAR_KEYS, CALENDAR_KEYS, "calendar", errors)) return null;
  const anchorValid = validateDate(calendar.anchorDate, "calendar.anchorDate", errors);
  const lastValid = validateDate(calendar.lastDate, "calendar.lastDate", errors);
  if (anchorValid && lastValid && dateNumber(calendar.lastDate) < dateNumber(calendar.anchorDate)) {
    errors.push("calendar.lastDate must not be before calendar.anchorDate");
  }
  if (!Number.isInteger(calendar.anchorDay) || calendar.anchorDay < 1 || calendar.anchorDay > 5) {
    errors.push("calendar.anchorDay must be an integer from 1 through 5");
  }
  const noSchool = canonicalDateList(calendar.noSchool, "calendar.noSchool", errors);
  const conditionalMakeup = canonicalDateList(
    calendar.conditionalMakeup,
    "calendar.conditionalMakeup",
    errors
  );
  if (!isPlainRecord(calendar.overrides)) {
    errors.push("calendar.overrides must be an object");
    return null;
  }
  const overrides = {};
  for (const [dateKey, override] of Object.entries(calendar.overrides)) {
    validateDate(dateKey, `calendar.overrides[${dateKey}]`, errors);
    if (!exactShape(override, OVERRIDE_KEYS, ["kind"], `calendar.overrides[${dateKey}]`, errors)) {
      continue;
    }
    if (!["cycle", "instructional", "closed"].includes(override.kind)) {
      errors.push(`calendar.overrides[${dateKey}] has unsupported kind`);
      continue;
    }
    if (override.id !== undefined && !isLocalId(override.id)) {
      errors.push(`calendar.overrides[${dateKey}].id must be a local machine ID`);
    }
    if (override.kind === "cycle") {
      if (!Number.isInteger(override.day) || override.day < 1 || override.day > 5) {
        errors.push(`calendar.overrides[${dateKey}].day must be an integer from 1 through 5`);
      }
    } else if (override.day !== undefined) {
      errors.push(`calendar.overrides[${dateKey}].day is supported only for cycle overrides`);
    }
    overrides[dateKey] = {
      ...(override.id !== undefined ? { id: override.id } : {}),
      kind: override.kind,
      ...(override.kind === "cycle" ? { day: override.day } : {})
    };
  }
  return {
    anchorDate: calendar.anchorDate,
    anchorDay: calendar.anchorDay,
    lastDate: calendar.lastDate,
    noSchool,
    conditionalMakeup,
    overrides
  };
}

function canonicalConfirmation(value, path, errors) {
  if (
    !hasExactKeys(value, ["status", "reason"]) ||
    value.status !== "needed" ||
    value.reason !== "assignment-unconfirmed"
  ) {
    errors.push(`${path} must match the supported confirmation schema`);
    return null;
  }
  return { status: "needed", reason: "assignment-unconfirmed" };
}

function canonicalDutyDetails(value, path, errors) {
  if (!hasExactKeys(value, ["label", "assignment", "location"])) {
    errors.push(`${path} must match the supported duty schema`);
    return null;
  }
  for (const field of ["label", "assignment", "location"]) {
    if (!isBoundedText(value[field], { max: 500 })) {
      errors.push(`${path}.${field} must be bounded trimmed text`);
      return null;
    }
  }
  return {
    label: value.label,
    assignment: value.assignment,
    location: value.location
  };
}

function optionalLocalId(event, field, path, errors) {
  if (event[field] === undefined) return null;
  if (!isLocalId(event[field])) {
    errors.push(`${path}.${field} must be a local machine ID`);
    return null;
  }
  return event[field];
}

function canonicalScheduledEvent(event, path, errors, eventIds) {
  if (!exactShape(
    event,
    EVENT_KEYS,
    ["id", "type", "label", "start", "end"],
    path,
    errors
  )) return null;
  if (!isEventId(event.id)) {
    errors.push(`${path}.id must use the shared event id grammar`);
  } else if (eventIds.has(event.id)) {
    errors.push(`${path} has duplicate event id "${event.id}"`);
  } else {
    eventIds.add(event.id);
  }
  if (!ALLOWED_EVENT_TYPES.has(event.type)) {
    errors.push(`${path} has unsupported type`);
  }
  if (!isBoundedText(event.label, { max: 500 })) {
    errors.push(`${path}.label must be bounded trimmed text`);
  }
  validateEventTime(event, path, errors, true);
  const classId = optionalLocalId(event, "classId", path, errors);
  const lessonGuideId = optionalLocalId(event, "lessonGuideId", path, errors);
  const rotationId = optionalLocalId(event, "rotationId", path, errors);
  const unitId = optionalLocalId(event, "unitId", path, errors);
  if (event.type !== "teach" && (event.classId !== undefined || event.lessonGuideId !== undefined)) {
    errors.push(`${path} class and lesson IDs are supported only for teach events`);
  }
  if (event.type !== "duty" && event.dutyDetails !== undefined) {
    errors.push(`${path}.dutyDetails is supported only for duty events`);
  }
  const confirmation = event.confirmation === undefined
    ? null
    : canonicalConfirmation(event.confirmation, `${path}.confirmation`, errors);
  const dutyDetails = event.dutyDetails === undefined
    ? null
    : canonicalDutyDetails(event.dutyDetails, `${path}.dutyDetails`, errors);
  return {
    id: event.id,
    type: event.type,
    label: event.label,
    start: event.start,
    end: event.end,
    ...(event.type === "teach" && classId ? { classId } : {}),
    ...(event.type === "teach" && lessonGuideId ? { lessonGuideId } : {}),
    ...(rotationId ? { rotationId } : {}),
    ...(unitId ? { unitId } : {}),
    ...(confirmation ? { confirmation } : {}),
    ...(event.type === "duty" && dutyDetails ? { dutyDetails } : {})
  };
}

function canonicalTeacher(teacher, index, errors, eventIds, teacherIds) {
  const path = `teachers[${index}]`;
  if (!exactShape(teacher, TEACHER_KEYS, ["id", "days"], path, errors)) return null;
  if (typeof teacher.id !== "string" || teacher.id.trim() === "" || teacher.id.length > 128) {
    errors.push(`${path}.id must be a bounded nonempty string`);
  } else if (teacherIds.has(teacher.id)) {
    errors.push(`${path} has duplicate teacher id`);
  } else {
    teacherIds.add(teacher.id);
  }
  if (teacher.name !== undefined && !isBoundedText(teacher.name, { max: 300 })) {
    errors.push(`${path}.name must be bounded trimmed text`);
  }
  if (!isPlainRecord(teacher.days)) {
    errors.push(`${path}.days must be an object`);
    return null;
  }
  const days = {};
  for (const [dayKey, events] of Object.entries(teacher.days)) {
    if (!/^[1-5]$/.test(dayKey)) {
      errors.push(`${path}.days has invalid cycle day`);
      continue;
    }
    if (!Array.isArray(events)) {
      errors.push(`${path}.days[${dayKey}] must be an array`);
      continue;
    }
    days[dayKey] = events.map((event, eventIndex) => canonicalScheduledEvent(
      event,
      `${path}.days[${dayKey}][${eventIndex}]`,
      errors,
      eventIds
    )).filter(Boolean);
  }
  return {
    id: teacher.id,
    ...(teacher.name !== undefined ? { name: teacher.name } : {}),
    days
  };
}

function canonicalSpecialEvent(event, index, errors, eventIds) {
  const path = `specialEvents[${index}]`;
  if (!exactShape(
    event,
    SPECIAL_EVENT_KEYS,
    ["id", "type", "label", "date"],
    path,
    errors
  )) return null;
  if (!isEventId(event.id)) {
    errors.push(`${path}.id must use the shared event id grammar`);
  } else if (eventIds.has(event.id)) {
    errors.push(`${path} has duplicate event id "${event.id}"`);
  } else {
    eventIds.add(event.id);
  }
  if (event.type !== "special") errors.push(`${path} has unsupported type`);
  if (!isBoundedText(event.label, { max: 500 })) errors.push(`${path}.label must be bounded trimmed text`);
  validateDate(event.date, `${path}.date`, errors);
  validateEventTime(event, path, errors, false);
  const hasTime = event.start !== undefined || event.end !== undefined;
  const classId = optionalLocalId(event, "classId", path, errors);
  const lessonGuideId = optionalLocalId(event, "lessonGuideId", path, errors);
  const rotationId = optionalLocalId(event, "rotationId", path, errors);
  const unitId = optionalLocalId(event, "unitId", path, errors);
  const confirmation = event.confirmation === undefined
    ? null
    : canonicalConfirmation(event.confirmation, `${path}.confirmation`, errors);
  return {
    id: event.id,
    type: "special",
    label: event.label,
    date: event.date,
    ...(hasTime ? { start: event.start, end: event.end } : {}),
    ...(classId ? { classId } : {}),
    ...(lessonGuideId ? { lessonGuideId } : {}),
    ...(rotationId ? { rotationId } : {}),
    ...(unitId ? { unitId } : {}),
    ...(confirmation ? { confirmation } : {})
  };
}

function validLegacyV1(value) {
  if (!hasExactKeys(value, ["sourceFormat", "preferredDay", "planStatus", "dayLabels"])) {
    return false;
  }
  if (
    value.sourceFormat !== "playbook.teacherPlan.v1" ||
    !Number.isInteger(value.preferredDay) || value.preferredDay < 1 || value.preferredDay > 5 ||
    !isBoundedText(value.planStatus, { max: 200 }) ||
    !Array.isArray(value.dayLabels) || value.dayLabels.length !== 5
  ) return false;
  const days = new Set();
  for (const entry of value.dayLabels) {
    if (
      !hasExactKeys(entry, ["day", "label"]) ||
      !Number.isInteger(entry.day) || entry.day < 1 || entry.day > 5 ||
      !isBoundedText(entry.label, { max: 300 }) ||
      days.has(entry.day)
    ) return false;
    days.add(entry.day);
  }
  return days.size === 5;
}

export function validateTeacherPlan(candidate) {
  const errors = [];
  const warnings = [];
  if (!isPlainRecord(candidate)) {
    return { ok: false, errors: ["candidate must be an object"], warnings, value: null };
  }
  if (findForbiddenField(candidate)) {
    return { ok: false, errors: ["candidate contains a forbidden individual-record field"], warnings, value: null };
  }
  if (!exactShape(
    candidate,
    PLAN_KEYS,
    ["format", "version", "calendar", "teachers", "specialEvents", "resources"],
    "candidate",
    errors
  )) {
    return { ok: false, errors, warnings, value: null };
  }
  if (candidate.format !== PLAN_FORMAT) errors.push(`format must be "${PLAN_FORMAT}"`);
  if (candidate.version !== 1) errors.push("version must be exactly 1");
  const calendar = canonicalCalendar(candidate.calendar, errors);
  const eventIds = new Set();
  const teacherIds = new Set();
  if (!Array.isArray(candidate.teachers) || candidate.teachers.length === 0) {
    errors.push("teachers must include at least one teacher");
  }
  const teachers = Array.isArray(candidate.teachers)
    ? candidate.teachers.map((teacher, index) => canonicalTeacher(
        teacher,
        index,
        errors,
        eventIds,
        teacherIds
      )).filter(Boolean)
    : [];
  if (!Array.isArray(candidate.specialEvents)) errors.push("specialEvents must be an array");
  const specialEvents = Array.isArray(candidate.specialEvents)
    ? candidate.specialEvents.map((event, index) => canonicalSpecialEvent(
        event,
        index,
        errors,
        eventIds
      )).filter(Boolean)
    : [];
  if (!Array.isArray(candidate.resources)) errors.push("resources must be an array");
  const resources = Array.isArray(candidate.resources)
    ? candidate.resources.map((resource, index) => {
        const admitted = admitResource(resource);
        if (!admitted) errors.push(`resources[${index}] must match the admitted resource schema`);
        return admitted;
      }).filter(Boolean)
    : [];
  if (candidate.legacyV1 !== undefined) {
    if (!validLegacyV1(candidate.legacyV1)) errors.push("legacyV1 metadata is invalid");
    else warnings.push("legacy-v1-metadata-stripped");
  }
  if (errors.length) return { ok: false, errors: [...new Set(errors)], warnings, value: null };
  return {
    ok: true,
    errors: [],
    warnings,
    value: {
      format: PLAN_FORMAT,
      version: 1,
      calendar,
      teachers,
      specialEvents,
      resources
    }
  };
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
