// Student side. Curriculum only: this module and everything it imports never
// read browser storage, a teacher schedule, a class list or cloud data. The
// page state lives in the link itself (student.html?playbook=a&meeting=12&grade=5),
// so a bookmark or reload shows the same lesson. This is a separate screen,
// not a login or a security boundary.
import { PLAYBOOKS, STRANDS, buildStudentLink, currentWeekLesson, getMeeting, getPlaybook, listMeetings, meetingTitle, parseStudentLink, resolveMeeting, resolveSupplementalLesson } from "./model/playbooks.js";
import { findMeetings, handoutForRef } from "./model/lesson-finder.js";
import { buildCurrentWeekEntry, buildIcon, buildLessonCard, buildPlaybookBrowser, buildSupplementalLibrary, createBuilder } from "./ui/playbook-view.js";

export function renderStudentPage(root, {
  location = globalThis.location,
  history = globalThis.history,
  documentRef = globalThis.document,
  scrollTo = globalThis.scrollTo,
  print = globalThis.print,
  now = () => new Date()
} = {}) {
  const h = createBuilder(documentRef);
  // Finder state stays in memory only. It is never written anywhere.
  const finder = { playbook: null, grade: null, query: "", paperOnly: false };

  function current() {
    return parseStudentLink(location?.search ?? "");
  }

  function go(params) {
    const link = buildStudentLink(params, "");
    if (typeof history?.pushState === "function") history.pushState(null, "", link || "?");
    else location.search = link;
    const parsed = parseStudentLink(link);
    finder.playbook = parsed.playbook ?? finder.playbook;
    if (parsed.grade) finder.grade = parsed.grade;
    render({ focus: true });
  }

  // A real link for bookmarks and new tabs; a click stays on the page.
  function navLink(text, params, className) {
    return h("a", {
      className,
      text,
      attributes: { href: buildStudentLink(params) },
      onClick: event => { event?.preventDefault?.(); go(params); }
    });
  }

  function strandChips(ids) {
    const chips = ids.map(id => STRANDS.find(strand => strand.id === id)).filter(Boolean).map(strand =>
      h("li", { className: `pb-chip pb-strand-${strand.id}` }, [
        h("img", { attributes: { src: strand.icon, alt: "", width: "22", height: "22" } }),
        h("span", { text: strand.short })
      ]));
    return chips.length ? h("ul", { className: "pb-chips", attributes: { "aria-label": "Learning strands" } }, chips) : null;
  }

  // This year's next meeting, with one tap per grade to open the steps.
  function todayHero() {
    const playbook = PLAYBOOKS[0];
    const number = playbook.nextMeeting;
    const meeting = getMeeting(playbook.id, number);
    const resolved = resolveMeeting(playbook.id, number, {});
    const lesson = resolved.lesson;
    const total = listMeetings(playbook.id).length;
    const strands = lesson ? lesson.strands : [...new Set(resolved.choices.flatMap(choice => resolveMeeting(playbook.id, number, { grade: choice.id === "g5" ? 5 : 6 }).lesson?.strands ?? []))];
    return h("section", { className: "student-today-hero", attributes: { "aria-labelledby": "student-welcome-title" } }, [
      h("p", { className: "eyebrow", text: `${playbook.name}, ${playbook.status.toLowerCase()}` }),
      h("h1", { text: "What are we doing today?", attributes: { id: "student-welcome-title", tabindex: "-1" } }),
      h("article", { className: "student-today-card" }, [
        h("div", { className: "student-today-meta" }, [
          strandChips(strands),
          h("span", { className: "student-meeting-count", text: `Meeting ${number} of ${total}` })
        ]),
        h("h2", { text: lesson ? lesson.title : meetingTitle(meeting) }),
        lesson
          ? h("p", { className: "pb-goal" }, [h("strong", { text: "Goal: " }), h("span", { text: lesson.goal })])
          : h("p", { className: "student-today-split", text: "Grades 5 and 6 do different lessons at this meeting. Your grade button opens yours." }),
        h("div", { className: "student-facts" }, lesson
          ? [h("span", { text: `${lesson.minutes} minutes` }), h("span", { text: `${lesson.steps.length} steps` })]
          : [h("span", { text: "35 minutes" }), h("span", { text: "One lesson per grade" })]),
        h("p", { className: "student-grade-prompt", text: "Tap your grade to open the steps." }),
        h("div", { className: "student-grade-buttons" }, [5, 6].map(grade =>
          navLink(`Grade ${grade}`, { playbook: playbook.id, meeting: number, grade }, "student-grade-button")))
      ])
    ]);
  }

  // The teacher wrote a different meeting number on the board.
  function numberForm(link) {
    const playbookSelect = h("select", { attributes: { id: "student-playbook" } }, PLAYBOOKS.map(item => h("option", { text: `${item.name} (${item.year})`, attributes: { value: item.id } })));
    playbookSelect.value = link.playbook ?? PLAYBOOKS[0].id;
    const meetingInput = h("input", { attributes: { id: "student-meeting", type: "number", inputmode: "numeric", min: "1", max: String(listMeetings(playbookSelect.value).length) } });
    meetingInput.value = String(link.meeting ?? getPlaybook(playbookSelect.value).nextMeeting);
    playbookSelect.addEventListener("change", () => {
      meetingInput.setAttribute("max", String(listMeetings(playbookSelect.value).length));
      meetingInput.value = String(getPlaybook(playbookSelect.value).nextMeeting);
    });
    const problem = h("p", { className: "student-finder-empty", attributes: { role: "alert", hidden: "" } });
    const form = h("form", { className: "student-number-form", attributes: { "aria-label": "Open a meeting by number", novalidate: "" } }, [
      h("label", { text: "Playbook", attributes: { for: "student-playbook" } }, [playbookSelect]),
      h("label", { text: "Meeting number", attributes: { for: "student-meeting" } }, [meetingInput]),
      h("button", { text: "Open", attributes: { type: "submit" } })
    ]);
    form.addEventListener("submit", event => {
      event?.preventDefault?.();
      const playbook = playbookSelect.value;
      const meeting = Number(meetingInput.value);
      if (getMeeting(playbook, meeting)) {
        go({ playbook, meeting, grade: finder.grade ?? link.grade ?? null });
        return;
      }
      problem.textContent = `Pick a meeting number from 1 to ${listMeetings(playbook).length}.`;
      problem.removeAttribute?.("hidden");
    });
    return h("section", { className: "student-number", attributes: { "aria-labelledby": "student-number-title" } }, [
      h("h2", { text: "Teacher wrote a different number on the board?", attributes: { id: "student-number-title" } }),
      form,
      problem
    ]);
  }

  // Search and filters over one playbook. Re-renders only the list so the
  // search box keeps focus while a student types.
  function finderSection(link, { id = "browse" } = {}) {
    if (finder.playbook === null) finder.playbook = link.playbook ?? PLAYBOOKS[0].id;
    if (finder.grade === null && link.grade) finder.grade = link.grade;
    const input = h("input", { attributes: { type: "search", id: "student-search", placeholder: "Search: Tinkercad, KidWind, paper", autocomplete: "off" } });
    input.value = finder.query;
    const search = h("label", { className: "student-search", attributes: { for: "student-search" } }, [
      buildIcon(h, "search"),
      h("span", { className: "visually-hidden", text: "Search lessons" }),
      input
    ]);
    const count = h("p", { className: "student-finder-count", attributes: { "aria-live": "polite" } });
    const listHost = h("div", { className: "student-finder-list" });
    const buttons = [];
    const filterButton = (text, isOn, onPress, extraClass = "") => {
      const button = h("button", { className: `student-filter ${extraClass}`.trim(), text, attributes: { type: "button", "aria-pressed": String(isOn()) }, onClick: () => { onPress(); refresh(); } });
      buttons.push([button, isOn]);
      return button;
    };
    const filters = h("div", { className: "student-filters", attributes: { role: "group", "aria-label": "Filters" } }, [
      filterButton("Grade 5", () => finder.grade === 5, () => { finder.grade = finder.grade === 5 ? null : 5; }),
      filterButton("Grade 6", () => finder.grade === 6, () => { finder.grade = finder.grade === 6 ? null : 6; }),
      ...PLAYBOOKS.map(item => filterButton(`${item.name}`, () => finder.playbook === item.id, () => { finder.playbook = item.id; }, "pb-tab")),
      filterButton("Paper only", () => finder.paperOnly, () => { finder.paperOnly = !finder.paperOnly; })
    ]);
    function refresh() {
      for (const [button, isOn] of buttons) button.setAttribute("aria-pressed", String(isOn()));
      const items = findMeetings(finder.playbook, { query: finder.query, grade: finder.grade, paperOnly: finder.paperOnly });
      const playbook = getPlaybook(finder.playbook);
      const total = listMeetings(finder.playbook).length;
      const gradeNote = finder.grade ? `Grade ${finder.grade} path shown.` : "Both grade paths shown.";
      count.textContent = `${items.length === total ? total : `${items.length} of ${total}`} meetings in ${playbook.name} (${playbook.year}). ${gradeNote}`;
      listHost.replaceChildren(buildPlaybookBrowser(finder.playbook, {
        audience: "student",
        selected: link.playbook === finder.playbook ? link.meeting : null,
        documentRef,
        items,
        grade: finder.grade,
        showTabs: false,
        onOpenMeeting: (playbookId, number) => go({ playbook: playbookId, meeting: number, grade: finder.grade ?? link.grade ?? null })
      }));
    }
    input.addEventListener("input", () => { finder.query = input.value; refresh(); });
    refresh();
    return h("section", { className: "student-finder", attributes: { ...(id ? { id } : {}), "aria-labelledby": "student-browse-title" } }, [
      h("h2", { text: "Find any lesson", attributes: { id: "student-browse-title" } }),
      h("p", { className: "th-quiet", text: "Playbook A is this year. Playbook B is next year. Tap a meeting to see its steps." }),
      search,
      filters,
      count,
      listHost
    ]);
  }

  function gradeSwitch(link) {
    return h("div", { className: "student-grade-switch", attributes: { role: "group", "aria-label": "Your grade" } }, [
      h("span", { text: "Your grade:" }),
      ...[5, 6].map(grade => h("button", {
        className: link.grade === grade ? "secondary-action is-selected" : "secondary-action",
        text: `Grade ${grade}`,
        attributes: { type: "button", "aria-pressed": String(link.grade === grade) },
        onClick: () => go({ ...link, grade })
      })),
      h("button", {
        className: "button-link",
        text: link.lesson ? "Pick a different lesson" : "Pick a different meeting",
        attributes: { type: "button" },
        onClick: () => go({ playbook: link.playbook, grade: link.grade })
      })
    ]);
  }

  function render({ focus = false } = {}) {
    const link = current();
    const hasSelectedLesson = Boolean(link.lesson || (link.playbook && link.meeting));
    let page;
    if (hasSelectedLesson) {
      const resolved = link.lesson ? resolveSupplementalLesson(link.lesson) : resolveMeeting(link.playbook, link.meeting, { grade: link.grade, option: link.option });
      const handout = resolved.lesson ? handoutForRef(resolved.lesson.ref) : null;
      const card = buildLessonCard(resolved, {
        audience: "student",
        grade: link.grade,
        documentRef,
        headingLevel: "h1",
        actions: {
          onChoosePath: pathId => {
            if (pathId === "g5" || pathId === "g6") go({ ...link, grade: pathId === "g5" ? 5 : 6 });
            else go({ ...link, option: pathId === "on-track" ? "on-track" : null });
          },
          handoutHref: handout?.files.pdf ?? null,
          onPrint: typeof print === "function" ? () => print() : null
        }
      });
      page = h("div", { className: "student-page" }, [
        h("div", { className: "student-today" }, [
          resolved.meeting.paths.both || link.grade ? gradeSwitch(link) : null,
          resolved.lesson ? h("section", { className: "pb-callout student-start-here", attributes: { "aria-label": "How to do today's task" } }, [
            h("h2", { text: "Start here" }),
            h("p", {}, [h("strong", { text: `${resolved.lesson.steps[0].label}: ` }), h("span", { text: resolved.lesson.steps[0].directions[0] })]),
            h("p", { text: "Follow the numbered steps below with your class. Show the work listed under What to turn in before starting an optional challenge." }),
            h("p", { text: "This page gives directions; it does not save or collect your work." })
          ]) : null,
          card
        ]),
        // Other lessons stay collapsed so a student stays on today's task
        // unless the teacher asks for a different one.
        h("details", { className: "student-more-lessons", attributes: { id: "browse" } }, [
          h("summary", { text: "Other lessons - open only when your teacher asks" }),
          finderSection(link, { id: null }),
          buildSupplementalLibrary({ documentRef }),
          h("a", { className: "secondary-action", text: "Connect the dots: Ethernet lab", attributes: { href: "network-lab.html" } })
        ])
      ]);
    } else {
      const week = currentWeekLesson(now());
      const currentEntry = week ? buildCurrentWeekEntry(week, { documentRef, onOpenLesson: lesson => go({ lesson, grade: link.grade }) }) : null;
      page = h("div", { className: "student-page" }, [
        currentEntry,
        todayHero(),
        numberForm(link),
        finderSection(link, { id: "browse" }),
        buildSupplementalLibrary({ documentRef }),
        h("a", { className: "secondary-action", text: "Connect the dots: Ethernet lab", attributes: { href: "network-lab.html" } })
      ].filter(Boolean));
    }
    root.replaceChildren(page);
    if (focus) {
      scrollTo?.(0, 0);
      root.querySelector?.("#pb-lesson-title, #student-welcome-title")?.focus?.({ preventScroll: true });
    }
  }

  render();
  return { render };
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  const root = document.getElementById("student-main");
  if (root) {
    const page = renderStudentPage(root);
    window.addEventListener("popstate", () => page.render({ focus: true }));
  }
}
