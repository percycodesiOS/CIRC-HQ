// HTML for one printed student handout. Used by scripts/build-handouts.mjs to
// render a tagged, bookmarked PDF with Chromium. Student content only: no
// teacher moves, preparation notes, teacher-only links or class records.
import { DESIGN_STAGES, STRANDS, getLessonForRef } from "../src/model/playbooks.js";

// System fonts by default: the build then needs no network, and the PDF
// embeds small TrueType subsets. CIRC_HANDOUT_WEB_FONTS=1 uses the site's
// reviewed Google Fonts instead; Chromium on Linux embeds those as Type 3
// outlines, which roughly doubles every file.
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700;6..12,800&display=swap";
// Liberation Sans first: on Linux, fontconfig would otherwise substitute an
// unrelated font for the Windows names. Windows machines skip to Segoe UI.
const SYSTEM_BODY = '"Liberation Sans", "Segoe UI", "Aptos", Arial, sans-serif';
const WEB_BODY = '"Nunito Sans", "Segoe UI", system-ui, sans-serif';
const WEB_DISPLAY = '"Fredoka", "Nunito Sans", sans-serif';

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function list(items, { ordered = false, className = "" } = {}) {
  const tag = ordered ? "ol" : "ul";
  const attribute = className ? ` class="${className}"` : "";
  return `<${tag}${attribute}>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`;
}

function stepKindClass(step) {
  if (step.kind === "safety") return "step-safety";
  if (step.kind === "exit") return "step-exit";
  if (step.kind === "cleanup" || step.kind === "transition") return "step-quiet";
  return "step-work";
}

function paperPathSection(path) {
  if (!path) return "";
  const head = path.data.columns.map(column => `<th scope="col">${escapeHtml(column)}</th>`).join("");
  const rows = path.data.rows.map(row => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${escapeHtml(cell)}</th>` : `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  return `<section class="box paper" aria-labelledby="paper-path">
    <h2 id="paper-path">No-fan paper path</h2>
    <p class="note">${escapeHtml(path.note)}</p>
    <p><strong>Goal:</strong> ${escapeHtml(path.goal)}</p>
    ${list(path.directions, { ordered: true })}
    <p><strong>Keep:</strong> ${escapeHtml(path.evidence)}</p>
    <p class="note">${escapeHtml(path.data.label)} Unit: ${escapeHtml(path.data.unit)}</p>
    <table><caption>${escapeHtml(path.data.label)}</caption><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}

export function renderHandoutHtml(entry, { webFonts = process.env.CIRC_HANDOUT_WEB_FONTS === "1" } = {}) {
  const lesson = getLessonForRef(entry.ref);
  if (!lesson) throw new Error(`No lesson for ${entry.ref}`);
  const bodyFont = webFonts ? WEB_BODY : SYSTEM_BODY;
  const displayFont = webFonts ? WEB_DISPLAY : SYSTEM_BODY;
  const fontLink = webFonts ? `<link rel="stylesheet" href="${FONT_LINK}">` : "";
  const strands = lesson.strands.map(id => STRANDS.find(strand => strand.id === id)?.label).filter(Boolean);
  const stages = DESIGN_STAGES.map(stage => `<li class="${lesson.stages.includes(stage.id) ? "on" : ""}">${escapeHtml(stage.label)}</li>`).join("");
  const places = entry.places.map(place => escapeHtml(place.label)).join("; ");
  const studentLinks = (lesson.resources ?? []).filter(resource => !resource.teacherOnly);
  const steps = lesson.steps.map((step, index) => `<li class="step ${stepKindClass(step)}">
      <div class="step-head"><span class="num" aria-hidden="true">${index + 1}</span><h3>Step ${index + 1}: ${escapeHtml(step.label)}</h3><span class="min">${step.minutes} min</span></div>
      ${list(step.directions)}
    </li>`).join("");
  const gradeTargets = lesson.adapt.grade5 !== undefined
    ? `<section class="box grade" aria-labelledby="grade-targets"><h2 id="grade-targets">Grade targets</h2><p><strong>Grade 5:</strong> ${escapeHtml(lesson.adapt.grade5)}</p><p><strong>Grade 6:</strong> ${escapeHtml(lesson.adapt.grade6)}</p></section>`
    : "";
  const links = studentLinks.length
    ? `<section class="box links" aria-labelledby="links"><h2 id="links">Links and examples</h2><ul>${studentLinks.map(resource => `<li><strong>${escapeHtml(resource.label)}</strong> <span class="url">${escapeHtml(resource.url)}</span><br>${escapeHtml(resource.description)}</li>`).join("")}</ul></section>`
    : "";
  const fileName = `CIRC-${entry.stem}-Student.pdf`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="author" content="CIRC HQ">
<meta name="description" content="Student handout for ${escapeHtml(lesson.title)}: goal, steps, what to turn in and the done-when check.">
<title>${escapeHtml(lesson.title)}</title>
${fontLink}
<style>
  @page { size: letter; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; }
  html { font-size: 11.5pt; }
  body { margin: 0; color: #102b50; font-family: ${bodyFont}; line-height: 1.4; }
  h1, h2, h3 { margin: 0; color: #102b50; }
  h1 { font-family: ${displayFont}; font-weight: 700; font-size: 21pt; line-height: 1.1; }
  h2 { font-family: ${displayFont}; font-weight: ${webFonts ? 600 : 700}; font-size: 13.5pt; }
  h3 { font-size: 11.5pt; font-weight: 800; }
  p, ul, ol { margin: 0; }
  ul, ol { padding-left: 1.3em; }
  li + li { margin-top: 2pt; }
  header { display: flex; justify-content: space-between; gap: 12pt; padding-bottom: 8pt; border-bottom: 2.5pt solid #175fb5; margin-bottom: 10pt; }
  .kicker { font-size: 8.5pt; font-weight: 800; letter-spacing: 1pt; text-transform: uppercase; color: #175fb5; margin-bottom: 3pt; }
  .goal { margin-top: 4pt; font-size: 12pt; }
  .goal strong { color: #175fb5; }
  .meta { font-size: 9pt; color: #52618a; font-weight: 700; margin-top: 4pt; }
  .stages { display: flex; gap: 4pt; list-style: none; padding: 0; margin: 5pt 0 0; font-size: 8.5pt; font-weight: 800; }
  .stages li { padding: 1.5pt 6pt; border: 1pt dashed #9aa7bb; border-radius: 5pt; color: #52618a; }
  .stages li.on { border: 1pt solid #2e8f5b; background: #e6f5ec; color: #1f6b43; }
  .top { display: grid; grid-template-columns: 1.4fr 1fr; gap: 8pt; margin-bottom: 10pt; }
  .box { padding: 8pt 10pt; border: 1pt solid #b9c3d2; border-radius: 7pt; break-inside: avoid; }
  .box h2 { margin-bottom: 3pt; }
  .done { background: #fff3c4; border: 1.5pt solid #ffcf4a; }
  .done p { font-weight: 700; }
  .turnin { background: #eaf3ff; border: 1.5pt solid #175fb5; }
  .paper { border-style: dashed; }
  .next { background: #f5ffd0; border-color: #c9d86a; }
  .safe { background: #fff4e0; border-color: #e3b76b; color: #5a3600; }
  .safe h2 { color: #5a3600; }
  .grade { border-left: 4pt solid #175fb5; }
  .steps-head { display: flex; justify-content: space-between; align-items: baseline; margin: 2pt 0 6pt; }
  .steps-head span { font-size: 9pt; font-weight: 800; color: #52618a; }
  .steps { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 7pt; }
  .step { padding: 7pt 9pt; border: 1pt solid #b9c3d2; border-left: 4pt solid #175fb5; border-radius: 6pt; break-inside: avoid; }
  .step-exit { border-left-color: #2e8f5b; }
  .step-quiet { border-left-color: #8a97ab; }
  .step-safety { border-left-color: #d89b2b; }
  .step-head { display: grid; grid-template-columns: auto 1fr auto; gap: 6pt; align-items: center; margin-bottom: 3pt; }
  .num { display: inline-grid; place-items: center; width: 18pt; height: 18pt; border-radius: 50%; background: #175fb5; color: #fff; font-weight: 800; font-size: 10pt; }
  .step-exit .num { background: #2e8f5b; }
  .step-quiet .num { background: #52618a; }
  .step-safety .num { background: #b4600f; }
  .min { font-size: 9pt; font-weight: 800; color: #52618a; white-space: nowrap; }
  .step ul { font-size: 10.5pt; }
  .after { display: grid; grid-template-columns: 1fr 1fr; gap: 7pt; margin-top: 8pt; }
  .after .box p, .after .box li { font-size: 10.5pt; }
  .note { font-weight: 700; color: #5a3600; font-size: 9.5pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 4pt; font-size: 9.5pt; }
  caption { text-align: left; font-weight: 800; padding-bottom: 2pt; }
  th, td { border: 0.75pt solid #b9c3d2; padding: 2pt 5pt; text-align: left; }
  thead th { background: #eaf3ff; }
  .url { color: #124a8c; font-weight: 700; word-break: break-all; }
  .links li + li { margin-top: 4pt; }
  .where { margin-top: 8pt; font-size: 9pt; color: #52618a; }
</style>
</head>
<body>
<header>
  <div>
    <p class="kicker">CIRC HQ student handout | ${escapeHtml(entry.gradeLabel)}</p>
    <h1>${escapeHtml(lesson.title)}</h1>
    <p class="goal"><strong>Goal:</strong> ${escapeHtml(lesson.goal)}</p>
    <p class="meta">${lesson.minutes} minutes | ${lesson.steps.length} steps | ${escapeHtml(strands.join(", ") || "CIRC")} | ${places}</p>
    <ol class="stages" aria-label="Design process">${stages}</ol>
  </div>
</header>
<main>
  <div class="top">
    <section class="box done" aria-labelledby="done-when"><h2 id="done-when">You are done when</h2><p>${escapeHtml(lesson.success)}</p></section>
    <section class="box" aria-labelledby="you-will-use"><h2 id="you-will-use">You will use</h2>${list(lesson.materials)}</section>
  </div>
  <section aria-labelledby="steps">
    <div class="steps-head"><h2 id="steps">Steps</h2><span>${lesson.minutes} minutes total. Your teacher says when to move on.</span></div>
    <ol class="steps">${steps}</ol>
  </section>
  <div class="after">
    <section class="box turnin" aria-labelledby="turn-in"><h2 id="turn-in">What to turn in</h2><p>${escapeHtml(lesson.turnIn)}</p></section>
    <section class="box paper" aria-labelledby="another-way"><h2 id="another-way">No computer? Another way to do it</h2><p>${escapeHtml(lesson.fallback)}</p></section>
    <section class="box next" aria-labelledby="next-challenge"><h2 id="next-challenge">Finished early? Next challenge</h2><p>${escapeHtml(lesson.extension)}</p></section>
    <section class="box safe" aria-labelledby="stay-safe"><h2 id="stay-safe">Stay safe</h2><p>${escapeHtml(lesson.safety)}</p></section>
    ${gradeTargets}
    <section class="box" aria-labelledby="help"><h2 id="help">Stuck? Try this order</h2><ol><li>Read the step again, out loud if you can.</li><li>Ask a partner at your table.</li><li>Raise your hand. Keep working on the next part while you wait.</li></ol></section>
  </div>
  ${paperPathSection(lesson.paperPath)}
  ${links}
</main>
</body>
</html>`;
}
