import assert from "node:assert/strict";
import test from "node:test";

let catalog = null;

try {
  catalog = await import("../src/model/project-catalog.js");
} catch {
  catalog = null;
}

const EXPECTED_TITLES = [
  "Meet the CIRC Teacher and the Outdoor Classroom",
  "Tech Terrarium",
  "Outdoor Classroom Redesign",
  "Cardboard Connections Lab",
  "Paper Bridge",
  "Outdoor Microclimate Map",
  "Seed Travelers",
  "Crash Lander",
  "Paper Circuit Signal",
  "Cardboard Arcade",
  "Hull Design",
  "Cardboard Micro-Furniture",
  "Rube Machine",
  "Human Program",
  "Maze Coders",
  "Binary Beacons",
  "Conductivity Detectives",
  "Moving Picture Machine",
  "Cargo Sorter",
  "Black Box Systems",
  "Error-Proof Messages",
  "Accessibility Design Sprint",
  "Helping Hand",
  "Package Rescue",
  "Upcycle Lab",
  "Hydroponics Flow Lab",
  "Stormwater Rescue",
  "Micro:bit Sensor Station",
  "Mirror Maze",
  "Earthquake Platform",
  "Outdoor Habitat Helper",
  "Biomimicry Grabber",
  "Mystery Materials",
  "Fix, Remix, or Invent Studio",
  "CIRC Showcase Builder",
  "Demo Day"
];

const REQUIRED_STRING_FIELDS = [
  "id",
  "title",
  "strapline",
  "objective",
  "stretch",
  "safety",
  "cleanup",
  "exitEvidence",
  "independence"
];

const REQUIRED_LIST_FIELDS = [
  "teacherSay",
  "teacherDo",
  "studentSteps",
  "materials"
];

function expectedPhase(number) {
  if (number <= 2) return "Watch me";
  if (number <= 8) return "Guided Crew";
  if (number <= 16) return "Shared Crew";
  if (number <= 27) return "Team Run";
  return "Student Studio";
}

test("the project catalog module is available", () => {
  assert.ok(catalog, "project catalog implementation is unavailable");
});

test("the catalog exposes the complete numbered 36-project sequence", () => {
  const projects = catalog?.PROJECTS ?? [];

  assert.equal(projects.length, 36);
  assert.deepEqual(projects.map((project) => project.number),
    Array.from({ length: 36 }, (_, index) => index + 1));
  assert.deepEqual(projects.map((project) => project.title), EXPECTED_TITLES);
  assert.equal(new Set(projects.map((project) => project.id)).size, 36);
});

test("every project carries a complete classroom-ready plan", () => {
  const projects = catalog?.PROJECTS ?? [];

  assert.equal(projects.length, 36);
  for (const project of projects) {
    for (const field of REQUIRED_STRING_FIELDS) {
      assert.equal(typeof project[field], "string", `${project.number} ${field} must be a string`);
      assert.notEqual(project[field].trim(), "", `${project.number} ${field} must not be empty`);
    }

    for (const field of REQUIRED_LIST_FIELDS) {
      assert.ok(Array.isArray(project[field]), `${project.number} ${field} must be a list`);
      assert.ok(project[field].length > 0, `${project.number} ${field} must not be empty`);
      assert.ok(project[field].every((entry) => typeof entry === "string" && entry.trim()),
        `${project.number} ${field} must contain plain nonempty text`);
    }

    assert.equal(typeof project.fastFinish, "object");
    assert.equal(typeof project.fastFinish.title, "string");
    assert.notEqual(project.fastFinish.title.trim(), "");
    assert.equal(typeof project.fastFinish.directions, "string");
    assert.notEqual(project.fastFinish.directions.trim(), "");

    assert.equal(typeof project.admin, "object");
    assert.equal(project.admin.duration, "35 minutes");
    assert.deepEqual(project.admin.grades, [5, 6]);
    assert.equal(project.admin.corePlan, "Same core plan for grades 5 and 6");
    assert.equal(typeof project.admin.standards, "object");
    assert.equal(project.admin.standardsTitle, "Pennsylvania STEELS crosswalk");
    assert.deepEqual(project.admin.standards.grade5, [
      "PA STEELS Grades 3-5 | 3.5.3-5.M",
      "PA STEELS Grades 3-5 | 3.5.3-5.P",
      "PA STEELS Grades 3-5 | 3.5.3-5.R",
      "PA STEELS Grades 3-5 | 3.5.3-5.U"
    ]);
    assert.deepEqual(project.admin.standards.grade6, [
      "PA STEELS Grades 6-8 | 3.5.6-8.W (ETS)",
      "PA STEELS Grades 6-8 | 3.5.6-8.P (ETS)",
      "PA STEELS Grades 6-8 | 3.5.6-8.N (ETS)",
      "PA STEELS Grades 6-8 | 3.5.6-8.M (ETS)"
    ]);
    assert.equal(project.admin.standards.grade5.some((item) => /3-5-ETS1/.test(item)), false);
    assert.equal(project.admin.standards.grade6.some((item) => /MS-ETS1/.test(item)), false);
  }
});

test("independence phases follow the planned handoff from modeling to student ownership", () => {
  const projects = catalog?.PROJECTS ?? [];
  const getIndependencePath = catalog?.getIndependencePath ?? (() => null);

  assert.equal(projects.length, 36);
  for (const project of projects) {
    assert.equal(project.independence, expectedPhase(project.number));
    assert.equal(getIndependencePath(project.number), expectedPhase(project.number));
  }
});

test("project lookup uses the stable project number and rejects invalid numbers", () => {
  const getProjectByNumber = catalog?.getProjectByNumber ?? (() => null);

  assert.equal(getProjectByNumber(2)?.title, "Tech Terrarium");
  assert.equal(getProjectByNumber(36)?.title, "Demo Day");
  assert.equal(getProjectByNumber(0), null);
  assert.equal(getProjectByNumber(37), null);
  assert.equal(getProjectByNumber("2"), null);
});

test("Tech Terrarium starts with the real shared build before feature extensions", () => {
  const terrarium = catalog?.getProjectByNumber?.(2);
  const classroomPlan = [
    terrarium?.objective,
    ...(terrarium?.teacherDo ?? []),
    ...(terrarium?.studentSteps ?? []),
    ...(terrarium?.materials ?? [])
  ].join(" ");

  assert.match(classroomPlan, /collect/i);
  assert.match(classroomPlan, /wash/i);
  assert.match(classroomPlan, /base/i);
  assert.match(classroomPlan, /whole-class|shared layout/i);
  assert.match(classroomPlan, /build|assemble/i);
});

test("Experience 1 teaches Trust and Respect before approved teacher stories", () => {
  const introduction = catalog?.getProjectByNumber?.(1);
  const teacherScript = [
    ...(introduction?.teacherSay ?? []),
    ...(introduction?.teacherDo ?? []),
    ...(introduction?.studentSteps ?? [])
  ].join(" ");

  assert.match(teacherScript, /two rules/i);
  assert.match(teacherScript, /\bTrust\b/);
  assert.match(teacherScript, /\bRespect\b/);
  assert.match(teacherScript, /teacher-approved stor/i);
});

test("the year map includes varied outdoor cardboard circuit accessibility and choice experiences", () => {
  const projects = catalog?.PROJECTS ?? [];
  const title = (number) => projects.find((project) => project.number === number)?.title;

  assert.deepEqual([title(4), title(10), title(12)], [
    "Cardboard Connections Lab",
    "Cardboard Arcade",
    "Cardboard Micro-Furniture"
  ]);
  assert.deepEqual([title(6), title(7), title(27), title(31)], [
    "Outdoor Microclimate Map",
    "Seed Travelers",
    "Stormwater Rescue",
    "Outdoor Habitat Helper"
  ]);
  assert.deepEqual([title(9), title(17), title(28)], [
    "Paper Circuit Signal",
    "Conductivity Detectives",
    "Micro:bit Sensor Station"
  ]);
  assert.equal(title(22), "Accessibility Design Sprint");
  assert.equal(title(34), "Fix, Remix, or Invent Studio");
});

test("paper circuits avoid loose coin cells and use a switched low-voltage holder", () => {
  const paperCircuit = catalog?.getProjectByNumber?.(9);
  const plan = [
    ...(paperCircuit?.teacherDo ?? []),
    ...(paperCircuit?.studentSteps ?? []),
    ...(paperCircuit?.materials ?? []),
    paperCircuit?.safety,
    paperCircuit?.cleanup
  ].join(" ");

  assert.doesNotMatch(plan, /coin cell|CR2032/i);
  assert.match(plan, /switched 2xAA|switched AA/i);
  assert.match(plan, /battery holder/i);
});

test("catalog materials include every card tool tray and station required by timed directions", () => {
  const requiredMaterialsByProject = new Map([
    [2, ["Team cards", "Materials picture", "Mode cards", "Job-area signs", "Team trays"]],
    [8, ["Drop-zone team cards"]],
    [10, ["Tabletop game cards", "Play trays"]],
    [13, ["Final-task cards"]],
    [14, ["Short-task cards"]],
    [22, ["Scissors", "Access-test cards"]],
    [23, ["Scissors", "Role cards", "Build-lead marker", "Test stand"]],
    [24, ["Scissors", "Handling-test cards"]],
    [26, ["Teacher-controlled tubing cutter", "Wet mats", "Sink bucket"]],
    [27, ["Scissors", "Wet mats", "Return tub"]],
    [31, ["Scissors", "Approval tray"]],
    [32, ["Scissors"]],
    [34, ["Path safety cards"]],
  ]);

  for (const [projectNumber, requiredMaterials] of requiredMaterialsByProject) {
    const project = catalog?.getProjectByNumber?.(projectNumber);
    for (const requiredMaterial of requiredMaterials) {
      assert.ok(
        project.materials.includes(requiredMaterial),
        `project ${projectNumber} must list ${requiredMaterial}`,
      );
    }
  }
});

test("the catalog contains no private schedule data, district logo claims, or forbidden Unicode dashes", () => {
  const text = JSON.stringify(catalog?.PROJECTS ?? []);

  assert.doesNotMatch(text, /Tammy|Kenny|homeroom|private schedule/i);
  assert.doesNotMatch(text, /official district logo|Seneca Valley logo/i);
  assert.doesNotMatch(text, /[\u2013\u2014]/u);
});
