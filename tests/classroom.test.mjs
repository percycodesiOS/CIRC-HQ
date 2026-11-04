import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { classroomLessons, classroomSelection, classroomPost } from '../src/model/classroom-lessons.js';
import { getLessonForRef } from '../src/model/playbooks.js';
import { countUnsafeRuntimeLinks } from '../scripts/verify-public.mjs';

test('every classroom visit has a complete 35-minute route and existing local documents',()=>{
  for(const grade of [5,6]) for(const lesson of classroomLessons(grade)) {
    assert.equal(lesson.minutes,35,lesson.title);
    assert.ok(lesson.goal && lesson.turnIn && lesson.fallback && lesson.intro);
    assert.ok(lesson.prep.length && lesson.steps.length && lesson.resources.length);
    for(const step of lesson.steps)assert.ok(step.directions.length,lesson.title);
    assert.ok(lesson.steps.some(step=>step.teacherDirections.length),lesson.title);
    for(const item of lesson.resources) if(!item.url.startsWith('https://'))assert.ok(existsSync(new URL('../'+item.url,import.meta.url)),item.url);
  }
});
test('kickoff does not fall back to old survey, essay or multi-sketch requirements',()=>{
  const lesson=classroomLessons(6)[0];
  assert.match(lesson.turnIn,/ONE labeled sketch/);
  assert.match(lesson.turnIn,/30-second pitch.*before dismissal/);
  assert.equal(lesson.resources.length,1);
  assert.ok(!JSON.stringify(lesson.steps).match(/complete.*survey|two sketches|write.*essay/i));
  const pitchWindow=lesson.steps.slice(3,5).reduce((sum,x)=>sum+x.minutes,0);
  assert.ok(pitchWindow>=20,'Make time for individual pitches during work');
});
test('future lessons retain their existing safety, prep and fallback content',()=>{
  for(const grade of [5,6])for(const lesson of classroomLessons(grade).slice(1)) {
    const original=getLessonForRef(lesson.ref);
    assert.deepEqual(lesson.steps,original.steps);
    assert.equal(lesson.safety,original.safety);
    assert.equal(lesson.prepRequired,original.prepRequired);
    assert.deepEqual(lesson.paperPath,original.paperPath);
    assert.equal(lesson.fallback,original.fallback);
  }
});
test('student link selects exact grade and visit without inventing a completed class',()=>{
  assert.equal(classroomSelection('?grade=5&visit=1').lesson.ref,'classroom:quick-draw');
  assert.equal(classroomSelection('?grade=6&visit=2').lesson.ref,'year:tank-listen');
  for(const value of ['-1','999','1.2','NaN','<script>'])assert.equal(classroomSelection('?visit='+value).visit,1);
  assert.equal(classroomSelection('?grade=4').grade,6);
});
test('post and guide derive from the same lesson, no independent stale copy',()=>{
  for(const grade of [5,6])for(const lesson of classroomLessons(grade)) {
    const post=classroomPost(lesson);
    assert.ok(post.includes(lesson.turnIn));
    assert.ok(post.includes(lesson.goal));
    assert.ok(post.includes(`classroom.html?grade=${grade}&visit=${lesson.visit}`));
    for(const step of lesson.steps)assert.ok(post.includes(step.directions.join(' ')));
  }
});
test('classroom entrypoints do not import teacher storage or cloud clients',()=>{
  const model=readFileSync(new URL('../src/model/classroom-lessons.js',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../src/classroom.js',import.meta.url),'utf8');
  assert.ok(!/localStorage|sessionStorage|firebase|fetch\(/.test(model+ui));
});
test('only the exact new classroom and Quick Draw destinations are approved',()=>{
  assert.equal(countUnsafeRuntimeLinks('https://quickdraw.withgoogle.com/'),0);
  assert.equal(countUnsafeRuntimeLinks('https://percycodesios.github.io/CIRC-HQ/'),0);
  assert.equal(countUnsafeRuntimeLinks('https://quickdraw.withgoogle.com.evil.example/'),1);
  assert.equal(countUnsafeRuntimeLinks('https://percycodesios.github.io/other-private-app/'),1);
});
