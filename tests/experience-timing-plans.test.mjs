import assert from "node:assert/strict";
import test from "node:test";

import { PROJECTS } from "../src/model/project-catalog.js";

const moduleUrl = new URL("../src/model/experience-timing-plans.js", import.meta.url);
let timingModel;
let timingModelError;

try {
  timingModel = await import(moduleUrl);
} catch (error) {
  timingModelError = error;
}

const EXPECTED_PROJECT_NUMBERS = Array.from({ length: 36 }, (_, index) => index + 1);
const OUTDOOR_PROJECT_NUMBERS = [1, 2, 3, 6, 31];
const WATER_PROJECT_NUMBERS = [2, 7, 11, 26, 27, 33];
const CUTTING_PROJECT_NUMBERS = [4, 12, 22, 23, 24, 25, 26, 27, 31, 32, 34];
const ELECTRICAL_PROJECT_NUMBERS = [9, 17, 28, 29];
const PRIVATE_DETAIL_WORDS = [
  "Percy",
  "Ellie",
  "Miko",
  "Waldameer",
  "Lake Erie",
  "campground",
];
const UNEXPLAINED_STUDENT_JARGON = [
  /dry fit/i,
  /freestanding/i,
  /tab connection/i,
  /slot connection/i,
  /folded brace/i,
  /structural force/i,
  /\bforce\b/i,
  /LED direction/i,
  /open point/i,
  /handoff/i,
  /unreliable motion/i,
  /place value/i,
  /decoded/i,
  /low-voltage/i,
  /conductor/i,
  /insulator/i,
  /probe/i,
  /open-circuit/i,
  /registration point/i,
  /sorting property/i,
  /decision feature/i,
  /full batch/i,
  /\binput\b/i,
  /\boutput\b/i,
  /sensor input/i,
  /alert output/i,
  /disprove/i,
  /checksum/i,
  /parity/i,
  /channel team/i,
  /simulate/i,
  /barrier/i,
  /access test/i,
  /linkage/i,
  /gripping surface/i,
  /transit hazard/i,
  /protection zone/i,
  /damage rubric/i,
  /reservoir/i,
  /plant site/i,
  /collection point/i,
  /flow path/i,
  /\bjoint\b/i,
  /baseline/i,
  /runoff/i,
  /erosion/i,
  /intervention/i,
  /threshold/i,
  /organism strategy/i,
  /biomimicry feature/i,
  /criteria/i,
  /measurable properties/i,
  /constraint/i,
  /evidence-based/i,
];

function getModel() {
  assert.ifError(timingModelError);
  assert.ok(timingModel, "the experience timing model should load");
  return timingModel;
}

function getPlans() {
  return getModel().EXPERIENCE_TIMING_PLANS;
}

function getPlanText(plan) {
  return plan.steps
    .flatMap((step) => [step.label, ...step.directions])
    .join(" ");
}

function getSafetyText(plan) {
  return plan.steps
    .filter((step) => step.kind === "safety")
    .flatMap((step) => step.directions)
    .join(" ");
}

function getAllStudentDirections(plan) {
  const paths = [
    plan.steps,
    ...Object.values(plan.modeVariants || {}).map((variant) => variant.steps),
    ...Object.values(plan.fallbacks || {}).map((fallback) => fallback.steps),
  ];
  const roleDirections = [
    ...Object.values(plan.modeVariants || {}).flatMap((variant) => variant.parallelJobs || []),
    ...(plan.parallelRoles || []),
  ].flatMap((role) => role.directions || []);

  return [
    ...paths.flatMap((steps) => steps.flatMap((step) => step.directions)),
    ...roleDirections,
  ];
}

test("experience timing plan module loads", () => {
  assert.ifError(timingModelError);
  assert.ok(timingModel);
});

test("the registry contains exactly one plan for every project from 1 through 36", () => {
  const plans = getPlans();
  const projectNumbers = plans.map((plan) => plan.projectNumber);

  assert.equal(plans.length, 36);
  assert.deepEqual(projectNumbers, EXPECTED_PROJECT_NUMBERS);
  assert.deepEqual(plans.map((plan) => plan.title), PROJECTS.map((project) => project.title));
  assert.equal(new Set(projectNumbers).size, 36);
});

test("every plan is a complete 35 minute student sequence", () => {
  for (const plan of getPlans()) {
    assert.equal(typeof plan.title, "string", `project ${plan.projectNumber} needs a title`);
    assert.ok(plan.title.length > 0, `project ${plan.projectNumber} needs a title`);
    assert.ok(
      plan.steps.length >= 7 && plan.steps.length <= 9,
      `project ${plan.projectNumber} must have 7 to 9 steps`,
    );
    assert.equal(
      plan.steps.reduce((sum, step) => sum + step.minutes, 0),
      35,
      `project ${plan.projectNumber} must total 35 minutes`,
    );

    const kinds = new Set(plan.steps.map((step) => step.kind));
    assert.ok(kinds.has("ready"), `project ${plan.projectNumber} needs a ready step`);
    assert.ok(kinds.has("work"), `project ${plan.projectNumber} needs hands-on work`);
    assert.ok(kinds.has("cleanup"), `project ${plan.projectNumber} needs cleanup`);
    assert.ok(kinds.has("exit"), `project ${plan.projectNumber} needs an exit check`);
  }
});

test("every step has a stable id, a short uppercase label, minutes, and simple directions", () => {
  for (const plan of getPlans()) {
    const ids = new Set();

    for (const step of plan.steps) {
      assert.match(
        step.id,
        /^p\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/,
        `project ${plan.projectNumber} has an unstable step id`,
      );
      assert.ok(
        step.id.startsWith(`p${String(plan.projectNumber).padStart(2, "0")}-`),
        `step ${step.id} must belong to project ${plan.projectNumber}`,
      );
      assert.ok(!ids.has(step.id), `project ${plan.projectNumber} repeats ${step.id}`);
      ids.add(step.id);

      assert.equal(step.label, step.label.toUpperCase(), `${step.id} label must be uppercase`);
      assert.match(step.label, /^[A-Z0-9 ]+$/, `${step.id} label must be display friendly`);
      assert.ok(step.label.length <= 24, `${step.id} label is too long`);
      assert.ok(Number.isInteger(step.minutes) && step.minutes > 0, `${step.id} needs whole minutes`);
      assert.ok(
        Array.isArray(step.directions) && step.directions.length >= 1 && step.directions.length <= 5,
        `${step.id} needs 1 to 5 directions`,
      );

      for (const direction of step.directions) {
        assert.equal(direction, direction.trim(), `${step.id} has extra spacing`);
        assert.ok(direction.length > 0, `${step.id} has an empty direction`);
        assert.ok(
          direction.split(/\s+/).length <= 18,
          `${step.id} direction should use no more than 18 words: ${direction}`,
        );
        assert.doesNotMatch(direction, /[;\n\r]/, `${step.id} must give one short action at a time`);
      }
    }
  }
});

test("all base mode fallback and role directions use plain fifth and sixth grade words", () => {
  for (const plan of getPlans()) {
    for (const direction of getAllStudentDirections(plan)) {
      for (const jargon of UNEXPLAINED_STUDENT_JARGON) {
        assert.doesNotMatch(
          direction,
          jargon,
          `project ${plan.projectNumber} must replace or define this hard word: ${direction}`,
        );
      }
    }
  }
});

test("every catalog teacher action is embedded inside a timed step", () => {
  for (const plan of getPlans()) {
    const catalogProject = PROJECTS[plan.projectNumber - 1];
    const expectedTeacherDirections = [
      ...catalogProject.teacherSay,
      ...catalogProject.teacherDo,
    ];
    const actualTeacherDirections = plan.steps.flatMap((step) => {
      assert.ok(Array.isArray(step.teacherDirections), `${step.id} needs teacherDirections`);
      assert.ok(step.teacherDirections.length <= 4, `${step.id} has too many teacher actions`);
      return step.teacherDirections;
    });

    assert.equal(
      actualTeacherDirections.length,
      expectedTeacherDirections.length,
      `project ${plan.projectNumber} must not add or drop catalog teacher actions`,
    );
    for (const teacherDirection of expectedTeacherDirections) {
      assert.ok(
        actualTeacherDirections.includes(teacherDirection),
        `project ${plan.projectNumber} must place this teacher action on the clock: ${teacherDirection}`,
      );
    }
    assert.equal(
      plan.steps.reduce((sum, step) => sum + step.minutes, 0),
      35,
      `project ${plan.projectNumber} teacher actions must stay inside the 35 minute plan`,
    );
  }
});

test("teacher setup and fallback cues appear before students need them", () => {
  const expectedPlacements = [
    [6, 2, "p06-ready"],
    [7, 2, "p07-safety"],
    [12, 0, "p12-ready"],
    [15, 2, "p15-ready"],
    [22, 0, "p22-ready"],
    [28, 2, "p28-ready"],
    [31, 0, "p31-ready"],
    [33, 2, "p33-criteria"],
  ];

  for (const [projectNumber, teacherDoIndex, expectedStepId] of expectedPlacements) {
    const plan = getPlans()[projectNumber - 1];
    const cue = PROJECTS[projectNumber - 1].teacherDo[teacherDoIndex];
    const step = plan.steps.find((candidate) => candidate.teacherDirections.includes(cue));

    assert.equal(
      step?.id,
      expectedStepId,
      `project ${projectNumber} must show this setup cue before student work: ${cue}`,
    );
  }

  const helpingHand = PROJECTS[22];
  const roleCue = helpingHand.teacherDo.find((direction) => /assign.*role|role.*assign/i.test(direction));
  assert.ok(roleCue, "project 23 catalog must assign all six parallel roles");
  const roleCueStep = getPlans()[22].steps.find((step) => step.teacherDirections.includes(roleCue));
  assert.equal(roleCueStep?.id, "p23-ready");
});

test("Experience 1 places rules and routines before the class walks outside", () => {
  const plan = getPlans()[0];
  const catalogProject = PROJECTS[0];
  const stepIndexByTeacherDirection = new Map(
    plan.steps.flatMap((step, index) =>
      step.teacherDirections.map((direction) => [direction, index])),
  );
  const walkOutIndex = plan.steps.findIndex((step) => step.label === "WALK OUT");
  const tourIndex = plan.steps.findIndex((step) => step.label === "TOUR THE SPACE");
  const returnIndex = plan.steps.findIndex((step) => step.label === "RETURN INSIDE");

  for (const ruleExplanation of catalogProject.teacherSay) {
    assert.ok(
      stepIndexByTeacherDirection.get(ruleExplanation) < walkOutIndex,
      "Trust and Respect must be explained before WALK OUT",
    );
  }
  assert.ok(
    stepIndexByTeacherDirection.get(catalogProject.teacherDo[1]) < walkOutIndex,
    "movement and cleanup routines must be modeled before WALK OUT",
  );
  assert.ok(
    [walkOutIndex, tourIndex].includes(
      stepIndexByTeacherDirection.get(catalogProject.teacherDo[2]),
    ),
    "the outdoor tour cue must appear on WALK OUT or TOUR THE SPACE",
  );
  assert.ok(returnIndex > tourIndex, "RETURN INSIDE must follow the outdoor tour");
});

test("outdoor lessons reserve time to walk out and return safely", () => {
  const plans = getPlans();

  for (const projectNumber of OUTDOOR_PROJECT_NUMBERS) {
    const plan = plans.find((candidate) => candidate.projectNumber === projectNumber);
    const transitionLabels = plan.steps
      .filter((step) => step.kind === "transition")
      .map((step) => step.label);

    assert.ok(transitionLabels.includes("WALK OUT"), `project ${projectNumber} needs walk-out time`);
    assert.ok(transitionLabels.includes("RETURN INSIDE"), `project ${projectNumber} needs return time`);
  }
});

test("weather and device failures select complete 35 minute fallback paths", () => {
  const { getExperienceTimingPlan } = getModel();
  const cases = [
    [6, "indoor-weather", /weather data cards/i],
    [31, "indoor-weather", /habitat photo cards/i],
    [28, "paper-data-cards", /paper code blocks/i],
  ];

  for (const [projectNumber, fallbackId, expectedText] of cases) {
    const basePlan = getPlans()[projectNumber - 1];
    assert.ok(basePlan.fallbacks?.[fallbackId], `project ${projectNumber} needs ${fallbackId}`);

    const selected = getExperienceTimingPlan(projectNumber, { fallbackId });
    assert.ok(selected, `project ${projectNumber} fallback should resolve`);
    assert.equal(selected.activeFallbackId, fallbackId);
    assert.equal("fallbacks" in selected, false, "unused fallback paths must be hidden");
    assert.equal(selected.steps.reduce((sum, step) => sum + step.minutes, 0), 35);
    assert.ok(selected.steps.every((step) => Array.isArray(step.teacherDirections)));
    assert.match(selected.steps.flatMap((step) => step.directions).join(" "), expectedText);
  }

  const indoorSix = getExperienceTimingPlan(6, { fallbackId: "indoor-weather" });
  assert.doesNotMatch(indoorSix.steps.map((step) => step.label).join(" "), /WALK OUT|RETURN INSIDE/);

  const paperTwentyEight = getExperienceTimingPlan(28, { fallbackId: "paper-data-cards" });
  assert.doesNotMatch(
    paperTwentyEight.steps.flatMap((step) => step.directions).join(" "),
    /USB|connect the board|transfer the program/i,
  );

  assert.equal(getExperienceTimingPlan(6, { fallbackId: "missing" }), null);
});

test("water, cutting, and electrical lessons include specific safety directions", () => {
  const plans = getPlans();

  for (const projectNumber of WATER_PROJECT_NUMBERS) {
    const text = getSafetyText(plans[projectNumber - 1]);
    assert.match(text, /water|wet|spill/i, `project ${projectNumber} needs water safety`);
    assert.match(text, /wipe|towel|station|tray/i, `project ${projectNumber} needs a spill control`);
  }

  for (const projectNumber of CUTTING_PROJECT_NUMBERS) {
    const text = getSafetyText(plans[projectNumber - 1]);
    assert.match(text, /cut|scissors/i, `project ${projectNumber} needs cutting safety`);
    assert.match(
      text,
      /finger|closed|table|do not cut.*yourself/i,
      `project ${projectNumber} needs a safe cutting action or a no-student-cut rule`,
    );
  }

  assert.match(getSafetyText(plans[25]), /do not cut tubing yourself/i);
  assert.ok(PROJECTS[25].materials.includes("Teacher-controlled tubing cutter"));

  for (const projectNumber of ELECTRICAL_PROJECT_NUMBERS) {
    const text = getSafetyText(plans[projectNumber - 1]);
    assert.match(text, /light|battery|usb|wire|power/i, `project ${projectNumber} needs electrical safety`);
    assert.match(text, /off|warm|face|approved|teacher/i, `project ${projectNumber} needs a stop rule`);
  }

  const paperCircuit = plans[8];
  assert.match(getSafetyText(paperCircuit), /switched battery holder/i);
  assert.doesNotMatch(getPlanText(paperCircuit), /coin cell/i);
});

test("tool and optional hot-glue work carries explicit safety tags and steps", () => {
  for (const plan of getPlans()) {
    for (const tag of plan.safetyTags) {
      if (["tool", "hot-glue"].includes(tag)) {
        assert.ok(
          plan.steps.some((step) => step.kind === "safety"),
          `project ${plan.projectNumber} needs a safety step for ${tag}`,
        );
      }
    }

    if (plan.safetyTags.includes("hot-glue")) {
      assert.match(getSafetyText(plan), /teacher|stand/i);
      assert.match(getSafetyText(plan), /tip|cord|burn|cool/i);
    }
  }
});

test("Tech Terrarium supports all annual modes without dismantling glued work", () => {
  const plan = getPlans()[1];

  assert.deepEqual(plan.annualModes.supported, [
    "build-new",
    "refresh-existing",
    "alternate-shared-build",
  ]);
  assert.equal(plan.annualModes.refreshExisting.dismantleGluedStructure, false);
  assert.match(getPlanText(plan), /mode card/i);
  assert.match(
    plan.modeVariants["refresh-existing"].steps.flatMap((step) => step.directions).join(" "),
    /keep all glued parts together/i,
  );
});

test("Tech Terrarium selects one complete mode and hides the other choices", () => {
  const { getExperienceTimingPlan } = getModel();
  const basePlan = getPlans()[1];
  const modeIds = ["build-new", "refresh-existing", "alternate-shared-build"];

  assert.deepEqual(Object.keys(basePlan.modeVariants).slice(0, 3), modeIds);

  for (const modeId of modeIds) {
    assert.ok(Array.isArray(basePlan.modeVariants[modeId].steps));
    assert.equal(
      basePlan.modeVariants[modeId].steps.reduce((sum, step) => sum + step.minutes, 0),
      35,
    );
    const selected = getExperienceTimingPlan(2, { modeId });
    assert.ok(selected, `${modeId} should resolve`);
    assert.equal(selected.activeModeId, modeId);
    assert.equal("modeVariants" in selected, false, "unselected modes must be hidden");
    assert.equal(selected.steps.reduce((sum, step) => sum + step.minutes, 0), 35);
    assert.ok(selected.steps.every((step) => Array.isArray(step.teacherDirections)));
    assert.ok(
      selected.parallelJobs.reduce((sum, job) => sum + job.maxStudents, 0) >= 30,
      `${modeId} needs parallel jobs for 30 students`,
    );
  }

  const refresh = getExperienceTimingPlan(2, { modeId: "refresh-existing" });
  assert.equal(refresh.preservation.dismantleGluedStructure, false);
  assert.match(refresh.steps.flatMap((step) => step.directions).join(" "), /keep all glued parts together/i);
  assert.doesNotMatch(refresh.steps.flatMap((step) => step.directions).join(" "), /build a new base/i);

  assert.equal(getExperienceTimingPlan(2, { modeId: "not-a-mode" }), null);
});

test("Experience 1 uses only private approved teacher story cards", () => {
  const plan = getPlans()[0];
  const text = getPlanText(plan);

  assert.deepEqual(plan.teacherStoryBoundary, {
    privateApprovedCardsOnly: true,
    hardcodedPersonalDetails: false,
  });
  assert.match(text, /approved story card/i);
  assert.match(text, /Trust/i);
  assert.match(text, /Respect/i);

  for (const privateWord of PRIVATE_DETAIL_WORDS) {
    assert.doesNotMatch(text, new RegExp(privateWord, "i"));
  }
});

test("Helping Hand remains one shared educational prototype with privacy and claim limits", () => {
  const plan = getPlans()[22];

  assert.deepEqual(plan.assistiveBoundary, {
    sharedPrototypeLimit: 1,
    educationalPrototypeOnly: true,
    studentPiiAllowed: false,
    medicalClaimsAllowed: false,
  });
  assert.match(getPlanText(plan), /one shared educational prototype/i);
  assert.match(getPlanText(plan), /test stand/i);
  assert.doesNotMatch(getPlanText(plan), /diagnose|treat|therapy|patient/i);
});

test("teacher-controlled queues approvals and parallel roles prevent classroom bottlenecks", () => {
  const plans = getPlans();
  const crashLanderText = getPlanText(plans[7]);
  assert.match(crashLanderText, /team card/i);
  assert.match(crashLanderText, /waiting job/i);
  assert.match(crashLanderText, /teacher calls/i);

  const paperCircuit = plans[8];
  const approvalIndex = paperCircuit.steps.findIndex((step) => step.label === "TEACHER CHECK");
  const powerIndex = paperCircuit.steps.findIndex((step) => step.label === "POWER THE SIGNAL");
  assert.ok(approvalIndex > -1 && approvalIndex < powerIndex);
  assert.match(paperCircuit.steps[approvalIndex].directions.join(" "), /wait.*teacher.*yes/i);

  const helpingHand = plans[22];
  assert.ok(Array.isArray(helpingHand.parallelRoles));
  assert.ok(helpingHand.parallelRoles.reduce((sum, role) => sum + role.maxStudents, 0) >= 30);
  assert.equal(new Set(helpingHand.parallelRoles.map((role) => role.id)).size, helpingHand.parallelRoles.length);
  assert.match(getPlanText(helpingHand), /role card/i);
  assert.doesNotMatch(getPlanText(helpingHand), /each student.*add|everyone.*test/i);
});

test("first-use machine wet lab device and outdoor timing is realistic", () => {
  const plans = getPlans();
  const rubeText = getPlanText(plans[12]);
  assert.doesNotMatch(rubeText, /test that step three times|two complete successes/i);
  assert.match(rubeText, /one full run/i);

  const hydroponics = plans[25];
  assert.ok(hydroponics.steps.find((step) => step.id === "p26-revise").minutes >= 6);
  assert.ok(hydroponics.steps.find((step) => step.id === "p26-cleanup").minutes >= 4);
  assert.match(getPlanText(hydroponics), /give the tube to the teacher/i);
  assert.doesNotMatch(getPlanText(hydroponics), /cut tubing to|cut the tube/i);

  const stormwater = plans[26];
  assert.ok(stormwater.steps.find((step) => step.id === "p27-cleanup").minutes >= 5);
  assert.match(getPlanText(stormwater), /one table at a time/i);

  const microbit = plans[27];
  assert.ok(microbit.steps.find((step) => step.id === "p28-ready").minutes >= 5);
  assert.match(getPlanText(microbit), /teacher starter file/i);
  assert.match(getPlanText(microbit), /computer shows the board/i);

  const habitat = plans[30];
  const returnIndex = habitat.steps.findIndex((step) => step.label === "RETURN INSIDE");
  const buildIndex = habitat.steps.findIndex((step) => step.label === "BUILD A SMALL MODEL");
  assert.ok(returnIndex > -1 && returnIndex < buildIndex);
});

test("validators accept the complete registry and lookup returns only in-range plans", () => {
  const {
    EXPERIENCE_TIMING_PLANS,
    getExperienceTimingPlan,
    validateExperienceTimingPlan,
    validateExperienceTimingPlans,
  } = getModel();

  assert.equal(validateExperienceTimingPlans(EXPERIENCE_TIMING_PLANS).ok, true);
  assert.equal(validateExperienceTimingPlan(EXPERIENCE_TIMING_PLANS[0]).ok, true);
  assert.equal(getExperienceTimingPlan(1), EXPERIENCE_TIMING_PLANS[0]);
  assert.equal(getExperienceTimingPlan(36), EXPERIENCE_TIMING_PLANS[35]);
  assert.equal(getExperienceTimingPlan(0), null);
  assert.equal(getExperienceTimingPlan(37), null);
  assert.equal(getExperienceTimingPlan("1"), null);
});

test("plan validation rejects a step without the teacherDirections field", () => {
  const { EXPERIENCE_TIMING_PLANS, validateExperienceTimingPlan } = getModel();
  const plan = structuredClone(EXPERIENCE_TIMING_PLANS[0]);
  delete plan.steps[0].teacherDirections;

  const result = validateExperienceTimingPlan(plan);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "teacher-directions-not-array"));
});

test("registry validation rejects duplicate, missing, and out-of-range project plans", () => {
  const { EXPERIENCE_TIMING_PLANS, assertValidExperienceTimingPlans, validateExperienceTimingPlans } =
    getModel();
  const clone = () => structuredClone(EXPERIENCE_TIMING_PLANS);

  const duplicate = clone();
  duplicate[1].projectNumber = 1;
  let result = validateExperienceTimingPlans(duplicate);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "duplicate-project-number"));
  assert.ok(result.errors.some((error) => error.code === "missing-project-number"));
  assert.throws(() => assertValidExperienceTimingPlans(duplicate), /duplicate-project-number/);

  const missing = clone().slice(0, 35);
  result = validateExperienceTimingPlans(missing);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "missing-project-number"));
  assert.throws(() => assertValidExperienceTimingPlans(missing), /missing-project-number/);

  const outOfRange = clone();
  outOfRange[0].projectNumber = 37;
  result = validateExperienceTimingPlans(outOfRange);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "project-number-out-of-range"));
  assert.throws(() => assertValidExperienceTimingPlans(outOfRange), /project-number-out-of-range/);
});

test("timing plan source data contains no em dash or en dash", () => {
  const corpus = JSON.stringify(getPlans());
  assert.doesNotMatch(corpus, /[\u2013\u2014]/);
});


test("replica lessons add five explicit complete paths without replacing the original annual modes", () => {
  const { REPLICA_LESSON_CHOICES, getExperienceTimingPlan, validateExperienceTimingPlan } = getModel();
  assert.equal(REPLICA_LESSON_CHOICES.length, 5);
  assert.deepEqual(REPLICA_LESSON_CHOICES.map(({ id }) => id), ["replica-sort", "replica-layout", "replica-cardboard", "replica-service", "replica-resin"]);
  for (const choice of REPLICA_LESSON_CHOICES) {
    const plan = getExperienceTimingPlan(2, { modeId: choice.id });
    assert.equal(plan.title, choice.title);
    assert.equal(plan.steps.length, 7);
    assert.equal(plan.steps.reduce((sum, step) => sum + step.minutes, 0), 35);
    assert.equal(validateExperienceTimingPlan(plan).ok, true);
    assert.equal(plan.preservation.dismantleGluedStructure, false);
    assert.equal(Object.hasOwn(plan, "modeVariants"), false);
    assert.equal(plan.safetyTags.includes("water"), false);
    assert.ok(plan.parallelJobs.reduce((sum, job) => sum + job.maxStudents, 0) >= 30);
  }
  assert.match(getExperienceTimingPlan(2, { modeId: "build-new" }).steps.map((step) => step.label).join(" "), /WASH STATION/);
  const sort = getExperienceTimingPlan(2, { modeId: "replica-sort" });
  assert.match(sort.steps.flatMap((step) => step.teacherDirections).join(" "), /dry lesson.*required final epoxy/i);
  const layout = getExperienceTimingPlan(2, { modeId: "replica-layout" });
  assert.match(layout.steps.flatMap((step) => step.teacherDirections).join(" "), /no reference|reference is unavailable/i);
  const service = getExperienceTimingPlan(2, { modeId: "replica-service" });
  assert.match(service.steps.flatMap((step) => step.teacherDirections).join(" "), /No graphic footage/);
  const build = getExperienceTimingPlan(2, { modeId: "replica-cardboard" });
  assert.ok(build.safetyTags.includes("hot-glue"));
  assert.match(build.steps.flatMap((step) => step.teacherDirections).join(" "), /tape and tabs throughout if the station is unavailable/i);
  const resin = getExperienceTimingPlan(2, { modeId: "replica-resin" });
  const resinTeacher = resin.steps.flatMap((step) => step.teacherDirections).join(" ");
  assert.match(resinTeacher, /student lesson stays dry/i);
  assert.match(resinTeacher, /classroom timer never confirms a chemical cure/i);
  assert.match(resinTeacher, /Do not treat equal volume as equal weight/);
});

test("Day 3 Sort, Count, Plan keeps the verified seven-step 35-minute sequence", () => {
  const steps = getModel().getExperienceTimingPlan(2, { modeId: "replica-sort" }).steps;
  assert.deepEqual(
    steps.map((step) => [step.label, step.minutes]),
    [
      ["MEET THE PROJECT", 3],
      ["TAKE A ROLE", 4],
      ["SORT THE PARTS", 8],
      ["COUNT AND CHECK", 4],
      ["SKETCH ONE USE", 7],
      ["LABEL AND RESET", 5],
      ["LEAVE THE NEXT STEP", 4]
    ]
  );
  assert.equal(steps.reduce((total, step) => total + step.minutes, 0), 35);
});
