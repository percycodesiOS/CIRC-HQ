import { CLASSROOM_INTRO, TANK_INTRO, classroomSelection, classroomPath, classroomPost } from './model/classroom-lessons.js';

// Insert all lesson content as text nodes, never HTML.
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === 'className') node.className = value;
    else if (key === 'value') node.value = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) if (child != null && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
const list = values => h('ul', {}, values.map(value => h('li', {}, value)));
const p = (text, cls) => h('p', {className:cls}, text);
const title = text => h('h2', {}, text);
const smallTitle = text => h('h3', {}, text);
const details = (summary, ...content) => h('details', {className:'help'}, h('summary', {}, summary), content);
const card = (...children) => h('section', {className:'card'}, children);
const link = (text, href, attrs = {}) => h('a', {href, ...attrs}, text);
const button = (text, id, cls) => h('button', {type:'button', id, className:cls}, text);
const root = document.querySelector('#lesson');
const teacher = document.body.dataset.view === 'teacher';
let selection = classroomSelection(location.search), currentStep = 0, timerId = null, remaining = 0, deadline = 0, running = false;

function resources(lesson) {
  return lesson.resources.filter(item=>teacher || !item.teacherOnly).map(item=>h('a',{className:'resource-link',href:item.url,target:'_blank',rel:'noopener'},item.label,h('small',{},item.description ?? '')));
}
function outline(lesson, expanded = false) {
  return h('ol', {className:'outline'}, lesson.steps.map(item=>h('li',{},h('strong',{},`${item.label} · ${item.minutes} min`),expanded?list(item.directions):null)));
}
function chooser() {
  return h('form',{className:'chooser','aria-label':'Choose class lesson'},
    h('label',{},'GRADE',h('select',{id:'grade'},[6,5].map(grade=>h('option',{value:grade,selected:grade===selection.grade},`Grade ${grade} · ${grade===6?'CIRC Tank':'CIRC'}`)))),
    h('label',{className:'visit-label'},'CLASS VISIT',h('select',{id:'visit'},selection.lessons.map(item=>h('option',{value:item.visit,selected:selection.visit===item.visit},`${item.visit}. ${item.title}`)))),
    button(`Print ${teacher?'guide':'directions'}`,'print'));
}
function route() {
  const node=details('Next class visits · flexible winter route',
    p(`${selection.lessons.length} visits for the coming months. Repeat a visit when a class needs more time. These are lesson choices, not dates or proof that a class has completed them. Your teacher chooses the next visit.`,'muted'),
    h('ol',{className:'route'},selection.lessons.map(item=>h('li',{},link(item.title,classroomPath(selection.grade,item.visit,teacher)),h('span',{},item.goal)))));
  node.classList.add('screen-only');return node;
}
function render() {
  stopTimer();selection=classroomSelection(location.search);
  const lesson=selection.lesson, requested=Number(new URLSearchParams(location.hash.slice(1)).get('step')??1);
  currentStep=Number.isInteger(requested)&&requested>=1&&requested<=lesson.steps.length?requested-1:0;
  document.title=`CIRC HQ | ${teacher?'Teacher guide: ':''}${lesson.title}`;
  document.querySelector('#guide-link').href=classroomPath(selection.grade,selection.visit,!teacher);
  root.replaceChildren(chooser(),h('section',{className:'intro'},
    h('div',{className:'badges'},h('span',{className:'badge'},`Grade ${lesson.grade}`),h('span',{className:'badge teal'},`Visit ${lesson.visit} · ${lesson.minutes} minutes`)),
    p(teacher?'Ready to teach':'Learn together','eyebrow'),h('h1',{},lesson.title),p(lesson.goal,'goal')),
    teacher?teacherView(lesson):studentView(lesson),route());
  document.querySelector('#grade').addEventListener('change',event=>navigate(Number(event.target.value),1));
  document.querySelector('#visit').addEventListener('change',event=>navigate(selection.grade,Number(event.target.value)));
  document.querySelector('.chooser').addEventListener('submit',event=>event.preventDefault());
  document.querySelector('#print').addEventListener('click',()=>window.print());
  if(teacher){
    document.querySelector('#copy-post').addEventListener('click',()=>copyText(document.querySelector('#post-text').value,'Post copied. Choose the correct existing CIRC post/channel in Teams before using it.'));
    document.querySelector('#copy-link').addEventListener('click',()=>copyText(new URL(classroomPath(lesson.grade,lesson.visit),location.href).href,'Student lesson link copied.'));
  }else renderStep();
}
function studentView(lesson) {
  return h('div',{},h('div',{className:'layout'},h('div',{},
    h('section',{id:'step-card',className:'card step-card','aria-label':'Current lesson step'}),
    h('div',{className:'step-actions screen-only'},button('← Back','previous'),button('Next step →','next','primary')),
    details(`What is ${lesson.grade===6?'CIRC HQ and CIRC Tank':'CIRC HQ'}?`,p(CLASSROOM_INTRO),lesson.grade===6?p(TANK_INTRO):null),
    details(`All ${lesson.steps.length} steps at a glance`,outline(lesson)),
    h('section',{className:'print-only'},title('Follow these steps'),outline(lesson,true))),
    h('aside',{className:'side-stack','aria-label':'Lesson materials and finish check'},
      h('section',{className:'card check'},title('Before you leave'),p(lesson.turnIn)),
      card(title('Get ready'),h('ul',{className:'materials'},lesson.materials.map(value=>h('li',{},value)))),
      card(title('Open what you need'),resources(lesson)))),
    details('No device or supplies? Your backup plan',p(lesson.fallback),paperView(lesson)),
    details('Work safely',p(lesson.safety)));
}
function teacherView(lesson) {
  return h('div',{},h('div',{className:'button-row'},link('Open class screen →',classroomPath(lesson.grade,lesson.visit),{className:'primary-link'}),button('Copy student link','copy-link')),
    h('div',{className:'teacher-grid'},
      card(p('Before they arrive','eyebrow'),title('Set up once'),list(lesson.prep),smallTitle('Supplies'),list(lesson.materials),lesson.prepRequired?p(lesson.prepRequired,'notice'):null),
      h('section',{className:'card check'},p('Know what counts','eyebrow'),title('Finish check'),p(lesson.turnIn),p(lesson.success),smallTitle('Open what you need'),resources(lesson)),
      h('section',{className:'card wide'},p('You can say this','eyebrow'),title('Introduce the lesson'),p(lesson.intro,'read-aloud'),details('Introduce CIRC HQ itself',p(CLASSROOM_INTRO))),
      h('section',{className:'card wide'},p('Walk through it together','eyebrow'),title(`Your ${lesson.minutes}-minute lesson`),lesson.steps.map((item,index)=>h('section',{className:'teacher-step'},
        h('h3',{},h('span',{},`${index+1}. ${item.label}`),h('span',{className:'timing'},`${item.minutes} min`)),list(item.directions),
        item.teacherDirections?.length?h('div',{className:'teacher-cue'},h('strong',{},'Your cue'),list(item.teacherDirections)):null))),
      card(title('If something does not work'),p(lesson.fallback),paperView(lesson),smallTitle('Safety'),p(lesson.safety)),
      card(title('Teaching notes'),list(lesson.teacherNotes??[]),smallTitle('Ready early?'),p(lesson.extension),p('Record what this class actually finished in your existing private teaching record. Repeat this visit if needed; opening a lesson does not mark it taught.','muted'),link('Open full CIRC HQ','index.html')),
      h('section',{className:'card wide screen-only'},p('Same lesson, same directions','eyebrow'),title('Matching Teams post'),
        p('This text is ready to copy. Use the existing class’s CIRC channel and update a matching post instead of duplicating it. Copying does not publish anything.'),
        h('label',{for:'post-text',className:'sr-only'},'Matching class post'),h('textarea',{id:'post-text',className:'post-text',readonly:true,value:classroomPost(lesson)}),
        h('div',{className:'button-row'},button('Copy post text','copy-post')),
        p('For Grade 5, post the visit actually being taught, not the entire winter route. Update the next post and guide together when your teaching plan changes.','muted'))));
}
function paperView(lesson) {
  const paper=lesson.paperPath;if(!paper)return null;
  return h('div',{},smallTitle('Paper steps'),list(paper.directions),p(paper.evidence),paper.data?h('div',{},p(paper.data.label),p(paper.data.unit),
    h('div',{className:'table-wrap'},h('table',{},h('thead',{},h('tr',{},paper.data.columns.map(value=>h('th',{},value)))),h('tbody',{},paper.data.rows.map(row=>h('tr',{},row.map(value=>h('td',{},value)))))))):null);
}
function renderStep(focus=false) {
  stopTimer();const lesson=selection.lesson,item=lesson.steps[currentStep];
  document.querySelector('#step-card').replaceChildren(
    h('div',{className:'step-count'},h('strong',{},`STEP ${currentStep+1} OF ${lesson.steps.length}`),h('span',{},`${item.minutes} minutes · Follow your teacher`)),
    h('div',{className:'progress','aria-hidden':true},h('span',{style:`width:${(currentStep+1)/lesson.steps.length*100}%`})),
    h('h2',{id:'step-title',tabindex:'-1'},item.label),h('ul',{className:'directions'},item.directions.map(value=>h('li',{},value))),
    ...(lesson.ref==='classroom:tank-kickoff'&&currentStep===1?[exampleView()]:[]),
    h('div',{className:'timer screen-only'},h('output',{id:'timer','aria-label':'Time remaining'},`${item.minutes}:00`),button('Start timer','timer-toggle'),h('span',{},'Optional timer on this screen')));
  remaining=item.minutes*60;
  const previous=document.querySelector('#previous'),next=document.querySelector('#next');
  previous.disabled=currentStep===0;next.disabled=currentStep===lesson.steps.length-1;next.textContent=next.disabled?'Last step ✓':'Next step →';
  previous.onclick=()=>moveStep(-1);next.onclick=()=>moveStep(1);document.querySelector('#timer-toggle').onclick=toggleTimer;
  if(focus)document.querySelector('#step-title').focus();
}
function exampleView(){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 580 160');svg.setAttribute('role','img');svg.setAttribute('aria-label','A pencil tray with a raised edge and a space for a pencil.');
  const add=(tag,attrs,text)=>{const node=document.createElementNS(ns,tag);for(const [key,val]of Object.entries(attrs))node.setAttribute(key,val);if(text)node.textContent=text;svg.append(node);};
  add('path',{d:'M95 65 300 65 340 125 65 125Z',fill:'#deecfc',stroke:'#175fb5','stroke-width':'4'});
  add('path',{d:'M65 125V111L95 52H300L340 111V125M95 52V65M300 52V65',fill:'none',stroke:'#175fb5','stroke-width':'4'});
  add('path',{d:'m135 92 125 0',stroke:'#e2a229','stroke-width':'10'});
  add('path',{d:'m325 70 70-25 M220 108 150 30',stroke:'#15364f','stroke-width':'2'});
  add('text',{x:'400',y:'45','font-size':'21',fill:'#15364f'},'raised edge');add('text',{x:'377',y:'148','font-size':'21',fill:'#15364f'},'pencil space');
  return h('figure',{className:'example'},svg,h('figcaption',{className:'muted'},'An example to explain the idea, not a design you have to copy.'));
}
function stopTimer(){clearInterval(timerId);timerId=null;running=false;}
function toggleTimer(){
  if(running){remaining=Math.max(0,Math.ceil((deadline-performance.now())/1000));stopTimer();document.querySelector('#timer-toggle').textContent='Resume timer';return;}
  if(remaining===0)remaining=selection.lesson.steps[currentStep].minutes*60;
  deadline=performance.now()+remaining*1000;running=true;document.querySelector('#timer-toggle').textContent='Pause';
  timerId=setInterval(()=>{remaining=Math.max(0,Math.ceil((deadline-performance.now())/1000));document.querySelector('#timer').textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;if(!remaining){stopTimer();document.querySelector('#timer-toggle').textContent='Restart timer';document.querySelector('#status').textContent='Time is up. Check with your teacher before moving on.';}},250);
}
function moveStep(delta){currentStep=Math.max(0,Math.min(selection.lesson.steps.length-1,currentStep+delta));history.replaceState(null,'',`${location.pathname}${location.search}#step=${currentStep+1}`);renderStep(true);}
function navigate(grade,visit){location.href=classroomPath(grade,visit,teacher);}
async function copyText(text,message){try{await navigator.clipboard.writeText(text);document.querySelector('#status').textContent=message;}catch{const area=document.querySelector('#post-text');if(area){area.focus();area.select();document.querySelector('#status').textContent='Select Copy from your device menu to copy the highlighted text.';}else{document.querySelector('#status').textContent='Open the class screen and copy its address from your browser.';}}}
window.addEventListener('hashchange',render);window.addEventListener('pagehide',stopTimer);render();
