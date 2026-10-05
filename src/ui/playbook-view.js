// Lesson and playbook views shared by the student page and the teacher side.
// Student views receive curriculum data only. Teacher-only sections are added
// when audience is "teacher" and never read a schedule themselves.
import {
  DESIGN_STAGES,
  FOUR_CS,
  PLAYBOOKS,
  STRANDS,
  getPlaybook,
  lessonTitleForRef,
  listMeetings,
  meetingTitle,
  pathLabel
} from "../model/playbooks.js";
import { runnerStepIconFile } from "./step-icons.js";

export function createBuilder(documentRef = globalThis.document) {
  if (!documentRef?.createElement) throw new Error("playbook-view-document-required");
  return function h(tag, options = {}, children = []) {
    const node = documentRef.createElement(tag);
    if (options.className) node.className = options.className;
    if (options.text !== undefined) node.textContent = String(options.text);
    for (const [name, value] of Object.entries(options.attributes ?? {})) {
      if (value !== null && value !== undefined && value !== false) node.setAttribute(name, String(value));
    }
    for (const child of Array.isArray(children) ? children : [children]) if (child) node.append(child);
    if (typeof options.onClick === "function") node.addEventListener("click", options.onClick);
    return node;
  };
}

function list(h, items, className = "plain-list", ordered = false) {
  return h(ordered ? "ol" : "ul", { className }, items.filter(Boolean).map(item => h("li", { text: item })));
}

function strandChips(h, lesson) {
  const chips = lesson.strands.map(id => STRANDS.find(strand => strand.id === id)).filter(Boolean).map(strand =>
    h("li", { className: `pb-chip pb-strand-${strand.id}` }, [
      h("img", { attributes: { src: strand.icon, alt: "", width: "22", height: "22" } }),
      h("span", { text: strand.short })
    ]));
  return chips.length ? h("ul", { className: "pb-chips", attributes: { "aria-label": "Learning strands" } }, chips) : null;
}

function stageBar(h, lesson) {
  if (!lesson.stages.length) return null;
  return h("ol", { className: "pb-stages", attributes: { "aria-label": "Design process: " + lesson.stages.map(id => DESIGN_STAGES.find(stage => stage.id === id)?.label).join(", ") } },
    DESIGN_STAGES.map(stage => h("li", {
      className: lesson.stages.includes(stage.id) ? "pb-stage is-on" : "pb-stage",
      text: stage.label,
      attributes: { "aria-hidden": "true" }
    })));
}

function stepCards(h, lesson, audience) {
  let elapsed = 0;
  return h("ol", { className: "pb-steps" }, lesson.steps.map((step, index) => {
    const start = elapsed;
    elapsed += step.minutes;
    return h("li", { className: `pb-step pb-step-${step.kind}` }, [
      h("div", { className: "pb-step-head" }, [
        h("span", { className: "pb-step-number", text: String(index + 1), attributes: { "aria-hidden": "true" } }),
        h("img", { className: "pb-step-icon", attributes: { src: `assets/icons/${runnerStepIconFile({ ...step, label: String(step.label).toUpperCase() })}.svg`, alt: "", width: "34", height: "34" } }),
        h("h4", { text: step.label }),
        h("span", { className: "pb-step-time", text: `${step.minutes} min`, attributes: { title: `Minutes ${start} to ${elapsed}` } })
      ]),
      list(h, step.directions, "pb-step-directions"),
      audience === "teacher" && step.teacherDirections.length
        ? h("details", { className: "pb-teacher-step" }, [h("summary", { text: "Teacher moves" }), list(h, step.teacherDirections)])
        : null
    ]);
  }));
}

function callout(h, className, title, body) {
  if (!body || (Array.isArray(body) && !body.length)) return null;
  return h("section", { className: `pb-callout ${className}` }, [
    h("h3", { text: title }),
    Array.isArray(body) ? list(h, body) : h("p", { text: body })
  ]);
}

function adaptations(h, lesson, audience, grade) {
  const adapt = lesson.adapt;
  if (adapt.grade5 !== undefined) {
    if (audience === "student") {
      if (grade === 5) return callout(h, "pb-grade", "Grade 5 goal", adapt.grade5);
      if (grade === 6) return callout(h, "pb-grade", "Grade 6 goal", adapt.grade6);
      return null;
    }
    return h("section", { className: "pb-callout pb-grade" }, [
      h("h3", { text: "Grades 5 and 6" }),
      h("dl", { className: "pb-pairs" }, [h("dt", { text: "Grade 5" }), h("dd", { text: adapt.grade5 }), h("dt", { text: "Grade 6" }), h("dd", { text: adapt.grade6 })])
    ]);
  }
  if (audience !== "teacher") return null;
  return h("section", { className: "pb-callout pb-grade" }, [
    h("h3", { text: "Support and stretch" }),
    h("dl", { className: "pb-pairs" }, [h("dt", { text: "More support" }), h("dd", { text: adapt.support }), h("dt", { text: "More challenge" }), h("dd", { text: adapt.stretch })])
  ]);
}

// A complete no-device path with visibly labeled practice data.
function paperPathSection(h, path) {
  if (!path) return null;
  const table = h("table", { className: "pb-practice-table" }, [
    h("caption", { text: path.data.label }),
    h("thead", {}, [h("tr", {}, path.data.columns.map(column => h("th", { text: column, attributes: { scope: "col" } })))]),
    h("tbody", {}, path.data.rows.map(row => h("tr", {}, row.map((cell, index) => h(index === 0 ? "th" : "td", { text: cell, attributes: index === 0 ? { scope: "row" } : {} })))))
  ]);
  return h("section", { className: "pb-callout pb-paper-path", attributes: { "aria-labelledby": "pb-paper-title" } }, [
    h("h3", { text: "No-fan paper path", attributes: { id: "pb-paper-title" } }),
    h("p", { className: "pb-paper-note", text: path.note }),
    h("p", {}, [h("strong", { text: "Goal: " }), h("span", { text: path.goal })]),
    list(h, path.directions, "pb-step-directions", true),
    h("p", {}, [h("strong", { text: "Keep: " }), h("span", { text: path.evidence })]),
    h("p", { className: "pb-practice-label", text: path.data.label }),
    h("p", { className: "th-quiet", text: `Unit: ${path.data.unit}` }),
    table
  ]);
}

// resolved comes from resolveMeeting(). actions: onChoosePath(pathId), onStart(), studentHref
export function buildLessonCard(resolved, { audience = "student", grade = null, actions = {}, documentRef, headingLevel = "h2" } = {}) {
  const h = createBuilder(documentRef);
  const { playbook, meeting, lesson } = resolved;
  const kicker = `${playbook.name} | Meeting ${meeting.number}${meeting.season ? " | " + meeting.season : ""}`;
  const pathNote = resolved.path && resolved.path !== "both" ? pathLabel(resolved.path) : "";
  if (!lesson) {
    return h("article", { className: "pb-lesson pb-lesson-choose", attributes: { "aria-labelledby": "pb-lesson-title" } }, [
      h("p", { className: "eyebrow", text: kicker }),
      h(headingLevel, { text: meetingTitle(meeting), attributes: { id: "pb-lesson-title", tabindex: "-1" } }),
      h("p", { text: meeting.kind === "lesson" ? "Grades 5 and 6 do different lessons at this meeting. Which grade are you in?" : "Choose the lesson your teacher picked." }),
      h("div", { className: "pb-choice-row" }, resolved.choices.map(choice => h("button", {
        className: "primary-action pb-choice",
        text: `${choice.label}: ${choice.title}`,
        attributes: { type: "button" },
        onClick: () => actions.onChoosePath?.(choice.id)
      })))
    ]);
  }
  const doneNote = meeting.done ? h("p", { className: "pb-done", text: "Finished this year. Use it only for a class that missed it." }) : null;
  const teacherActions = audience === "teacher" ? h("div", { className: "pb-actions" }, [
    actions.onStart ? h("button", { className: "primary-action", text: "Start this lesson", attributes: { type: "button" }, onClick: actions.onStart }) : null,
    actions.studentHref ? h("a", { className: "secondary-action", text: "Open student page", attributes: { href: actions.studentHref, target: "_blank", rel: "noopener" } }) : null
  ]) : null;
  const choiceSwitch = resolved.choices.length > 1 && (audience === "teacher" || meeting.kind !== "lesson") ? h("div", { className: "pb-choice-row pb-choice-small", attributes: { role: "group", "aria-label": "Choose the lesson path" } },
    resolved.choices.map(choice => h("button", {
      className: choice.id === resolved.path ? "secondary-action is-selected" : "secondary-action",
      text: `${choice.label}: ${choice.title}`,
      attributes: { type: "button", "aria-pressed": String(choice.id === resolved.path) },
      onClick: () => actions.onChoosePath?.(choice.id)
    }))) : null;

  return h("article", { className: `pb-lesson pb-audience-${audience}`, attributes: { "aria-labelledby": "pb-lesson-title" } }, [
    h("header", { className: "pb-lesson-head" }, [
      h("p", { className: "eyebrow", text: pathNote ? `${kicker} | ${pathNote}` : kicker }),
      h(headingLevel, { text: lesson.title, attributes: { id: "pb-lesson-title", tabindex: "-1" } }),
      h("p", { className: "pb-goal" }, [h("strong", { text: "Goal: " }), h("span", { text: lesson.goal })]),
      doneNote,
      h("div", { className: "pb-tags" }, [strandChips(h, lesson), stageBar(h, lesson)]),
      audience === "teacher" && meeting.note ? h("p", { className: "pb-meeting-note", text: meeting.note }) : null,
      choiceSwitch,
      teacherActions
    ]),
    audience === "teacher" && lesson.prepRequired ? h("section", { className: "pb-callout pb-prep-required", attributes: { role: "note" } }, [
      h("h3", { text: "Preparation required" }),
      h("p", { text: lesson.prepRequired })
    ]) : null,
    audience === "teacher" ? h("div", { className: "pb-prep-grid" }, [
      callout(h, "pb-prep", "Before class", lesson.prep),
      callout(h, "pb-materials", "Materials", lesson.materials)
    ]) : callout(h, "pb-materials", "You will use", lesson.materials),
    lesson.resources?.some(resource => audience === "teacher" || !resource.teacherOnly) ? h("section", { className: "pb-callout pb-resources" }, [
      h("h3", { text: "Lesson resources" }),
      h("ul", { className: "plain-list" }, lesson.resources.filter(resource => audience === "teacher" || !resource.teacherOnly).map(resource => h("li", {}, [
        h("a", { text: resource.label, attributes: { href: resource.url, target: "_blank", rel: "noopener noreferrer" } }),
        h("p", { text: resource.description })
      ])))
    ]) : null,
    h("section", { className: "pb-steps-section" }, [
      h("h3", { text: `Steps | ${lesson.minutes} minutes` }),
      stepCards(h, lesson, audience)
    ]),
    h("div", { className: "pb-finish-grid" }, [
      callout(h, "pb-turnin", "What to turn in", lesson.turnIn),
      callout(h, "pb-success", "You are done when", lesson.success),
      callout(h, "pb-extension", "Next challenge (optional)", lesson.extension),
      callout(h, "pb-fallback", "Another way to do it", lesson.fallback)
    ]),
    paperPathSection(h, lesson.paperPath),
    adaptations(h, lesson, audience, grade),
    callout(h, "pb-safety", "Stay safe", lesson.safety),
    audience === "teacher" ? callout(h, "pb-cleanup", "Cleanup", lesson.cleanup) : null,
    audience === "teacher" ? h("section", { className: "pb-callout pb-fourcs" }, [
      h("h3", { text: "Four Cs" }),
      h("p", { text: lesson.fourCs.map(id => FOUR_CS.find(item => item.id === id)?.label).filter(Boolean).join(", ") })
    ]) : null,
    audience === "teacher" && lesson.teacherNotes.length ? h("details", { className: "pb-teacher-notes" }, [
      h("summary", { text: "Teacher notes" }),
      list(h, lesson.teacherNotes)
    ]) : null
  ]);
}

// A compact list of every meeting in one playbook.
export function buildPlaybookBrowser(playbookId, { audience = "student", selected = null, onOpenMeeting, onSwitchPlaybook, documentRef } = {}) {
  const h = createBuilder(documentRef);
  const playbook = getPlaybook(playbookId) ?? PLAYBOOKS[0];
  const tabs = h("div", { className: "pb-tabs", attributes: { role: "group", "aria-label": "Choose a playbook" } }, PLAYBOOKS.map(item => h("button", {
    className: item.id === playbook.id ? "pb-tab is-selected" : "pb-tab",
    attributes: { type: "button", "aria-pressed": String(item.id === playbook.id) },
    onClick: () => onSwitchPlaybook?.(item.id)
  }, [h("strong", { text: item.name }), h("span", { text: `${item.year} | ${item.status}` })])));
  const units = playbook.units.map(item => h("section", { className: "pb-unit" }, [
    h("h4", { className: "pb-unit-title" }, [h("span", { text: item.title }), h("small", { text: item.season })]),
    h("ol", { className: "pb-meeting-list", attributes: { start: String(item.meetings[0].number) } }, item.meetings.map(meeting => {
      const split = !meeting.paths.both && meeting.kind === "lesson";
      const label = split
        ? [h("span", { className: "pb-meeting-split" }, [h("span", { text: "Grade 5: " + lessonTitleForRef(meeting.paths.g5) }), h("span", { text: "Grade 6: " + lessonTitleForRef(meeting.paths.g6) })])]
        : [h("span", { text: meetingTitle(meeting) })];
      return h("li", { className: "pb-meeting-item" }, [
        h("button", {
          className: selected === meeting.number ? "pb-meeting is-selected" : "pb-meeting",
          attributes: { type: "button", "aria-current": selected === meeting.number ? "true" : null, "aria-label": `Meeting ${meeting.number}: ${meetingTitle(meeting)}${meeting.done ? ", finished" : ""}` },
          onClick: () => onOpenMeeting?.(playbook.id, meeting.number)
        }, [
          h("span", { className: "pb-meeting-number", text: String(meeting.number), attributes: { "aria-hidden": "true" } }),
          h("span", { className: "pb-meeting-text" }, label),
          meeting.done ? h("span", { className: "pb-badge", text: "Done", attributes: { "aria-hidden": "true" } }) : null,
          meeting.kind !== "lesson" ? h("span", { className: "pb-badge pb-badge-flex", text: meeting.kind === "flex" ? "Flex" : "Buffer", attributes: { "aria-hidden": "true" } }) : null
        ])
      ]);
    }))
  ]));
  return h("section", { className: "pb-browser", attributes: { "aria-label": `${playbook.name} meetings` } }, [
    tabs,
    h("p", { className: "pb-summary", text: playbook.summary }),
    audience === "teacher" ? h("details", { className: "pb-capacity" }, [
      h("summary", { text: "How this year fits" }),
      h("p", { text: playbook.capacity }),
      h("p", { text: playbook.balance }),
      h("p", { text: "The four strands, the Four Cs and Ask, Plan, Build, Test, Improve come from the CIRC K-6 Learning Continuum working draft. It is flexible guidance informed by PA STEELS, not a required course sequence. No formal standards alignment is claimed." })
    ]) : null,
    ...units
  ]);
}

export function totalMeetings(playbookId) { return listMeetings(playbookId).length; }
