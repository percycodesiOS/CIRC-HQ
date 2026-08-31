import { stableId } from "./state.js";
import { validateTeacherPlan } from "./teacher-plan.js";

const SOURCE_FORMAT = "playbook.teacherPlan.v1";
const TARGET_FORMAT = "playbook.teacherPlan.v2";
const RANGE_PATTERN = /^([1-9]|1[0-2]):([0-5][0-9])-([1-9]|1[0-2]):([0-5][0-9])$/;
const OPTION_TIME_PATTERN = /^(?:0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
const SCHOOL_START = 8 * 60;
const SCHOOL_END = 16 * 60;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return structuredClone(value);
}

function uniqueCodes(codes) {
  return [...new Set(codes)];
}

function blankAudit() {
  return {
    inputEventCount: 0,
    outputEventCount: 0,
    dayCount: 0,
    dutyRuleCount: 0,
    dutyEventCount: 0,
    confirmationSlotCount: 0,
    confirmationEventCount: 0,
    sourceUnchanged: false,
    candidateValid: false,
    labelsPreserved: false,
    typesPreserved: false,
    orderPreserved: false,
    timesPreserved: false,
    idsUnique: false
  };
}

function failed(errors, audit = blankAudit()) {
  return {
    ok: false,
    value: null,
    errors: uniqueCodes(errors),
    warnings: [],
    audit
  };
}

function minutesToTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function clockCandidates(hour, minute) {
  const candidates = hour === 12
    ? [minute, 12 * 60 + minute]
    : [hour * 60 + minute, (hour + 12) * 60 + minute];
  return [...new Set(candidates)].filter(
    (value) => value >= SCHOOL_START && value <= SCHOOL_END
  );
}

function convertTimeRange(value) {
  const match = typeof value === "string" ? RANGE_PATTERN.exec(value) : null;
  if (!match) return { ok: false, error: "time-format-invalid" };
  const startCandidates = clockCandidates(Number(match[1]), Number(match[2]));
  const endCandidates = clockCandidates(Number(match[3]), Number(match[4]));
  if (startCandidates.length !== 1 || endCandidates.length !== 1) {
    return { ok: false, error: "time-endpoint-unsupported" };
  }
  const [startMinutes] = startCandidates;
  const [endMinutes] = endCandidates;
  if (endMinutes <= startMinutes) {
    return { ok: false, error: "time-order-invalid" };
  }
  return {
    ok: true,
    start: minutesToTime(startMinutes),
    end: minutesToTime(endMinutes),
    startMinutes,
    endMinutes
  };
}

function countSourceEvents(source) {
  return Array.isArray(source?.plan?.days)
    ? source.plan.days.reduce(
        (total, day) => total + (Array.isArray(day?.events) ? day.events.length : 0),
        0
      )
    : 0;
}

function validTeacher(teacher) {
  return isRecord(teacher) &&
    typeof teacher.id === "string" && teacher.id.trim() !== "" &&
    typeof teacher.name === "string" && teacher.name.trim() !== "";
}

function validDutyRule(rule) {
  return isRecord(rule) &&
    OPTION_TIME_PATTERN.test(rule.start) &&
    OPTION_TIME_PATTERN.test(rule.end) &&
    isRecord(rule.dutyDetails);
}

function validConfirmationSlot(slot) {
  return isRecord(slot) &&
    Number.isInteger(slot.day) && slot.day >= 1 && slot.day <= 5 &&
    OPTION_TIME_PATTERN.test(slot.start) &&
    OPTION_TIME_PATTERN.test(slot.end);
}

function validateSourceShape(source) {
  if (!isRecord(source) || source.format !== SOURCE_FORMAT) {
    return ["source-format-unsupported"];
  }
  if (!isRecord(source.calendar) || !Array.isArray(source.calendar.noSchool)) {
    return ["source-calendar-invalid"];
  }
  if (!isRecord(source.plan) || !Array.isArray(source.plan.days)) {
    return ["source-plan-invalid"];
  }
  const days = source.plan.days;
  const dayNumbers = days.map((day) => day?.day);
  if (
    days.length !== 5 ||
    new Set(dayNumbers).size !== 5 ||
    ![1, 2, 3, 4, 5].every((day) => dayNumbers.includes(day))
  ) {
    return ["cycle-days-invalid"];
  }
  for (const day of days) {
    if (!isRecord(day) || typeof day.label !== "string" || !Array.isArray(day.events)) {
      return ["source-day-invalid"];
    }
    for (const event of day.events) {
      if (
        !isRecord(event) ||
        typeof event.time !== "string" ||
        typeof event.type !== "string" ||
        typeof event.label !== "string"
      ) {
        return ["source-event-invalid"];
      }
    }
  }
  return [];
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) &&
      left.length === right.length && left.every((entry, index) => deepEqual(entry, right[index]));
  }
  if (typeof left !== "object") return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return deepEqual(leftKeys, rightKeys) && leftKeys.every((key) => deepEqual(left[key], right[key]));
}

function candidateEventPairs(source, candidate) {
  return source.plan.days.flatMap((sourceDay) => {
    const outputEvents = candidate.teachers[0].days[String(sourceDay.day)] ?? [];
    return sourceDay.events.map((sourceEvent, index) => ({
      sourceDay,
      sourceEvent,
      outputEvent: outputEvents[index]
    }));
  });
}

function buildAudit(source, sourceSnapshot, candidate, options, ruleUses, slotUses, candidateValid) {
  const pairs = candidateEventPairs(source, candidate);
  const outputIds = pairs.map(({ outputEvent }) => outputEvent?.id);
  return {
    inputEventCount: countSourceEvents(source),
    outputEventCount: pairs.filter(({ outputEvent }) => outputEvent).length,
    dayCount: source.plan.days.length,
    dutyRuleCount: options.dutyRules.length,
    dutyEventCount: pairs.filter(({ sourceEvent }) => sourceEvent.type === "duty").length,
    confirmationSlotCount: options.confirmationNeededSlots.length,
    confirmationEventCount: slotUses.reduce((total, count) => total + count, 0),
    sourceUnchanged: deepEqual(source, sourceSnapshot),
    candidateValid,
    labelsPreserved: pairs.every(({ sourceEvent, outputEvent }) => sourceEvent.label === outputEvent?.label),
    typesPreserved: pairs.every(({ sourceEvent, outputEvent }) => sourceEvent.type === outputEvent?.type),
    orderPreserved: pairs.every(({ sourceDay, outputEvent }, index) => {
      if (!outputEvent) return false;
      const dayPairsBefore = pairs.slice(0, index).filter((pair) => pair.sourceDay === sourceDay);
      return candidate.teachers[0].days[String(sourceDay.day)][dayPairsBefore.length]?.id === outputEvent.id;
    }),
    timesPreserved: pairs.every(({ sourceEvent, outputEvent }) => {
      const converted = convertTimeRange(sourceEvent.time);
      return converted.ok && converted.start === outputEvent?.start && converted.end === outputEvent?.end;
    }),
    idsUnique: outputIds.length === new Set(outputIds).size && outputIds.every((id) => typeof id === "string"),
    _ruleUses: ruleUses
  };
}

export function migrateTeacherPlanV1(source, options = {}) {
  let sourceSnapshot;
  let safeOptions;
  try {
    sourceSnapshot = clone(source);
    safeOptions = clone(options);
  } catch {
    return failed(["input-not-cloneable"]);
  }

  const shapeErrors = validateSourceShape(source);
  if (shapeErrors.length) return failed(shapeErrors);
  if (!validTeacher(safeOptions.teacher)) {
    return failed(["teacher-identity-required"]);
  }
  if (!Array.isArray(safeOptions.dutyRules) || !safeOptions.dutyRules.every(validDutyRule)) {
    return failed(["duty-rules-invalid"]);
  }
  if (
    !Array.isArray(safeOptions.confirmationNeededSlots) ||
    !safeOptions.confirmationNeededSlots.every(validConfirmationSlot)
  ) {
    return failed(["confirmation-slots-invalid"]);
  }

  const candidate = {
    format: TARGET_FORMAT,
    version: 1,
    calendar: {
      anchorDate: source.calendar.anchorDate,
      anchorDay: source.calendar.anchorDay,
      lastDate: source.calendar.lastDate,
      noSchool: clone(source.calendar.noSchool),
      conditionalMakeup: [],
      overrides: {}
    },
    teachers: [{
      id: safeOptions.teacher.id,
      name: safeOptions.teacher.name,
      days: {}
    }],
    specialEvents: [],
    resources: [],
    legacyV1: {
      sourceFormat: source.format,
      preferredDay: clone(source.preferredDay),
      planStatus: clone(source.plan.status),
      dayLabels: source.plan.days.map((day) => ({ day: day.day, label: day.label }))
    }
  };

  const conversionErrors = [];
  const ruleUses = safeOptions.dutyRules.map(() => 0);
  const convertedSlots = [];
  for (const day of source.plan.days) {
    const occurrences = new Map();
    const convertedEvents = [];
    for (const event of day.events) {
      const convertedTime = convertTimeRange(event.time);
      if (!convertedTime.ok) {
        conversionErrors.push(convertedTime.error);
        continue;
      }
      const occurrence = occurrences.get(convertedTime.start) ?? 0;
      occurrences.set(convertedTime.start, occurrence + 1);
      const convertedEvent = {
        id: stableId(
          "event",
          `${safeOptions.teacher.id}|cycle:${day.day}|start:${convertedTime.start}|occurrence:${occurrence}`
        ),
        type: event.type,
        label: event.label,
        start: convertedTime.start,
        end: convertedTime.end
      };

      if (event.type === "duty") {
        const matches = safeOptions.dutyRules
          .map((rule, index) => ({ rule, index }))
          .filter(({ rule }) => rule.start === convertedTime.start && rule.end === convertedTime.end);
        if (matches.length !== 1) {
          conversionErrors.push("duty-rule-match-required");
        } else {
          ruleUses[matches[0].index] += 1;
          convertedEvent.dutyDetails = clone(matches[0].rule.dutyDetails);
        }
      }

      convertedEvents.push(convertedEvent);
      convertedSlots.push({ day: day.day, event: convertedEvent });
    }
    candidate.teachers[0].days[String(day.day)] = convertedEvents;
  }

  if (ruleUses.some((count) => count === 0)) conversionErrors.push("duty-rule-unused");

  const slotUses = safeOptions.confirmationNeededSlots.map(() => 0);
  safeOptions.confirmationNeededSlots.forEach((slot, slotIndex) => {
    const matches = convertedSlots.filter(({ day, event }) =>
      day === slot.day && event.start === slot.start && event.end === slot.end
    );
    if (matches.length !== 1) {
      conversionErrors.push("confirmation-slot-match-required");
      return;
    }
    slotUses[slotIndex] = 1;
    matches[0].event.confirmation = {
      status: "needed",
      reason: "assignment-unconfirmed"
    };
  });

  if (conversionErrors.length) return failed(conversionErrors);

  const validation = validateTeacherPlan(candidate);
  const audit = buildAudit(
    source,
    sourceSnapshot,
    candidate,
    safeOptions,
    ruleUses,
    slotUses,
    validation.ok
  );
  delete audit._ruleUses;
  const integrityOk =
    audit.inputEventCount === audit.outputEventCount &&
    audit.dayCount === 5 &&
    audit.dutyEventCount === ruleUses.reduce((total, count) => total + count, 0) &&
    audit.confirmationSlotCount === audit.confirmationEventCount &&
    audit.sourceUnchanged &&
    audit.labelsPreserved &&
    audit.typesPreserved &&
    audit.orderPreserved &&
    audit.timesPreserved &&
    audit.idsUnique;
  if (!validation.ok || !integrityOk) {
    const errors = [
      ...(!validation.ok ? ["candidate-invalid"] : []),
      ...(!integrityOk ? ["conversion-integrity-failed"] : [])
    ];
    return failed(errors, audit);
  }

  return {
    ok: true,
    value: validation.value,
    errors: [],
    warnings: validation.warnings,
    audit
  };
}
