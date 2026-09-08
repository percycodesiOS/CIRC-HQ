import {
  ANNOUNCEMENT_CREW_ROLES,
  ANNOUNCEMENT_WORKFLOW,
  GRADE_SIX_ANNOUNCEMENT_RESPONSIBILITY,
  evaluateAnnouncementDraft
} from "../model/announcements.js";

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
    ? "Teacher approved. The crew is ready to go live."
    : assessment.reviewReady
      ? approved
        ? "Teacher approval is recorded."
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
                text: `${date} · ${evaluateAnnouncementDraft(savedDrafts[date]).canGoLive ? "Teacher approved" : "Needs teacher review"}`
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
      })
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
