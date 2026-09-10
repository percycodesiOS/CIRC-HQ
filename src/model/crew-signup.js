// Private, teacher-supervised sign-ups. This store is never part of a plan or cloud payload.
export const CREW_SIGNUP_STORAGE_KEY = "circHQ.crewSignup.local.v1";
export const CREW_SIGNUP_ROLES = Object.freeze([
  ...[1, 2].map(number => Object.freeze({ id: `announcer${number}`, label: `Announcer ${number}`, optional: false })),
  ...[1, 2, 3, 4].map(number => Object.freeze({ id: `reporter${number}`, label: `Reporter ${number}`, optional: false })),
  ...[1, 2].map(number => Object.freeze({ id: `camera${number}`, label: `Camera operator ${number}`, optional: false })),
  ...[1, 2].map(number => Object.freeze({ id: `producer${number}`, label: `Producer ${number}`, optional: true }))
]);
const SIDES = ["primary", "backup"];
const MAX_DATES = 220;
const MAX_LENGTH = 2000000;

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function dateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError("Choose a valid broadcast date.");
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new TypeError("Choose a valid broadcast date.");
  return value;
}

function person(value) {
  if (!record(value) || Object.keys(value).sort().join(",") !== "classLabel,firstName") throw new TypeError("Use a class and first name only.");
  const result = {};
  for (const field of ["classLabel", "firstName"]) {
    if (typeof value[field] !== "string" || !value[field].trim() || value[field].length > 60 || /[<>\u0000-\u001f]/.test(value[field])) {
      throw new TypeError("Enter a class and first name, each up to 60 characters.");
    }
    result[field] = value[field].trim();
  }
  return result;
}

function key(owner) {
  if (typeof owner !== "string" || !owner || owner.length > 200) throw new TypeError("Select a teacher before saving crew sign-ups.");
  return `${CREW_SIGNUP_STORAGE_KEY}:${encodeURIComponent(owner)}`;
}

function empty() { return { version: 1, scope: "local-only", dates: {} }; }

function validate(value) {
  if (!record(value) || value.version !== 1 || value.scope !== "local-only" || !record(value.dates) ||
      Object.keys(value).sort().join(",") !== "dates,scope,version" || Object.keys(value.dates).length > MAX_DATES) {
    throw new TypeError("The saved crew list could not be read. It was left untouched.");
  }
  const next = empty();
  for (const [date, slots] of Object.entries(value.dates)) {
    dateKey(date);
    if (!record(slots)) throw new TypeError("The saved crew list could not be read. It was left untouched.");
    const admitted = {};
    const identities = new Set();
    for (const [slot, raw] of Object.entries(slots)) {
      if (!CREW_SIGNUP_ROLES.some(role => SIDES.some(side => slot === `${role.id}:${side}`))) throw new TypeError("Choose a listed role and primary or backup.");
      const member = person(raw);
      const identity = `${member.classLabel.toLocaleLowerCase()}\n${member.firstName.toLocaleLowerCase()}`;
      if (identities.has(identity)) throw new TypeError("This person already has a job or backup on this date. Remove that assignment first.");
      identities.add(identity);
      admitted[slot] = member;
    }
    next.dates[date] = admitted;
  }
  return next;
}

export function loadCrewSignups(storage, owner) {
  try {
    if (!storage?.getItem) return { status: "unavailable", book: empty() };
    const raw = storage.getItem(key(owner));
    if (raw === null) return { status: "empty", book: empty() };
    if (typeof raw !== "string" || raw.length > MAX_LENGTH) return { status: "invalid", book: empty() };
    try { return { status: "saved", book: validate(JSON.parse(raw)) }; }
    catch { return { status: "invalid", book: empty() }; }
  } catch { return { status: "unavailable", book: empty() }; }
}

export function saveCrewSignup(storage, owner, { date, role, side, member, replaceExisting = false }) {
  dateKey(date);
  if (!CREW_SIGNUP_ROLES.some(item => item.id === role) || !SIDES.includes(side)) throw new TypeError("Choose a listed role and primary or backup.");
  const loaded = loadCrewSignups(storage, owner);
  if (["invalid", "unavailable"].includes(loaded.status)) throw new TypeError("Crew storage is unavailable or unreadable. It was left untouched. Use a private paper sheet today.");
  const next = loaded.book;
  const slots = next.dates[date] ?? {};
  const slot = `${role}:${side}`;
  if (slots[slot] && !replaceExisting) throw new TypeError("That place is taken. Choose an open place or have Kenny remove the old assignment first.");
  next.dates[date] = { ...slots, [slot]: person(member) };
  const admitted = validate(next);
  const raw = JSON.stringify(admitted);
  if (raw.length > MAX_LENGTH) throw new TypeError("The local crew list is full. No saved date was removed.");
  try {
    storage.setItem(key(owner), raw);
    if (storage.getItem(key(owner)) !== raw) throw new Error("readback");
  } catch { throw new TypeError("Crew sign-up could not be verified as saved. Keep a private paper copy and check this browser's storage."); }
  return admitted;
}

export function removeCrewSignup(storage, owner, { date, slot }) {
  dateKey(date);
  const loaded = loadCrewSignups(storage, owner);
  if (["invalid", "unavailable"].includes(loaded.status)) throw new TypeError("The saved crew list was left untouched because it could not be read.");
  if (!Object.hasOwn(loaded.book.dates[date] ?? {}, slot)) throw new TypeError("That assignment is no longer present. Review the current list.");
  delete loaded.book.dates[date][slot];
  if (!Object.keys(loaded.book.dates[date]).length) delete loaded.book.dates[date];
  const raw = JSON.stringify(validate(loaded.book));
  try {
    storage.setItem(key(owner), raw);
    if (storage.getItem(key(owner)) !== raw) throw new Error("readback");
  } catch { throw new TypeError("The removal could not be verified. Check the saved list before continuing."); }
  return loaded.book;
}
