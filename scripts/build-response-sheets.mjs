// Build one editable Word response sheet per unique lesson, for Teams
// assignments where students type their answers. Pure Node: the .docx is a
// small stored (uncompressed) zip with fixed timestamps, so a rebuild from
// unchanged lesson data produces identical bytes and the asset lock holds.
//
//   node scripts/build-response-sheets.mjs
//   node scripts/build-response-sheets.mjs --only Logo-to-Jingle
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { HANDOUT_FOLDER, listHandouts } from "../src/model/lesson-finder.js";
import { getLessonForRef } from "../src/model/playbooks.js";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
// 2026-10-11 00:00:00 in MS-DOS date and time fields.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (10 << 5) | 11;

function xml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function crc32(bytes) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

// Stored zip entries only. Deterministic: fixed time, no extra fields.
export function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.from(text, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBytes, end]);
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function run(text, { bold = false, color = null, size = null } = {}) {
  const props = [bold ? "<w:b/>" : "", color ? `<w:color w:val="${color}"/>` : "", size ? `<w:sz w:val="${size}"/>` : ""].join("");
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function paragraph(runs, { style = null, after = 120 } = {}) {
  const props = `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}<w:spacing w:after="${after}"/></w:pPr>`;
  return `<w:p>${props}${Array.isArray(runs) ? runs.join("") : runs}</w:p>`;
}

function heading(text, level = 1) {
  return paragraph(run(text), { style: `Heading${level}`, after: 80 });
}

function bullet(text) {
  return `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="60"/></w:pPr>${run(text)}</w:p>`;
}

// A one-cell table with a minimum height is the answer box students type in.
function answerBox(prompt, lines = 4) {
  const height = 300 * lines;
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="8" w:color="175FB5"/><w:left w:val="single" w:sz="8" w:color="175FB5"/><w:bottom w:val="single" w:sz="8" w:color="175FB5"/><w:right w:val="single" w:sz="8" w:color="175FB5"/></w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="9360"/></w:tblGrid><w:tr><w:trPr><w:trHeight w:val="${height}" w:hRule="atLeast"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="5000" w:type="pct"/></w:tcPr>${paragraph(run(prompt, { bold: true, color: "52618A", size: 20 }), { after: 60 })}${paragraph(run(""))}</w:tc></w:tr></w:tbl>${paragraph(run(""), { after: 160 })}`;
}

function sentences(text) {
  return String(text).split(/(?<=[.?!])\s+/).map(part => part.trim()).filter(Boolean);
}

export function responseSheetXml(entry) {
  const lesson = getLessonForRef(entry.ref);
  const workSteps = lesson.steps.filter(step => step.kind === "work" || step.kind === "exit");
  const body = [
    paragraph(run("CIRC HQ response sheet", { bold: true, color: "175FB5", size: 18 }), { after: 40 }),
    paragraph(run(lesson.title), { style: "Title", after: 60 }),
    paragraph([run("Goal: ", { bold: true, color: "175FB5" }), run(lesson.goal)], { after: 160 }),
    paragraph([run("Name: ", { bold: true }), run("______________________    "), run("Class: ", { bold: true }), run("____________    "), run("Grade: ", { bold: true }), run("5  or  6")], { after: 200 }),
    heading("Before you start"),
    paragraph(run("Read the goal. In your own words, what are you making or finding out today?")),
    answerBox("My plan, in one or two sentences", 3),
    heading("While you work"),
    ...workSteps.slice(0, 3).flatMap((step, index) => [
      paragraph([run(`Step ${lesson.steps.indexOf(step) + 1}: ${step.label}`, { bold: true }), run(` (${step.minutes} min)`, { color: "52618A" })], { after: 60 }),
      ...step.directions.map(direction => bullet(direction)),
      answerBox(index === 0 ? "What I did or decided" : index === 1 ? "What I noticed or measured" : "What I changed and why", 3)
    ]),
    heading("What to turn in"),
    paragraph(run(lesson.turnIn)),
    answerBox("Where my work is, or what I shared with my teacher", 2),
    heading("You are done when"),
    ...sentences(lesson.success).map(line => bullet(`[ ]  ${line}`)),
    lesson.adapt.grade5 !== undefined
      ? paragraph([run("Grade 5 target: ", { bold: true }), run(lesson.adapt.grade5), run("    Grade 6 target: ", { bold: true }), run(lesson.adapt.grade6)], { after: 160 })
      : paragraph(run(""), { after: 40 }),
    heading("Reflect"),
    answerBox("At first I ___. Then I changed ___ because ___.", 3),
    heading("Finished early? Next challenge"),
    paragraph(run(lesson.extension)),
    answerBox("What I tried for the next challenge (optional)", 2),
    paragraph(run(`Made from the live lesson on CIRC HQ. Companion file: CIRC-${entry.stem}-Student.pdf.`, { color: "52618A", size: 16 }), { after: 0 })
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:cs="Aptos" w:eastAsia="Aptos"/><w:sz w:val="23"/><w:szCs w:val="23"/><w:color w:val="102B50"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="44"/><w:szCs w:val="44"/><w:color w:val="102B50"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/><w:color w:val="175FB5"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720"/></w:pPr></w:style>
</w:styles>`;

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#8226;"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;

function coreProperties(title) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(title)} response sheet</dc:title><dc:creator>CIRC HQ</dc:creator><dc:language>en-US</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">2026-10-11T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-10-11T00:00:00Z</dcterms:modified></cp:coreProperties>`;
}

export function buildResponseSheet(entry) {
  return buildZip([
    ["[Content_Types].xml", CONTENT_TYPES],
    ["_rels/.rels", ROOT_RELS],
    ["docProps/core.xml", coreProperties(entry.title)],
    ["word/document.xml", responseSheetXml(entry)],
    ["word/styles.xml", STYLES],
    ["word/numbering.xml", NUMBERING],
    ["word/_rels/document.xml.rels", DOCUMENT_RELS]
  ]);
}

export async function buildResponseSheets({ only = null, out = HANDOUT_FOLDER, log = () => {} } = {}) {
  const entries = listHandouts().filter(entry => !only || entry.stem === only);
  if (!entries.length) throw new Error(`No lesson matches ${only}`);
  await mkdir(path.join(ROOT, ...out.split("/")), { recursive: true });
  const results = [];
  for (const entry of entries) {
    const bytes = buildResponseSheet(entry);
    await writeFile(path.join(ROOT, ...entry.files.docx.split("/")), bytes);
    results.push({ stem: entry.stem, file: entry.files.docx, bytes: bytes.length });
    log(`written   ${entry.files.docx} (${bytes.length} bytes)`);
  }
  return results;
}

const executedDirectly = process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1]).replaceAll("\\", "/")}`).href;
if (executedDirectly) {
  const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
  await buildResponseSheets({ only, log: line => process.stdout.write(`${line}\n`) });
}
