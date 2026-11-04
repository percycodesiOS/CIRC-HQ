// A small classroom entrance over the existing curriculum. No accounts,
// schedule, student data, browser storage or network requests belong here.
import { getLessonForRef } from './playbooks.js';
import { handoutForRef } from './lesson-finder.js';

export const CLASSROOM_INTRO = 'CIRC HQ is our home for creating, investigating, reading and learning, and solving problems together. Here you will find today’s goal, one step at a time, and the materials you need. Follow the step your teacher is showing.';
export const TANK_INTRO = 'CIRC Tank is our invention project. Notice a small problem, design an idea that helps someone, test it, and improve it. Today is only the beginning: brainstorm, make one labeled sketch, and give Mr. Macek a 30-second elevator pitch.';

const step = (label, minutes, directions, teacherDirections = []) => ({ label, minutes, directions, teacherDirections });
const kickoff = {
  ref: 'classroom:tank-kickoff', title: 'CIRC Tank: your first idea', goal: 'I can explain a problem, sketch one idea that helps, and pitch it in 30 seconds.',
  materials: ['One sheet of paper', 'Pencil', 'Optional crayons or colored pencils'],
  prep: ['Have one sheet of paper and a pencil ready per student. Plain paper works if you cannot print.', 'Open this lesson before students arrive. Draw a simple pencil-tray example or use the example on the screen.', 'Plan to hear pitches while students sketch. At 30 seconds each, 30 students need 15 minutes before transitions; do not leave all pitches for the last five minutes.'],
  safety: 'Choose a small, practical problem. Do not make a classmate the problem or use anyone’s private information.',
  turnIn: 'Hand Mr. Macek ONE labeled sketch with your name and class, and deliver your 30-second pitch to him before dismissal.',
  success: 'I can name who needs help, describe the problem, point to the part of my sketch that helps, and explain my idea in 30 seconds.',
  fallback: 'Use plain paper. Draw, point to labels and explain your idea to Mr. Macek. No device, account, survey or video is needed.',
  extension: 'Improve a label or rehearse your pitch quietly. Keep the same single sketch.',
  intro: 'Welcome to CIRC Tank. Think about a small problem you notice at school, at home, or in something you enjoy. Today, you get to be the person who comes up with a way to make it better. Your idea can be a new invention or an improvement to something that already exists. It does not need to be expensive, complicated, or perfect. It needs to help someone with a real problem. By the end of class, I want to see a labeled sketch and hear your 30-second elevator pitch. Tell me who you want to help, what the problem is, and how your idea could work. Today is your starting point. I want to hear your thinking.',
  teacherNotes: ['The interest survey is for another visit. No essay, second sketch, finished build or purchase is due today.', 'Rehearse with a partner, but each student speaks to Mr. Macek. Keep any private pitch checklist off the projected screen.', 'If a student needs help starting, offer: pencils roll away, a book will not stay open, or game pieces get mixed up.'],
  resources: [{ label: 'One-page idea sheet (PDF)', url: 'assets/guides/CIRC-Tank-First-Idea.pdf', description: 'One sketch and a short pitch frame. Plain paper is also fine.' }],
  steps: [
    step('Welcome to CIRC Tank', 3, [TANK_INTRO, 'By the end: one labeled sketch and a 30-second pitch to Mr. Macek.'], ['Read the introduction. Point to the two finish requirements.']),
    step('Watch one simple example', 3, ['Problem: pencils roll off a desk.', 'Idea: a small tray with a raised edge. The edge keeps pencils on the desk.', 'Example pitch: “Students lose pencils when they roll off their desks. My idea is a small tray with a raised edge. It gives the pencil a place to stay, so students can keep working. I would test whether it stays in place when the desk is bumped.”'], ['Sketch a rectangle and label “raised edge” and “pencil space.” Explain how the label connects to the problem.']),
    step('Brainstorm, then choose', 5, ['Think of a few small problems at school, at home, or in something you enjoy.', 'Choose ONE problem. Who needs help? When does it happen?', 'Tell a partner: “I want to help ___ when ___.”'], ['Circulate and help students narrow a big idea to one useful job.']),
    step('Make ONE labeled sketch', 16, ['Draw your idea. Label the important parts and show how it helps.', 'Prepare: “My idea helps ___. The problem is ___. My idea works by ___.”', 'Mr. Macek will hear individual 30-second pitches while everyone works. Be ready when he comes to you.'], ['Start individual pitches now. Continue through the next work block. Quietly track who you have heard; keep transitions short.']),
    step('Finish your pitch and labels', 5, ['If you have not pitched to Mr. Macek yet, let him know now.', 'Check: can someone understand how your idea helps from the labels?', 'Practice quietly with a partner while waiting.'], ['Finish remaining pitches. Give one specific next step, not a new assignment.']),
    step('Hand in and reset', 3, ['Put your name and class on the sketch. Hand it to Mr. Macek.', 'Return supplies and clear your table.', 'Your first idea is a starting point. We will test and improve ideas in later classes.'], ['Collect sketches by class. Note unfinished individual pitches privately so no student is silently missed.'])
  ]
};
const quickDraw = {
  ref: 'classroom:quick-draw', title: 'Quick Draw: can AI recognize your sketch?', goal: 'I can use specific details and explain what I notice about how AI recognizes patterns.',
  materials: ['School device, when available', 'Pencil and paper for notes or the paper option'],
  prep: ['Open Quick Draw on a school device before class and check that it loads and makes guesses.', 'Project one demonstration round. Keep volume low enough for instruction.', 'If the website is blocked, use the complete paper activity below. Do not spend class resetting student accounts.'],
  safety: 'Draw the prompted objects only. Leave out names and personal information. Follow your teacher’s device directions.',
  turnIn: 'Share one example of a detail that helped recognition and one change you would try. Use the observation sheet if your teacher asks for a written response.',
  success: 'I can compare a recognized drawing with a missed drawing and point to a specific detail instead of only saying “it was good.”',
  fallback: 'Paper version: partners take turns drawing a simple object without words, while the other guesses. Add one detail, try again and explain what changed. These are human guesses; do not call them AI results.',
  extension: 'Try drawing the same kind of object with fewer lines. Explain which details you kept and why.',
  intro: 'Today we are investigating, not competing for the best artwork. We will see what an AI guesses as we draw, then use specific examples to explain which details seemed to help. It can get things wrong. A missed guess gives us something to investigate.',
  teacherNotes: ['Use the existing Quick Draw CIRC post; do not make a duplicate.', 'Ask “Which detail changed the guess?” Avoid treating a correct guess as proof that the computer understands an object the way a person does.'],
  resources: [
    { label: 'Open Google Quick Draw', url: 'https://quickdraw.withgoogle.com/', description: 'Use when your teacher starts the drawing activity. No new account is needed for this lesson.' },
    { label: 'Observation sheet (PDF)', url: 'assets/guides/CIRC-Quick-Draw-Observations.pdf', description: 'Optional short response, with a complete paper alternative.' }
  ],
  steps: [
    step('Notice the goal', 3, ['Today we investigate which drawing details help a guess.', 'You do not have to be an artist. Use the prompted objects and keep personal information out.'], ['Read the introduction and state that observations matter more than a score.']),
    step('Watch and predict', 5, ['Watch Mr. Macek draw one prompted object.', 'Before the next line, predict a detail that might help.', 'Notice whether the guess changes.'], ['Demonstrate one round. If blocked, switch to the paper version immediately.']),
    step('Try a round', 10, ['Open Quick Draw and choose “Let’s Draw!”', 'Read each prompt and sketch before time runs out.', 'Watch the guesses change as you add details.'], ['Circulate and check that students can see the prompts. No ranking or fastest-finisher requirement.']),
    step('Compare two examples', 8, ['Choose a drawing it recognized and a drawing it missed. If none was missed, compare a quick guess with a slower one.', 'Point to a detail that seemed to help.', 'Explain one change you would try.'], ['Ask for a visible detail as evidence. Offer the observation sheet or a spoken response.']),
    step('Share what you noticed', 6, ['Tell a partner: “I noticed ___ when I added ___.”', 'Listen for something similar or different in your partner’s example.', 'Share one observation with the class when invited.'], ['Hear examples from several students, including a missed guess.']),
    step('Close and reset', 3, ['Close the activity when asked and return your device.', 'Be ready to explain one useful detail and one change you would try.', 'Leave your workspace ready for the next class.'], ['Collect observations only if assigned; record what this class actually completed.'])
  ]
};

const refs = {
  6: ['classroom:tank-kickoff', 'year:tank-listen', 'year:tank-options', 'year:tank-plan', 'year:tank-joins', 'year:tank-prototype', 'year:tank-test-plan', 'year:tank-testing', 'year:tank-revision', 'year:tank-user-test', 'year:tank-materials', 'year:tank-brand-package', 'year:tank-pitch', 'year:tank-rehearse', 'year:tank-showcase'],
  5: ['classroom:quick-draw', 'catalog:8', 'catalog:12', 'year:kidwind-lift', 'year:kidwind-variable', 'year:kidwind-best', 'year:kidwind-share', 'catalog:14', 'catalog:19', 'catalog:23', 'catalog:25', 'catalog:22', 'catalog:18', 'catalog:34', 'year:studio-retest', 'year:innovation-share']
};
export function classroomPath(grade, visit = 1, teacher = false) {
  return `${teacher ? 'classroom-guide' : 'classroom'}.html?grade=${grade === 5 ? 5 : 6}&visit=${Math.max(1, Math.trunc(Number(visit)) || 1)}`;
}
export function classroomLessons(grade) {
  const chosen = grade === 5 ? 5 : 6;
  return refs[chosen].map((ref, i) => {
    const source = ref === kickoff.ref ? kickoff : ref === quickDraw.ref ? quickDraw : getLessonForRef(ref);
    if (!source) throw new Error(`Missing classroom lesson: ${ref}`);
    const lesson = structuredClone(source);
    const handout = handoutForRef(ref);
    lesson.resources ??= [];
    if (handout) lesson.resources.push(
      { label: 'This lesson: student directions (PDF)', url: handout.files.pdf, description: 'The matching directions from the existing CIRC HQ curriculum.' },
      { label: 'Editable response sheet (Word)', url: handout.files.docx, description: 'Use only if your teacher asks. Paper or a spoken response may be used as directed.' }
    );
    return { ...lesson, grade: chosen, visit: i + 1, minutes: lesson.steps.reduce((sum, item) => sum + item.minutes, 0),
      intro: lesson.intro ?? `Today our goal is: ${lesson.goal} We will work one step at a time. At the end, be ready to show: ${lesson.turnIn}` };
  });
}
export function classroomSelection(search = '') {
  const params = new URLSearchParams(search);
  const grade = params.get('grade') === '5' ? 5 : 6;
  const lessons = classroomLessons(grade);
  const raw = Number(params.get('visit') || 1);
  const visit = Number.isInteger(raw) && raw >= 1 && raw <= lessons.length ? raw : 1;
  return { grade, visit, lessons, lesson: lessons[visit - 1] };
}
export function classroomPost(lesson, base = 'https://percycodesios.github.io/CIRC-HQ/') {
  return `${lesson.title}\n\nToday’s goal: ${lesson.goal}\n\nOpen our class lesson: ${new URL(classroomPath(lesson.grade, lesson.visit), base).href}\nFollow the step your teacher is showing.\n\n${lesson.steps.map((item, i) => `Step ${i + 1}: ${item.label}\n${item.directions.join(' ')}`).join('\n\n')}\n\nFinish check: ${lesson.turnIn}\n\nIf the device or website is unavailable: ${lesson.fallback}\n\n${lesson.safety}`;
}
