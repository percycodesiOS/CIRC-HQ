const CYCLE_DAYS = [1, 2, 3, 4, 5];
const EVENT_TYPES = [
  { type: "teach", addLabel: "Add class", optionLabel: "Class" },
  { type: "prep", addLabel: "Add prep", optionLabel: "Prep" },
  { type: "lunch", addLabel: "Add lunch", optionLabel: "Lunch" },
  { type: "support", addLabel: "Add support", optionLabel: "Support" },
  { type: "duty", addLabel: "Add duty", optionLabel: "Duty" }
];

function resolveDocument(options) {
  const documentRef = options?.document ?? globalThis.document;
  if (!documentRef || typeof documentRef.createElement !== "function") {
    throw new Error("schedule-editor-document-required");
  }
  return documentRef;
}

function element(documentRef, tagName, options = {}, children = []) {
  const node = documentRef.createElement(tagName);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    if (value !== null && value !== undefined && value !== false) {
      node.setAttribute(name, value === true ? "" : String(value));
    }
  }
  node.append(...children.filter(Boolean));
  return node;
}

function button(documentRef, label, className, onClick, attributes = {}) {
  const node = element(documentRef, "button", {
    className,
    text: label,
    attributes: { type: "button", ...attributes }
  });
  node.addEventListener("click", onClick);
  return node;
}

function field(documentRef, { id, label, name, type = "text", value = "", onInput }) {
  const input = element(documentRef, "input", {
    className: "schedule-editor-input",
    attributes: { id, name, type }
  });
  input.value = value ?? "";
  input.addEventListener("input", (event) => onInput(event.currentTarget.value));
  return element(documentRef, "label", {
    className: "schedule-editor-field",
    attributes: { for: id }
  }, [
    element(documentRef, "span", { className: "schedule-editor-label", text: label }),
    input
  ]);
}

function selectField(documentRef, { id, label, name, value, choices, onChange }) {
  const select = element(documentRef, "select", {
    className: "schedule-editor-input",
    attributes: { id, name }
  });
  select.value = String(value);
  for (const choice of choices) {
    select.append(element(documentRef, "option", {
      text: choice.label,
      attributes: {
        value: choice.value,
        ...(String(choice.value) === String(value) ? { selected: "" } : {})
      }
    }));
  }
  select.addEventListener("change", (event) => onChange(event.currentTarget.value));
  return element(documentRef, "label", {
    className: "schedule-editor-field",
    attributes: { for: id }
  }, [
    element(documentRef, "span", { className: "schedule-editor-label", text: label }),
    select
  ]);
}

function keyboardDay(key, currentDay) {
  if (key === "ArrowRight") return currentDay === 5 ? 1 : currentDay + 1;
  if (key === "ArrowLeft") return currentDay === 1 ? 5 : currentDay - 1;
  if (key === "Home") return 1;
  if (key === "End") return 5;
  return null;
}

function cycleDayTabs(documentRef, selectedCycleDay, onSelectCycleDay) {
  const tabs = CYCLE_DAYS.map((day) => {
    const selected = day === selectedCycleDay;
    const tab = button(
      documentRef,
      `Day ${day}`,
      `schedule-editor-tab${selected ? " is-selected" : ""}`,
      () => onSelectCycleDay(day),
      {
        role: "tab",
        id: `schedule-day-${day}-tab`,
        "aria-controls": `schedule-day-${day}-panel`,
        "aria-selected": selected ? "true" : "false",
        tabindex: selected ? "0" : "-1"
      }
    );
    tab.addEventListener("keydown", (event) => {
      const nextDay = keyboardDay(event.key, day);
      if (nextDay === null) return;
      event.preventDefault?.();
      onSelectCycleDay(nextDay);
    });
    return tab;
  });
  return element(documentRef, "div", {
    className: "schedule-editor-tabs",
    attributes: { role: "tablist", "aria-label": "Cycle days" }
  }, tabs);
}

function eventTypeLabel(type) {
  return EVENT_TYPES.find((choice) => choice.type === type)?.optionLabel ?? "Schedule item";
}

function eventRow(documentRef, event, day, index, callbacks) {
  const eventId = typeof event?.id === "string" ? event.id : `event-${index + 1}`;
  const fieldId = (name) => `schedule-day-${day}-event-${index + 1}-${name}`;
  const update = (name) => (value) => callbacks.onEventChange(day, eventId, name, value);
  return element(documentRef, "fieldset", {
    className: "schedule-editor-event"
  }, [
    element(documentRef, "legend", {
      text: `${eventTypeLabel(event?.type)} ${index + 1}`
    }),
    selectField(documentRef, {
      id: fieldId("type"),
      label: "Kind of time",
      name: `event-type-${eventId}`,
      value: event?.type ?? "teach",
      choices: EVENT_TYPES.map((choice) => ({ value: choice.type, label: choice.optionLabel })),
      onChange: update("type")
    }),
    field(documentRef, {
      id: fieldId("label"),
      label: "Name",
      name: `event-label-${eventId}`,
      value: event?.label,
      onInput: update("label")
    }),
    field(documentRef, {
      id: fieldId("start"),
      label: "Starts",
      name: `event-start-${eventId}`,
      type: "time",
      value: event?.start,
      onInput: update("start")
    }),
    field(documentRef, {
      id: fieldId("end"),
      label: "Ends",
      name: `event-end-${eventId}`,
      type: "time",
      value: event?.end,
      onInput: update("end")
    }),
    element(documentRef, "div", { className: "schedule-editor-event-actions" }, [
      button(documentRef, "Duplicate", "secondary-action schedule-editor-row-action", () => callbacks.onDuplicateEvent(day, eventId)),
      button(documentRef, "Remove", "schedule-editor-remove", () => callbacks.onRemoveEvent(day, eventId))
    ])
  ]);
}

function errorsView(documentRef, errors) {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  return element(documentRef, "section", {
    className: "schedule-editor-errors",
    attributes: { role: "alert", "aria-live": "polite" }
  }, [
    element(documentRef, "h2", { text: "Check these schedule details" }),
    element(documentRef, "ul", {}, errors.map((error) =>
      element(documentRef, "li", { text: error })
    ))
  ]);
}

function advancedBackup(documentRef, onRestoreBackup) {
  const input = element(documentRef, "input", {
    className: "schedule-editor-backup-input",
    attributes: { id: "schedule-backup-file", type: "file" }
  });
  input.addEventListener("change", (event) => {
    const file = event.currentTarget.files?.[0] ?? null;
    if (file) onRestoreBackup(file);
  });
  return element(documentRef, "details", { className: "schedule-editor-advanced" }, [
    element(documentRef, "summary", { text: "Advanced backup" }),
    element(documentRef, "div", { className: "schedule-editor-advanced-content" }, [
      element(documentRef, "h2", { text: "Restore a CIRC backup" }),
      element(documentRef, "p", { text: "Use this only when restoring a saved CIRC schedule." }),
      element(documentRef, "label", {
        className: "schedule-editor-file-label",
        text: "Choose a CIRC backup",
        attributes: { for: "schedule-backup-file" }
      }),
      input
    ])
  ]);
}

export function buildScheduleEditor(input, options = {}) {
  const documentRef = resolveDocument(options);
  const draft = input?.draft ?? {};
  const selectedCycleDay = Number(input?.selectedCycleDay);
  const callbacks = input?.callbacks ?? {};
  const day = CYCLE_DAYS.includes(selectedCycleDay) ? selectedCycleDay : 1;
  const requestedCopyTarget = Number(input?.copyTargetDay);
  const copyTargetDay = CYCLE_DAYS.includes(requestedCopyTarget) && requestedCopyTarget !== day
    ? requestedCopyTarget
    : day === 5 ? 1 : day + 1;
  const events = Array.isArray(draft?.days?.[day]) ? draft.days[day] : [];

  const calendarFields = element(documentRef, "section", {
    className: "schedule-editor-calendar",
    attributes: { "aria-labelledby": "schedule-calendar-heading" }
  }, [
    element(documentRef, "h2", {
      text: "School year",
      attributes: { id: "schedule-calendar-heading" }
    }),
    field(documentRef, {
      id: "schedule-teacher-name",
      label: "Teacher name",
      name: "teacher-name",
      value: draft.teacherName,
      onInput: callbacks.onTeacherNameChange
    }),
    field(documentRef, {
      id: "schedule-first-school-date",
      label: "First school day",
      name: "first-school-date",
      type: "date",
      value: draft.firstSchoolDate,
      onInput: callbacks.onFirstSchoolDateChange
    }),
    field(documentRef, {
      id: "schedule-last-school-date",
      label: "Last school day",
      name: "last-school-date",
      type: "date",
      value: draft.lastSchoolDate,
      onInput: callbacks.onLastSchoolDateChange
    }),
    selectField(documentRef, {
      id: "schedule-anchor-cycle-day",
      label: "Cycle day on the first school day",
      name: "anchor-cycle-day",
      value: draft.anchorCycleDay ?? 1,
      choices: CYCLE_DAYS.map((cycleDay) => ({ value: cycleDay, label: `Day ${cycleDay}` })),
      onChange: (value) => callbacks.onAnchorCycleDayChange(Number(value))
    })
  ]);

  const dayPanel = element(documentRef, "section", {
    className: "schedule-editor-day-panel",
    attributes: {
      id: `schedule-day-${day}-panel`,
      role: "tabpanel",
      "aria-labelledby": `schedule-day-${day}-tab`
    }
  }, [
    element(documentRef, "div", { className: "schedule-editor-day-heading" }, [
      element(documentRef, "h2", { text: `Day ${day} schedule` }),
      element(documentRef, "div", { className: "schedule-editor-copy-controls" }, [
        selectField(documentRef, {
          id: "schedule-copy-target-day",
          label: "Copy this day to",
          name: "copy-target-day",
          value: copyTargetDay,
          choices: CYCLE_DAYS.filter((candidate) => candidate !== day).map((candidate) => ({
            value: candidate,
            label: `Day ${candidate}`
          })),
          onChange: (value) => callbacks.onCopyTargetChange(Number(value))
        }),
        button(documentRef, `Copy to Day ${copyTargetDay}`, "secondary-action schedule-editor-copy", () => callbacks.onCopyDay(day, copyTargetDay))
      ])
    ]),
    events.length === 0
      ? element(documentRef, "div", { className: "schedule-editor-empty" }, [
          element(documentRef, "h3", { text: `Day ${day} is empty` }),
          element(documentRef, "p", {
            text: "Example: add morning duty, each class, prep, lunch, support, and dismissal duty in time order."
          })
        ])
      : element(documentRef, "div", { className: "schedule-editor-events" },
          events.map((event, index) => eventRow(documentRef, event, day, index, callbacks))),
    element(documentRef, "div", {
      className: "schedule-editor-add-actions",
      attributes: { "aria-label": `Add an item to Day ${day}` }
    }, EVENT_TYPES.map((choice) => button(
      documentRef,
      choice.addLabel,
      "secondary-action schedule-editor-add",
      () => callbacks.onAddEvent(day, choice.type)
    )))
  ]);

  return element(documentRef, "section", {
    className: "schedule-editor",
    attributes: { "aria-labelledby": "schedule-editor-heading" }
  }, [
    element(documentRef, "header", { className: "schedule-editor-header" }, [
      element(documentRef, "p", { className: "eyebrow", text: "Teacher schedule" }),
      element(documentRef, "h1", {
        text: "Build your five-day schedule",
        attributes: { id: "schedule-editor-heading" }
      }),
      element(documentRef, "p", { text: "Add the day exactly as it happens. CIRC HQ will put it in time order." })
    ]),
    errorsView(documentRef, input?.errors),
    calendarFields,
    cycleDayTabs(documentRef, day, callbacks.onSelectCycleDay),
    dayPanel,
    element(documentRef, "div", { className: "schedule-editor-actions" }, [
      button(documentRef, "Save schedule", "primary-action", () => callbacks.onSave()),
      button(documentRef, "Cancel", "secondary-action", () => callbacks.onCancel())
    ]),
    advancedBackup(documentRef, callbacks.onRestoreBackup)
  ]);
}
