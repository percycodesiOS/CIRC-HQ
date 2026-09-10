import {
  ANNOUNCEMENT_CREW_ROLES,
  ANNOUNCEMENT_WORKFLOW,
  GRADE_SIX_ANNOUNCEMENT_RESPONSIBILITY,
  PREPARED_ECMS_BROADCASTS,
  evaluateAnnouncementDraft,
  getAnnouncementCrew
} from "../model/announcements.js";
import { CREW_SIGNUP_ROLES } from "../model/crew-signup.js";

function resolveDocument(options) {
  const documentRef = options?.document ?? globalThis.document;
  if (!documentRef || typeof documentRef.createElement !== "function") {
    throw new Error("announcements-document-required");
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

function textField(documentRef, {
  id,
  name,
  label,
  value = "",
  type = "text",
  attributes = {},
  help,
  onInput
}) {
  const input = element(documentRef, "input", {
    className: "announcements-input",
    attributes: { id, name, type, ...attributes }
  });
  input.value = value ?? "";
  input.addEventListener("input", (event) => onInput(event.currentTarget.value));
  return element(documentRef, "label", {
    className: "announcements-field",
    attributes: { for: id }
  }, [
    element(documentRef, "span", { className: "announcements-label", text: label }),
    input,
    help ? element(documentRef, "small", { text: help }) : null
  ]);
}

function scriptField(documentRef, { id, name, label, value = "", help, onInput }) {
  const textarea = element(documentRef, "textarea", {
    className: "announcements-textarea",
    attributes: { id, name, rows: "4", maxlength: "2000" }
  });
  textarea.value = value ?? "";
  textarea.addEventListener("input", (event) => onInput(event.currentTarget.value));
  return element(documentRef, "label", {
    className: "announcements-field announcements-script-field",
    attributes: { for: id }
  }, [
    element(documentRef, "span", { className: "announcements-label", text: label }),
    textarea,
    help ? element(documentRef, "small", { text: help }) : null
  ]);
}

function checkbox(documentRef, { id, name, label, checked, disabled = false, onChange }) {
  const input = element(documentRef, "input", {
    className: "announcements-check",
    attributes: { id, name, type: "checkbox", disabled }
  });
  input.checked = checked === true;
  input.addEventListener("change", (event) => {
    if (!disabled) onChange(event.currentTarget.checked === true);
  });
  return element(documentRef, "label", {
    className: `announcements-check-row${disabled ? " is-locked" : ""}`,
    attributes: { for: id }
  }, [input, element(documentRef, "span", { text: label })]);
}

function crewView(documentRef) {
  return element(documentRef, "section", {
    className: "announcements-crew",
    attributes: { "aria-labelledby": "announcements-crew-heading" }
  }, [
    element(documentRef, "h2", {
      text: "Daily crew roles",
      attributes: { id: "announcements-crew-heading" }
    }),
    element(documentRef, "p", {
      text: "Assign roles in person or from a private teacher roster. Use only first names approved for the broadcast in the script; keep rosters and private notices out."
    }),
    element(documentRef, "div", { className: "announcements-role-grid" },
      ANNOUNCEMENT_CREW_ROLES.map((role) => element(documentRef, "article", {
        className: "announcements-role"
      }, [
        element(documentRef, "h3", { text: role.label }),
        element(documentRef, "p", { text: role.responsibility })
      ])))
  ]);
}

export function buildCrewSignupView(input, options = {}) {
  const documentRef = resolveDocument(options);
  const { form, saved, status = "", callbacks = {}, classLabels = [] } = input;
  const slots = saved.book.dates[form.date] ?? {};
  const selectField = (field, label, choices) => {
    const select = element(documentRef, "select", { className: "announcements-input", attributes: { id: `signup-${field}`, name: `signup-${field}` } }, choices.map(choice => element(documentRef, "option", {
      text: choice.label, attributes: { value: choice.value }
    })));
    select.value = form[field];
    select.addEventListener("change", event => callbacks.onChange?.(field, event.currentTarget.value));
    return element(documentRef, "label", { className: "announcements-field", attributes: { for: `signup-${field}` } }, [
      element(documentRef, "span", { className: "announcements-label", text: label }), select
    ]);
  };
  const memberLabel = member => member ? `${member.firstName} (${member.classLabel})` : "Open";
  const required = CREW_SIGNUP_ROLES.filter(role => !role.optional);
  const primaryCount = required.filter(role => slots[`${role.id}:primary`]).length;
  const backupCount = required.filter(role => slots[`${role.id}:backup`]).length;
  const assignments = CREW_SIGNUP_ROLES.map(role => element(documentRef, "article", { className: "announcements-role" }, [
    element(documentRef, "h3", { text: `${role.label}${role.optional ? " (optional)" : ""}` }),
    ...["primary", "backup"].map(side => element(documentRef, "div", { className: "crew-signup-assignment" }, [
      element(documentRef, "p", { text: `${side === "primary" ? "Primary" : "Backup"}: ${memberLabel(slots[`${role.id}:${side}`])}` }),
      slots[`${role.id}:${side}`] ? button(documentRef, "Remove", "secondary-action", () => callbacks.onRemove?.(`${role.id}:${side}`), { "aria-label": `Remove ${role.label} ${side}` }) : null
    ]))
  ]));
  return element(documentRef, "section", { className: "announcements crew-signup", attributes: { "data-private-signup": "true", "aria-labelledby": "crew-signup-heading" } }, [
    element(documentRef, "header", { className: "announcements-header" }, [
      element(documentRef, "p", { className: "eyebrow", text: "Teacher-supervised sign-up" }),
      element(documentRef, "h1", { text: "Morning show crew", attributes: { id: "crew-signup-heading" } }),
      element(documentRef, "p", { text: "Director: Kenny. Choose 2 announcers, 4 reporters and 2 camera operators. Up to 2 producers are optional. Pair every job with a different backup." }),
      element(documentRef, "p", { className: "announcements-local-notice", text: "Kenny keeps control of this screen while students choose their class, first name, date and available job. Keep this screen off the projector. Names stay in this browser on this device, separate from scripts and cloud sync. This is not a form students can join from other devices." }),
      button(documentRef, "Open student work area", "primary-action", () => callbacks.onOpenStudentStudio?.()),
      button(documentRef, "Back to announcement studio", "secondary-action", () => callbacks.onBack?.())
    ]),
    element(documentRef, "section", { className: "announcements-details" }, [
      element(documentRef, "h2", { text: "Choose a place" }),
      element(documentRef, "p", { text: "Select the actual broadcast date. One person has one primary or backup job per date. Use a first name plus last initial only when needed to tell classmates apart. A sign-up is a request Kenny reviews; it does not record attendance or approve the broadcast." }),
      element(documentRef, "div", { className: "crew-signup-fields" }, [
        textField(documentRef, { id: "signup-date", name: "signup-date", label: "Broadcast date", type: "date", value: form.date, onInput: value => callbacks.onChange?.("date", value) }),
        textField(documentRef, { id: "signup-classLabel", name: "signup-classLabel", label: "Class / homeroom", value: form.classLabel, attributes: { maxlength: "60", list: "signup-classes", autocomplete: "off" }, onInput: value => callbacks.onChange?.("classLabel", value) }),
        textField(documentRef, { id: "signup-firstName", name: "signup-firstName", label: "First name", value: form.firstName, attributes: { maxlength: "60", autocomplete: "off" }, onInput: value => callbacks.onChange?.("firstName", value) }),
        selectField("role", "Job", CREW_SIGNUP_ROLES.map(role => ({ value: role.id, label: `${role.label}${role.optional ? " (optional)" : ""}` }))),
        selectField("side", "Primary or backup", [{ value: "primary", label: "Primary" }, { value: "backup", label: "Backup" }])
      ]),
      element(documentRef, "datalist", { attributes: { id: "signup-classes" } }, classLabels.map(value => element(documentRef, "option", { attributes: { value } }))),
      button(documentRef, "Save this sign-up", "primary-action", () => callbacks.onSave?.()),
      element(documentRef, "p", { text: status || "No sign-up is saved until you choose Save this sign-up.", attributes: { role: "status", "aria-live": "polite" } }),
      ["invalid", "unavailable"].includes(saved.status) ? element(documentRef, "p", { text: "Crew storage is unreadable or unavailable. The saved value is untouched. Use a private paper sheet for today.", attributes: { role: "alert" } }) : null
    ]),
    element(documentRef, "section", { className: "announcements-crew" }, [
      element(documentRef, "h2", { text: `Crew for ${form.date || "the selected date"}` }),
      element(documentRef, "p", { text: `${primaryCount} of 8 required primary jobs filled. ${backupCount} of 8 required backups filled. Review optional producers and their backups if used.` }),
      element(documentRef, "div", { className: "announcements-role-grid" }, assignments)
    ]),
    element(documentRef, "details", { className: "announcements-details" }, [
      element(documentRef, "summary", { text: "Saved dates and paper fallback" }),
      element(documentRef, "p", { text: "Choose any date above to review it. If this browser or device is unavailable, use a private paper sheet with Date, Class, First name, Job and Primary/Backup columns. Kenny keeps the sheet. The school PC and your phone have separate saved lists." }),
      element(documentRef, "p", { text: Object.keys(saved.book.dates).sort().join(", ") || "No dates saved yet." })
    ])
  ]);
}

function privateCrewView(documentRef, draft, callbacks) {
  const crew = getAnnouncementCrew(draft);
  const labels = {
    homeroomConfirmed: "Student says they checked in with their homeroom teacher before coming to CIRC",
    arrived: "Arrived in CIRC",
    ready: "Ready to read the rehearsed script",
    lateNotified: "Kenny was told about a delay",
    teacherCovers: "Teacher has arranged coverage for this role",
    backupActive: "Teacher is using the backup for this role (changing this resets the role's checks)"
  };
  const timeLabels = {
    arrival: "Crew due", backup: "Teacher backup decision", finalCheck: "Final microphone and script check", broadcast: "On air"
  };
  const displayTime = (time) => `${Number(time.slice(0, 2)) % 12 || 12}:${time.slice(3)} ${Number(time.slice(0, 2)) < 12 ? "a.m." : "p.m."}`;
  return element(documentRef, "section", {
    className: "announcements-crew announcements-private-crew",
    attributes: { "aria-labelledby": "announcements-private-crew-heading", "data-private-crew": "true" }
  }, [
    element(documentRef, "h2", { text: "Private crew check-in", attributes: { id: "announcements-private-crew-heading" } }),
    element(documentRef, "p", {
      text: `For ${draft.date || "the selected broadcast date"}. Confirm homeroom check-in before coming to CIRC. If running late, tell Kenny through the usual school-approved route before the crew is due. This screen does not send a message.`
    }),
    element(documentRef, "p", {
      text: "Homeroom confirmation is a student affirmation, not official school attendance. Only the teacher records these checks. They stay out of broadcast view; do not mirror this preparation screen. No student names are stored here."
    }),
    element(documentRef, "details", {}, [
      element(documentRef, "summary", { text: "Adjust recommended crew times" }),
      element(documentRef, "p", { text: "Teacher-editable workflow, not an official attendance policy. These times do not trigger messages, replacements or any automatic changes." }),
      ...Object.entries(timeLabels).map(([field, label]) => textField(documentRef, {
        id: `crew-time-${field}`, name: `crew-time-${field}`, label, type: "time", value: crew.times[field],
        onInput: (value) => callbacks.onCrewTimeChange?.(field, value)
      }))
    ]),
    element(documentRef, "p", {
      text: `Crew due ${displayTime(crew.times.arrival)} At ${displayTime(crew.times.backup)}, if either announcer is missing, has not confirmed homeroom check-in, or cannot be ready in time, Kenny chooses a rehearsed backup or covers the role. Tell Kenny about bus or teacher delays so he can adjust the plan. Final microphone and script check: ${displayTime(crew.times.finalCheck)} On air: ${displayTime(crew.times.broadcast)}`
    }),
    ...Object.entries(crew.announcers).map(([slot, member], index) => element(documentRef, "fieldset", {
      className: "announcements-phase"
    }, [
      element(documentRef, "legend", { text: `Announcer ${index + 1}${member.backupActive ? " (backup)" : ""}` }),
      ...Object.entries(labels).slice(0, 3).map(([field, label]) => checkbox(documentRef, {
        id: `crew-${slot}-${field}`, name: `crew-${slot}-${field}`, label, checked: member[field],
        onChange: (checked) => callbacks.onCrewCheckChange?.(slot, field, checked)
      })),
      element(documentRef, "details", {}, [
        element(documentRef, "summary", { text: "Delay or backup options" }),
        element(documentRef, "p", { text: "Only a homeroom-checked, present, ready student or a teacher may cover. A backup needs fresh confirmations. Arrange coverage explicitly; this never clears an unchecked student to come to CIRC." }),
        ...Object.entries(labels).slice(3).map(([field, label]) => checkbox(documentRef, {
          id: `crew-${slot}-${field}`, name: `crew-${slot}-${field}`, label, checked: member[field],
          onChange: (checked) => callbacks.onCrewCheckChange?.(slot, field, checked)
        }))
      ]),
      element(documentRef, "p", {
        attributes: { role: "status", "aria-live": "polite" },
        text: member.teacherCovers
          ? "Teacher-arranged coverage recorded. Any student covering must have checked in with homeroom, arrived and be ready."
          : member.homeroomConfirmed && member.arrived && member.ready
            ? "Homeroom, arrival and readiness confirmed for this role."
            : "Still needs a crew check. This is not a no-show or absence record."
      })
    ])),
    button(documentRef, "Crew assignments changed: reset checks", "secondary-action", () => callbacks.onCrewReset?.()),
    element(documentRef, "p", {
      text: "Save local draft keeps these checks with this date in this browser only. Loading the same saved date preserves its recorded checks; review them before use. Changing the date or opening introductions clears both roles' checks. Changing a role to or from backup clears that role. For any other crew change, use Reset checks and rehearse again. Go live requires both script approval and each role's confirmations or teacher-arranged coverage."
    })
  ]);
}

function errorsView(documentRef, errors) {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  return element(documentRef, "section", {
    className: "announcements-errors",
    attributes: { role: "alert", "aria-live": "polite" }
  }, [
    element(documentRef, "h2", { text: "Finish these before teacher review" }),
    element(documentRef, "ul", {}, errors.map(({ message }) => element(documentRef, "li", { text: message })))
  ]);
}

function reviewStatus(documentRef, assessment, approved) {
  const text = assessment.canGoLive
    ? "Teacher approved the script. Review private crew readiness before going live."
    : assessment.reviewReady
      ? approved
        ? "Script approval is recorded. Confirm both crew roles or arrange coverage before going live."
        : "The script and rehearsal are ready for teacher review."
      : "Teacher review unlocks after the script, preparation, and rehearsal are complete.";
  return element(documentRef, "p", {
    className: "announcements-review-status",
    text,
    attributes: { role: "status", "aria-live": "polite" }
  });
}

function workflowView(documentRef, draft, assessment, callbacks) {
  return element(documentRef, "section", {
    className: "announcements-workflow",
    attributes: { "aria-labelledby": "announcements-workflow-heading" }
  }, [
    element(documentRef, "h2", {
      text: "Daily broadcast checklist",
      attributes: { id: "announcements-workflow-heading" }
    }),
    element(documentRef, "p", { className: "announcements-phase-line", text: "Prepare Rehearse Go live Reset" }),
    ...ANNOUNCEMENT_WORKFLOW.map((phase) => element(documentRef, "fieldset", {
      className: `announcements-phase announcements-phase-${phase.id}`
    }, [
      element(documentRef, "legend", { text: phase.label }),
      ...phase.items.map((item) => {
        if (item.kind === "review") {
          return checkbox(documentRef, {
            id: "teacher-review",
            name: "teacher-review",
            label: item.label,
            checked: draft.teacherReview?.approved,
            disabled: !assessment.reviewReady,
            onChange: (checked) => callbacks.onTeacherReviewChange?.(checked)
          });
        }
        const complete = draft.checklist?.[phase.id]?.[item.id] === true;
        const disabled = phase.id === "go-live" && item.id === "broadcastComplete" && !assessment.canGoLive;
        return checkbox(documentRef, {
          id: `check-${phase.id}-${item.id}`,
          name: `check-${phase.id}-${item.id}`,
          label: item.label,
          checked: complete,
          disabled,
          onChange: (checked) => callbacks.onChecklistChange?.(phase.id, item.id, checked)
        });
      })
    ])),
    reviewStatus(documentRef, assessment, draft.teacherReview?.approved === true)
  ]);
}

export function buildAnnouncementsWorkflow(input, options = {}) {
  const documentRef = resolveDocument(options);
  const draft = input?.draft;
  const status = typeof input?.status === "string" ? input.status.trim() : "";
  const callbacks = input?.callbacks ?? {};
  const assessment = evaluateAnnouncementDraft(draft);
  const script = draft?.script ?? {};
  const timing = draft?.timing ?? {};
  const archiveStatus = input?.savedArchive?.status ?? "empty";
  const savedDrafts = input?.savedArchive?.archive?.drafts ?? {};
  const savedDates = Object.keys(savedDrafts).sort();
  const savedLibrary = element(documentRef, "section", {
    className: "announcements-details announcements-library",
    attributes: { "aria-labelledby": "announcements-library-heading" }
  }, [
    element(documentRef, "h2", { text: "Saved broadcast dates", attributes: { id: "announcements-library-heading" } }),
    element(documentRef, "p", {
      text: "Prepare a week by choosing a broadcast date, editing the script, and choosing Save local draft for each day. Saving updates only that date. Changing the date edits the current draft; Load opens a saved copy. Saved scripts stay in this browser on this device and do not sync to another phone or computer."
    }),
    archiveStatus === "invalid" || archiveStatus === "unavailable"
      ? element(documentRef, "p", {
          text: archiveStatus === "invalid"
            ? "The saved-script library could not be read and was left untouched. Your current draft remains open."
            : "The saved-script library is unavailable on this device. Your current draft remains open.",
          attributes: { role: "alert" }
        })
      : savedDates.length === 0
        ? element(documentRef, "p", { text: "No dated scripts saved yet." })
        : element(documentRef, "ul", { className: "announcements-saved-dates" }, savedDates.map((date) =>
            element(documentRef, "li", {}, [
              element(documentRef, "span", {
                text: `${date} · ${savedDrafts[date].teacherReview?.approved && evaluateAnnouncementDraft(savedDrafts[date]).reviewReady
                  ? evaluateAnnouncementDraft(savedDrafts[date]).crewReady ? "Teacher approved; crew confirmed" : "Teacher approved; crew check pending"
                  : "Needs teacher review"}`
              }),
              button(documentRef, "Load", "secondary-action", () => callbacks.onLoadSavedDraft?.(date), {
                "aria-label": `Load broadcast ${date}`
              })
            ])
          ))
  ]);

  const details = element(documentRef, "section", {
    className: "announcements-details",
    attributes: { "aria-labelledby": "announcements-details-heading" }
  }, [
    element(documentRef, "h2", {
      text: "Broadcast details",
      attributes: { id: "announcements-details-heading" }
    }),
    textField(documentRef, {
      id: "announcement-date",
      name: "announcement-date",
      label: "Announcement date",
      type: "date",
      value: draft?.date,
      onInput: (value) => callbacks.onDetailChange?.("date", value)
    }),
    textField(documentRef, {
      id: "target-minutes",
      name: "target-minutes",
      label: "Target minutes",
      type: "number",
      value: timing.targetMinutes,
      attributes: { min: "1", max: "15", step: "1", inputmode: "numeric" },
      help: "Choose a short target the crew can rehearse.",
      onInput: (value) => callbacks.onDetailChange?.("targetMinutes", value === "" ? null : Number(value))
    }),
    textField(documentRef, {
      id: "rehearsal-seconds",
      name: "rehearsal-seconds",
      label: "Rehearsal time in seconds",
      type: "number",
      value: timing.rehearsalSeconds,
      attributes: { min: "1", max: "900", step: "1", inputmode: "numeric" },
      help: "Leave this blank until the crew completes a timed read.",
      onInput: (value) => callbacks.onDetailChange?.("rehearsalSeconds", value === "" ? null : Number(value))
    })
  ]);

  const scriptView = element(documentRef, "section", {
    className: "announcements-script",
    attributes: { "aria-labelledby": "announcements-script-heading" }
  }, [
    element(documentRef, "h2", {
      text: "Student-safe script",
      attributes: { id: "announcements-script-heading" }
    }),
    element(documentRef, "p", {
      text: "Use only information approved for the school broadcast. CIRC HQ does not invent pledge wording or school notices."
    }),
    button(documentRef, "Use ECMS outline", "secondary-action", () => callbacks.onUseEcmsOutline?.()),
    element(documentRef, "section", { className: "announcements-prepared" }, [
      element(documentRef, "h3", { text: "Prepared September 9-11 scripts" }),
      element(documentRef, "p", { text: "These prepared school notices are available on this computer without copying email. Load the actual broadcast date, add approved first names, check for office changes and rehearse. Loading does not save over your local dated drafts." }),
      ...PREPARED_ECMS_BROADCASTS.map((item) => button(documentRef, item.label, "secondary-action", () => callbacks.onUsePreparedEcms?.(item.date))),
      draft.date === "2026-09-11" ? element(documentRef, "p", { className: "announcements-teacher-note", text: "Teacher preparation for Friday: reserve about 30 seconds after the Pledge for Tim and Ivan's approved September 11 wording. Replace the marked message, assign its speaker and rehearse the whole script. This instruction is not part of broadcast view." }) : null
    ]),
    element(documentRef, "p", {
      text: "Two announcers: greeting and cycle day, first-name introductions, at least 20 seconds of silence, a separate 5-second handoff pause before Announcer 1 leads the full Pledge, sit, required notices from Heather and Emily, lunch, optional reminder, closing. Resolve every [[placeholder]] before teacher review. Confirm no notices with the office when applicable."
    }),
    element(documentRef, "p", {
      text: "Go live shows the approved script, including speaker labels and pause cues. If you share or mirror that screen, the audience sees the same view. CIRC HQ does not start the building's broadcast equipment."
    }),
    element(documentRef, "p", {
      text: "Crew arrival: 8:50 a.m. latest. Broadcast: 8:55 a.m., with a three-minute target including the opening, silence, Pledge and closing. On Day 4, prepare and finalize all announcements for the following week. Choose the actual broadcast dates; no school rotation or calendar dates are changed automatically."
    }),
    scriptField(documentRef, {
      id: "script-opening",
      name: "script-opening",
      label: "Opening",
      value: script.opening,
      help: "Write the greeting the teacher approved.",
      onInput: (value) => callbacks.onSectionChange?.("opening", value)
    }),
    scriptField(documentRef, {
      id: "script-pledge-school-items",
      name: "script-pledge-school-items",
      label: "Moment of silence, Pledge and required school notices",
      value: script.pledgeSchoolItems,
      help: "Keep Heather's and Emily's required notices immediately after the Pledge and sit cue. Enter only wording approved for the broadcast.",
      onInput: (value) => callbacks.onSectionChange?.("pledgeSchoolItems", value)
    }),
    scriptField(documentRef, {
      id: "script-birthdays-events",
      name: "script-birthdays-events",
      label: "Special events",
      value: script.birthdaysEvents,
      help: "Use confirmed lunch information and special events approved for the broadcast.",
      onInput: (value) => callbacks.onSectionChange?.("birthdaysEvents", value)
    }),
    scriptField(documentRef, {
      id: "script-weather",
      name: "script-weather",
      label: "Optional reminder or weather",
      value: script.weather,
      help: "Enter a checked forecast or leave this section blank.",
      onInput: (value) => callbacks.onSectionChange?.("weather", value)
    }),
    scriptField(documentRef, {
      id: "script-closing",
      name: "script-closing",
      label: "Closing",
      value: script.closing,
      help: "Write the final line the teacher approved.",
      onInput: (value) => callbacks.onSectionChange?.("closing", value)
    })
  ]);

  return element(documentRef, "section", {
    className: "announcements",
    attributes: { "aria-labelledby": "announcements-heading" }
  }, [
    element(documentRef, "header", { className: "announcements-header" }, [
      element(documentRef, "p", { className: "eyebrow", text: "Grade 6 Morning Announcements" }),
      element(documentRef, "h1", {
        text: "Run today's broadcast",
        attributes: { id: "announcements-heading" }
      }),
      element(documentRef, "p", { text: GRADE_SIX_ANNOUNCEMENT_RESPONSIBILITY }),
      element(documentRef, "p", {
        className: "announcements-local-notice",
        text: "This is a local draft on this device. Nothing is uploaded or shared by this screen."
      }),
      button(documentRef, "Open private crew sign-up", "secondary-action", () => callbacks.onOpenCrewSignup?.()),
      button(documentRef, "Open student work area", "primary-action", () => callbacks.onOpenStudentStudio?.()),
      element(documentRef, "p", { text: "Student work area shows only generic reporter, weather and iMovie directions. Project that view while Kenny controls the computer; exit it before using private crew information." })
    ]),
    status ? element(documentRef, "p", {
      className: "announcements-local-status",
      text: status,
      attributes: { role: "status", "aria-live": "polite" }
    }) : null,
    errorsView(documentRef, assessment.errors),
    savedLibrary,
    crewView(documentRef),
    details,
    privateCrewView(documentRef, draft, callbacks),
    scriptView,
    workflowView(documentRef, draft, assessment, callbacks),
    element(documentRef, "div", { className: "announcements-actions" }, [
      button(documentRef, "Save local draft", "primary-action", () => callbacks.onSaveLocalDraft?.()),
      button(documentRef, "Start a blank draft", "secondary-action", () => callbacks.onClearLocalDraft?.()),
      button(
        documentRef,
        "Go live",
        "primary-action announcements-go-live",
        () => callbacks.onGoLive?.(),
        { disabled: !assessment.canGoLive, "aria-disabled": assessment.canGoLive ? "false" : "true" }
      )
    ])
  ]);
}

export function buildAnnouncementsLiveView(input, options = {}) {
  const documentRef = resolveDocument(options);
  const draft = input?.draft;
  if (!evaluateAnnouncementDraft(draft).canGoLive) {
    throw new Error("announcement-live-review-required");
  }
  const sectionLabels = {
    opening: "Opening",
    pledgeSchoolItems: "Moment of silence, Pledge and school notices",
    birthdaysEvents: "Special events",
    weather: "Optional reminder or weather",
    closing: "Closing"
  };
  const scriptSections = Object.entries(sectionLabels)
    .filter(([section]) => draft.script[section].trim() !== "")
    .map(([section, label]) => element(documentRef, "section", {
      className: `announcements-live-section announcements-live-${section}`
    }, [
      element(documentRef, "h2", { text: label }),
      element(documentRef, "p", { text: draft.script[section] })
    ]));

  return element(documentRef, "section", {
    className: "announcements-live",
    attributes: { "data-view": "announcements-live", "aria-labelledby": "announcements-live-heading" }
  }, [
    element(documentRef, "header", { className: "announcements-live-header" }, [
      element(documentRef, "p", { className: "eyebrow", text: draft.date }),
      element(documentRef, "h1", {
        text: "Grade 6 Morning Announcements",
        attributes: { id: "announcements-live-heading" }
      })
    ]),
    element(documentRef, "div", { className: "announcements-live-script" }, scriptSections),
    button(documentRef, "Exit broadcast view", "primary-action announcements-live-exit", input?.onExit)
  ]);
}
