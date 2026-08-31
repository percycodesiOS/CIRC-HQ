import { admitLocalState } from "../model/access.js";

const ENTITY_COLLECTIONS = [
  "resources",
  "checklist",
  "classes",
  "lessonGuides",
  "specialEvents"
];

function clone(value) {
  return structuredClone(value);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => deepEqual(value, right[index]));
  }
  if (typeof left !== "object") return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return deepEqual(leftKeys, rightKeys) && leftKeys.every((key) => deepEqual(left[key], right[key]));
}

function timestamp(value) {
  return typeof value?.updatedAt === "string" ? value.updatedAt : "";
}

function uniqueById(items) {
  const result = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (typeof item?.id !== "string") continue;
    const present = result.get(item.id);
    if (!present || timestamp(item) >= timestamp(present)) result.set(item.id, clone(item));
  }
  return result;
}

function mergeEntities(collection, localItems, remoteItems, conflicts) {
  const local = uniqueById(localItems);
  const remote = uniqueById(remoteItems);
  const merged = [];
  const ids = new Set([...local.keys(), ...remote.keys()]);
  for (const id of ids) {
    const left = local.get(id);
    const right = remote.get(id);
    if (!left) {
      merged.push(right);
      continue;
    }
    if (!right || deepEqual(left, right)) {
      merged.push(left);
      continue;
    }
    if (timestamp(right) > timestamp(left)) {
      merged.push(right);
      continue;
    }
    if (timestamp(left) > timestamp(right)) {
      merged.push(left);
      continue;
    }
    merged.push(left);
    conflicts.push({ collection, id, reason: "equal-timestamp-divergence", local: clone(left), remote: clone(right) });
  }
  return merged.sort((left, right) => left.id.localeCompare(right.id));
}

function mergeTombstones(local, remote) {
  const merged = new Map();
  for (const tombstone of [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])]) {
    if (typeof tombstone?.id !== "string" || typeof tombstone?.collection !== "string") continue;
    const key = `${tombstone.collection}:${tombstone.id}`;
    const existing = merged.get(key);
    if (!existing || String(tombstone.deletedAt || "") >= String(existing.deletedAt || "")) {
      merged.set(key, clone(tombstone));
    }
  }
  return [...merged.values()].sort((left, right) => `${left.collection}:${left.id}`.localeCompare(`${right.collection}:${right.id}`));
}

function withoutTombstonedEntities(collection, entities, tombstones) {
  const deleted = new Map(
    tombstones
      .filter((tombstone) => tombstone.collection === collection)
      .map((tombstone) => [tombstone.id, String(tombstone.deletedAt || "")])
  );
  return entities.filter((entity) => {
    const deletedAt = deleted.get(entity.id);
    return !deletedAt || timestamp(entity) > deletedAt;
  });
}

function mergePlan(local, remote, conflicts) {
  if (!local) return remote ? clone(remote) : null;
  if (!remote || deepEqual(local, remote)) return clone(local);
  const localVersion = Number(local.version) || 0;
  const remoteVersion = Number(remote.version) || 0;
  if (remoteVersion > localVersion) return clone(remote);
  if (localVersion > remoteVersion) return clone(local);
  conflicts.push({ collection: "plan", id: "plan", reason: "equal-version-divergence", local: clone(local), remote: clone(remote) });
  return timestamp(remote) > timestamp(local) ? clone(remote) : clone(local);
}

function mergePreferences(local, remote, conflicts) {
  const merged = {};
  const keys = new Set([...Object.keys(isRecord(local) ? local : {}), ...Object.keys(isRecord(remote) ? remote : {})]);
  for (const key of keys) {
    const left = local?.[key];
    const right = remote?.[key];
    if (!isRecord(left) || !isRecord(right)) {
      merged[key] = clone(right === undefined ? left : right);
    } else if (!deepEqual(left, right) && timestamp(left) === timestamp(right)) {
      merged[key] = clone(left);
      conflicts.push({ collection: "preferences", id: key, reason: "equal-timestamp-divergence", local: clone(left), remote: clone(right) });
    } else {
      merged[key] = clone(timestamp(right) > timestamp(left) ? right : left);
    }
  }
  return merged;
}

function mergeTeacherProgress(local, remote, conflicts) {
  const admittedLocal = isRecord(local) ? local : {};
  const admittedRemote = isRecord(remote) ? remote : {};
  const entries = [];
  const teacherIds = new Set([
    ...Object.keys(admittedLocal),
    ...Object.keys(admittedRemote)
  ]);
  for (const teacherId of teacherIds) {
    const left = admittedLocal[teacherId];
    const right = admittedRemote[teacherId];
    if (left === undefined) {
      entries.push([teacherId, clone(right)]);
      continue;
    }
    if (right === undefined || deepEqual(left, right)) {
      entries.push([teacherId, clone(left)]);
      continue;
    }
    if (timestamp(right) > timestamp(left)) {
      entries.push([teacherId, clone(right)]);
      continue;
    }
    if (timestamp(left) > timestamp(right)) {
      entries.push([teacherId, clone(left)]);
      continue;
    }
    entries.push([teacherId, clone(left)]);
    conflicts.push({
      collection: "teacherProgress",
      id: teacherId,
      reason: "equal-timestamp-divergence",
      local: clone(left),
      remote: clone(right)
    });
  }
  return Object.fromEntries(entries);
}

export function mergeStates(local, remote) {
  if (!isRecord(local)) throw new TypeError("local state must be an object");
  if (!isRecord(remote)) {
    return {
      state: admitLocalState(local),
      conflicts: [{ reason: "remote-unavailable" }]
    };
  }

  const admittedLocal = admitLocalState(local);
  const admittedRemote = admitLocalState(remote);

  const conflicts = [];
  const state = clone(admittedLocal);
  state.updatedAt = timestamp(admittedRemote) > timestamp(admittedLocal)
    ? admittedRemote.updatedAt
    : admittedLocal.updatedAt;
  state.tombstones = mergeTombstones(admittedLocal.tombstones, admittedRemote.tombstones);
  state.plan = mergePlan(admittedLocal.plan, admittedRemote.plan, conflicts);
  if (
    Object.hasOwn(admittedLocal, "teacherProgress") ||
    Object.hasOwn(admittedRemote, "teacherProgress")
  ) {
    state.teacherProgress = mergeTeacherProgress(
      admittedLocal.teacherProgress,
      admittedRemote.teacherProgress,
      conflicts
    );
  }
  for (const collection of ENTITY_COLLECTIONS) {
    state[collection] = withoutTombstonedEntities(
      collection,
      mergeEntities(
        collection,
        admittedLocal[collection],
        admittedRemote[collection],
        conflicts
      ),
      state.tombstones
    );
  }
  state.preferences = mergePreferences(
    admittedLocal.preferences,
    admittedRemote.preferences,
    conflicts
  );
  state.notes = withoutTombstonedEntities(
    "notes",
    mergeEntities("notes", admittedLocal.notes, admittedRemote.notes, conflicts),
    state.tombstones
  );
  if (admittedLocal.classroomFacing || admittedRemote.classroomFacing) {
    state.classroomFacing = true;
    state.notes = state.notes.filter((note) => note?.visibility === "classroom");
  }
  return { state: admitLocalState(state), conflicts };
}
