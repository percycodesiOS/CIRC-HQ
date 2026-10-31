// Dates are always evaluated at the school, even on a device in another time zone.
const schoolDateFormatter = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
const days = [...document.querySelectorAll('details[data-date]')];
const weeks = [...document.querySelectorAll('details.script-week')];
const status = document.getElementById('script-date-status');
const jump = document.getElementById('today-jump');
const dayLabels = new Map(days.map(day => [day, day.querySelector('summary').textContent.trim()]));
let lastSchoolDate = '';
let initialized = false;

function schoolDateKey(now = new Date()) {
  const parts = Object.fromEntries(schoolDateFormatter.formatToParts(now).map(part => [part.type, part.value]));
  return parts.year + '-' + parts.month + '-' + parts.day;
}
const requestedDay = () => days.find(day => '#' + day.id === window.location.hash);
function openDay(selected) {
  if (!selected) return;
  days.forEach(day => { day.open = day === selected; });
  const week = selected.closest('.script-week');
  if (week) week.open = true;
}
function refreshScriptDates(now = new Date()) {
  const today = schoolDateKey(now);
  const changedDate = today !== lastSchoolDate;
  const current = days.find(day => day.dataset.date === today);
  for (const day of days) {
    const state = day.dataset.date < today ? 'past' : day.dataset.date === today ? 'today' : 'future';
    day.dataset.dateState = state;
    day.classList.toggle('is-past', state === 'past');
    day.classList.toggle('is-today', state === 'today');
    const summary = day.querySelector('summary');
    let badge = summary.querySelector('.day-date-state');
    if (!badge) { badge = document.createElement('span'); badge.className = 'day-date-state'; summary.append(badge); }
    badge.textContent = state === 'past' ? 'Past date' : state === 'today' ? 'Today' : '';
  }
  for (const week of weeks) {
    const isCurrent = week.dataset.weekStart <= today && today <= week.dataset.weekEnd;
    week.classList.toggle('is-current-week', isCurrent);
    week.classList.toggle('is-past-week', week.dataset.weekEnd < today);
    if (!initialized || changedDate) week.open = isCurrent;
  }
  jump.hidden = !current;
  if (current) {
    jump.href = '#' + current.id;
    status.textContent = 'Today: ' + dayLabels.get(current) + '. Past dates are gray and remain available.';
  } else {
    status.textContent = 'No script is published for today. Choose a date below. Past scripts remain available for reference.';
  }
  if (!initialized || changedDate) {
    const requested = requestedDay();
    const selected = !initialized || (requested && requested.dataset.date !== lastSchoolDate) ? requested || current : current;
    if (selected) openDay(selected);
  }
  lastSchoolDate = today;
  initialized = true;
}
// Native details remain usable without JavaScript; only one individual day opens at once.
days.forEach(day => day.addEventListener('toggle', () => {
  if (day.open) {
    days.forEach(other => { if (other !== day) other.open = false; });
    const week = day.closest('.script-week');
    if (week) week.open = true;
  }
}));
jump.addEventListener('click', () => openDay(days.find(day => day.dataset.date === schoolDateKey())));
window.addEventListener('hashchange', () => openDay(requestedDay()));
window.addEventListener('focus', () => refreshScriptDates());
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshScriptDates(); });
refreshScriptDates();
// An overnight studio tab updates within a minute of midnight, including daylight-saving changes.
setInterval(() => refreshScriptDates(), 60_000);
