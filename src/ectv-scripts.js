const today = new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const days = [...document.querySelectorAll('details[data-date]')];
const current = days.find(day => day.dataset.date === today);
const status = document.getElementById('script-date-status');
const requestedDay = () => days.find(day => '#'+day.id === window.location.hash);
const openDay = selected => days.forEach(day => { day.open = day === selected; });
if(current){const jump=document.getElementById('today-jump');jump.href='#'+current.id;jump.hidden=false;jump.addEventListener('click',()=>openDay(current));status.textContent='Today: '+current.querySelector('summary').textContent+'.';}
else if(days.length && today > days.at(-1).dataset.date){status.textContent='These published school days have ended. These are the October 12-30 scripts. Check with your teacher before reading them on air.';}
else{status.textContent='Published school days: October 12-30, 2026. Choose the day your teacher asks you to read.';}
// Close other days even on browsers that do not support the native details name group.
days.forEach(day=>day.addEventListener('toggle',()=>{if(day.open)days.forEach(other=>{if(other!==day)other.open=false;});}));
const initialDay = requestedDay() || current;
if(initialDay) openDay(initialDay);
window.addEventListener('hashchange',()=>{const selected=requestedDay();if(selected)openDay(selected);});
