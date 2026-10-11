// Handouts and guides. Curriculum only: like the student page, this module
// and everything it imports never read browser storage, a schedule, a class
// list or cloud data. Filters live in memory and in nothing else.
import { PLAYBOOKS, buildStudentLink, getPlaybook } from "./model/playbooks.js";
import { listHandouts, searchHandouts } from "./model/lesson-finder.js";
import { buildIcon, createBuilder } from "./ui/playbook-view.js";

// The four reviewed references already on the site. Page counts were read
// from the files. Status says whether the wording predates the current
// logo-to-jingle lesson; nothing here claims a document was rewritten.
export const GUIDES = Object.freeze([
  {
    title: "Classroom Toolkit",
    file: "assets/guides/CIRC-Classroom-Toolkit.pdf",
    pages: 5,
    audience: "Teacher",
    status: "current",
    statusLabel: "Current",
    note: "Circuit Rescue, the logo-to-jingle companion and the optional NeuroArt finish check."
  },
  {
    title: "Full-year teacher guide",
    file: "assets/guides/CIRC-Teacher-Guide.pdf",
    pages: 158,
    audience: "Teacher",
    status: "older",
    statusLabel: "September 30 wording",
    note: "Teacher prompts, materials, safety, evidence and paper paths for every lesson. Made before the logo-to-jingle update: its meeting 3 still prints the older second-logo lesson, so use the on-screen lesson or the lesson PDF for anything newer. Print only the lesson you need."
  },
  {
    title: "Classroom screen cards",
    file: "assets/guides/CIRC-Classroom-Cards.pdf",
    pages: 731,
    audience: "Projection",
    status: "older",
    statusLabel: "September 30 wording",
    note: "Landscape deck, one large step per page, with bookmarks. Project it from the bookmark you need. It is not meant to be printed. Its meeting 3 also shows the older second-logo lesson."
  },
  {
    title: "ECTV interview and edit handout",
    file: "assets/guides/ECTV-Interview-Edit-Handout.pdf",
    pages: 4,
    audience: "Student",
    status: "current",
    statusLabel: "Current",
    note: "Illustrated morning-show handout: turn your footage into a story."
  }
]);

function readFilters(search) {
  const params = new URLSearchParams(String(search ?? "").replace(/^\?/, ""));
  const grade = Number(params.get("grade"));
  const playbook = params.get("playbook");
  const meeting = Number(params.get("meeting"));
  return {
    grade: grade === 5 || grade === 6 ? grade : null,
    playbook: getPlaybook(playbook) ? playbook : null,
    meeting: Number.isInteger(meeting) && meeting > 0 ? meeting : null,
    query: params.get("q") ?? ""
  };
}

export function renderResourceHub(root, { location = globalThis.location, documentRef = globalThis.document } = {}) {
  const h = createBuilder(documentRef);
  const filters = { format: null, ...readFilters(location?.search) };
  const highlight = filters.playbook && filters.meeting ? { playbook: filters.playbook, meeting: filters.meeting } : null;

  const input = h("input", { attributes: { type: "search", id: "resource-search", placeholder: "Lesson name, unit or keyword", autocomplete: "off" } });
  input.value = filters.query;
  const count = h("p", { className: "student-finder-count", attributes: { "aria-live": "polite" } });
  const listHost = h("ol", { className: "resource-list" });
  const buttons = [];
  const filterButton = (text, isOn, onPress) => {
    const button = h("button", { className: "student-filter", text, attributes: { type: "button", "aria-pressed": String(isOn()) }, onClick: () => { onPress(); refresh(); } });
    buttons.push([button, isOn]);
    return button;
  };
  const formatSelect = h("select", { attributes: { id: "resource-format" } }, [
    h("option", { text: "All formats", attributes: { value: "" } }),
    h("option", { text: "Student handout (PDF)", attributes: { value: "pdf" } }),
    h("option", { text: "Response sheet (Word)", attributes: { value: "docx" } }),
    h("option", { text: "Lessons with a no-device paper path", attributes: { value: "paper" } })
  ]);
  formatSelect.addEventListener("change", () => { filters.format = formatSelect.value || null; refresh(); });

  function fileName(file) { return file.slice(file.lastIndexOf("/") + 1); }

  function placeNumber(entry) {
    const preferred = filters.playbook ? entry.places.find(place => place.playbook === filters.playbook) : null;
    const place = preferred ?? entry.places[0];
    return `${place.playbook.toUpperCase()}${place.meeting}`;
  }

  function item(entry) {
    const place = filters.playbook ? entry.places.find(item => item.playbook === filters.playbook) ?? entry.places[0] : entry.places[0];
    const isNow = highlight
      ? entry.places.some(item => item.playbook === highlight.playbook && item.meeting === highlight.meeting)
      : entry.places.some(item => item.playbook === PLAYBOOKS[0].id && item.meeting === PLAYBOOKS[0].nextMeeting);
    const isDone = entry.places.every(item => item.done);
    const studentHref = buildStudentLink({ playbook: place.playbook, meeting: place.meeting, grade: place.path === "g5" ? 5 : place.path === "g6" ? 6 : filters.grade, option: place.path === "on-track" ? "on-track" : null });
    const showPdf = filters.format !== "docx";
    const showDocx = filters.format !== "pdf" && filters.format !== "paper";
    return h("li", { className: `resource-item${isNow ? " is-now" : ""}${isDone ? " is-done" : ""}` }, [
      h("span", { className: "resource-number", text: placeNumber(entry), attributes: { "aria-hidden": "true" } }),
      h("div", { className: "resource-copy" }, [
        h("strong", { text: entry.title }),
        h("span", { className: "resource-where", text: `${entry.gradeLabel}. ${entry.places.map(item => item.label).join("; ")}.${isNow ? " Up next." : ""}` }),
        h("span", { className: "resource-file", text: `${fileName(entry.files.pdf)} and ${fileName(entry.files.docx)}` }),
        h("div", { className: "resource-actions" }, [
          showPdf ? h("a", { className: "is-primary", attributes: { href: entry.files.pdf, target: "_blank", rel: "noopener", "aria-label": `${entry.title}, student handout PDF` } }, [buildIcon(h, "download"), h("span", { text: "Student PDF" })]) : null,
          showDocx ? h("a", { attributes: { href: entry.files.docx, "aria-label": `${entry.title}, response sheet for Word` } }, [buildIcon(h, "download"), h("span", { text: "Response sheet" })]) : null,
          h("a", { attributes: { href: studentHref, "aria-label": `${entry.title} on the student page` } }, [h("span", { text: "Open on screen" })])
        ])
      ])
    ]);
  }

  function refresh() {
    for (const [button, isOn] of buttons) button.setAttribute("aria-pressed", String(isOn()));
    const entries = searchHandouts({ query: filters.query, grade: filters.grade, playbook: filters.playbook, format: filters.format });
    const total = listHandouts().length;
    const scope = [filters.playbook ? getPlaybook(filters.playbook).name : "both playbooks", filters.grade ? `grade ${filters.grade}` : "grades 5 and 6"].join(", ");
    count.textContent = `${entries.length === total ? total : `${entries.length} of ${total}`} lessons, ${scope}. Files open in a new tab.`;
    listHost.replaceChildren(...(entries.length ? entries.map(item) : [h("li", { className: "student-finder-empty", text: "No lesson matches that. Try fewer words or clear a filter." })]));
  }
  input.addEventListener("input", () => { filters.query = input.value; refresh(); });

  const filterForm = h("form", { className: "resource-filters", attributes: { "aria-label": "Filter the handouts" } }, [
    h("label", { className: "student-search", attributes: { for: "resource-search" } }, [buildIcon(h, "search"), h("span", { className: "visually-hidden", text: "Search handouts" }), input]),
    h("fieldset", {}, [
      h("legend", { text: "Grade" }),
      h("div", { className: "student-filters" }, [
        filterButton("Grade 5", () => filters.grade === 5, () => { filters.grade = filters.grade === 5 ? null : 5; }),
        filterButton("Grade 6", () => filters.grade === 6, () => { filters.grade = filters.grade === 6 ? null : 6; })
      ])
    ]),
    h("fieldset", {}, [
      h("legend", { text: "Playbook" }),
      h("div", { className: "student-filters" }, PLAYBOOKS.map(playbook =>
        filterButton(`${playbook.name}, ${playbook.status.toLowerCase()}`, () => filters.playbook === playbook.id, () => { filters.playbook = filters.playbook === playbook.id ? null : playbook.id; })))
    ]),
    h("label", { text: "Format", attributes: { for: "resource-format" } }, [formatSelect])
  ]);
  filterForm.addEventListener("submit", event => event?.preventDefault?.());

  const guides = h("aside", { className: "resource-guides", attributes: { "aria-labelledby": "resource-guides-title" } }, [
    h("h2", { text: "Teacher references", attributes: { id: "resource-guides-title" } }),
    ...GUIDES.map(guide => h("article", { className: "resource-guide" }, [
      h("div", { className: "resource-guide-head" }, [
        h("strong", { text: guide.title }),
        h("span", { className: `resource-status is-${guide.status}`, text: guide.statusLabel })
      ]),
      h("p", { text: `${guide.audience}. ${guide.pages} pages. ${guide.note}` }),
      h("a", { text: fileName(guide.file), attributes: { href: guide.file, target: "_blank", rel: "noopener" } })
    ])),
    h("p", { className: "resource-private", text: "Teacher-only assessment notes, exemplar reasoning and answer keys are not on this site. They stay in the private teacher package." })
  ]);

  refresh();
  root.replaceChildren(
    h("div", { className: "student-page-wide" }, [
      h("div", { className: "page-heading" }, [
        h("p", { className: "eyebrow", text: "CIRC HQ | Grades 5 and 6" }),
        h("h1", { text: "Handouts and guides", attributes: { id: "resource-title", tabindex: "-1" } }),
        h("p", { className: "resource-lead", text: "Every lesson is one small PDF with real text, headings and page numbers, plus a Word response sheet students can type in. Pick a grade and playbook, then download only the lesson you need. Nothing here is a whole-year deck." })
      ]),
      filterForm,
      h("div", { className: "resource-layout" }, [
        h("section", { attributes: { "aria-labelledby": "resource-list-title" } }, [
          h("div", { className: "resource-list-head" }, [
            h("h2", { text: "Lesson handouts", attributes: { id: "resource-list-title" } }),
            count
          ]),
          listHost,
          h("p", { className: "resource-note", text: "One file pattern: CIRC, the lesson name, then Student (PDF) or Response (Word). The number shows where the lesson sits in the chosen playbook." })
        ]),
        guides
      ])
    ])
  );
  return { refresh };
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  const root = document.getElementById("resource-main");
  if (root) renderResourceHub(root);
}
