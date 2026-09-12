function asText(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return String(value);
  return "";
}

function escapeHtml(value) {
  return asText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("=", "&#61;");
}

function textList(value) {
  if (Array.isArray(value)) {
    return value.map(asText).filter(Boolean);
  }
  const item = asText(value);
  return item ? [item] : [];
}

function listMarkup(value) {
  const items = textList(value);
  if (items.length === 0) return '<p class="empty">Not specified</p>';
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function standardGroupLabel(key) {
  if (/^grade\s*5$/i.test(key)) return "Grade 5";
  if (/^grade\s*6$/i.test(key)) return "Grade 6";
  return key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function standardsMarkup(standards) {
  if (Array.isArray(standards) || typeof standards === "string") {
    return listMarkup(standards);
  }
  if (!standards || typeof standards !== "object") {
    return '<p class="empty">Not specified</p>';
  }

  const groups = Object.entries(standards)
    .map(([key, values]) => ({
      label: standardGroupLabel(key),
      values: textList(values)
    }))
    .filter((group) => group.values.length > 0);

  if (groups.length === 0) return '<p class="empty">Not specified</p>';
  return groups.map((group) => `
    <div class="standards-group">
      <h3>${escapeHtml(group.label)}</h3>
      ${listMarkup(group.values)}
    </div>`).join("");
}

function section(title, body, className = "") {
  const classAttribute = className ? ` class="${className}"` : "";
  return `<section${classAttribute}><h2>${title}</h2>${body}</section>`;
}

export function buildAdminPlanDocument(project = {}) {
  const number = escapeHtml(project.number);
  const title = escapeHtml(project.title);
  const documentTitle = `Project ${number}: ${title}`;
  const objective = escapeHtml(project.objective);
  const safety = escapeHtml(project.safety);
  const cleanup = escapeHtml(project.cleanup);
  const exitEvidence = escapeHtml(project.exitEvidence);
  const duration = escapeHtml(project.admin?.duration ?? project.duration);
  const standards = project.admin?.standards ?? project.standards;
  const standardsTitle = escapeHtml(
    project.admin?.standardsTitle ?? "Standards crosswalk"
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${documentTitle}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111111;
      background: #ffffff;
      font-family: "Aptos", "Segoe UI", system-ui, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
    }
    main { width: min(8.25in, calc(100% - 32px)); margin: 0 auto; padding: 32px 0; }
    header { border-bottom: 4px solid #1f6fb2; padding-bottom: 16px; margin-bottom: 22px; }
    .eyebrow { margin: 0 0 5px; color: #245f8f; font-size: 10pt; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 25pt; line-height: 1.08; }
    .duration { margin: 8px 0 0; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    section { break-inside: avoid; margin: 0 0 16px; padding: 15px; border: 1px solid #b9c8d4; border-radius: 8px; }
    section.wide { grid-column: 1 / -1; }
    h2 { margin: 0 0 8px; color: #1d5f93; font-size: 12pt; text-transform: uppercase; letter-spacing: 0.04em; }
    h3 { margin: 10px 0 4px; font-size: 10.5pt; }
    p { margin: 0; }
    ul { margin: 0; padding-left: 20px; }
    li + li { margin-top: 5px; }
    .empty { color: #5d6770; font-style: italic; }
    @page { size: letter; margin: 0.5in; }
    @media print {
      main { width: auto; margin: 0; padding: 0; }
      section { box-shadow: none; }
    }
    @media (max-width: 680px) {
      .grid { grid-template-columns: 1fr; }
      section.wide { grid-column: auto; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">Project ${number}</p>
      <h1>${title}</h1>
      <p class="duration">Duration: ${duration}</p>
    </header>
    <div class="grid">
      ${section("Objective", `<p>${objective}</p>`, "wide")}
      ${section("Teacher say", listMarkup(project.teacherSay))}
      ${section("Teacher do", listMarkup(project.teacherDo))}
      ${section("Student steps", listMarkup(project.studentSteps), "wide")}
      ${section("Materials", listMarkup(project.materials))}
      ${section("Safety", `<p>${safety}</p>`)}
      ${section("Cleanup", `<p>${cleanup}</p>`)}
      ${section("Exit evidence", `<p>${exitEvidence}</p>`)}
      ${section(standardsTitle, standardsMarkup(standards), "wide")}
    </div>
  </main>
</body>
</html>
`;
}
