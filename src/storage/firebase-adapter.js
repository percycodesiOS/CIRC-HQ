import { admitResourceState } from "../model/access.js";
import { mergeStates } from "./sync-engine.js";

const FIREBASE_MODULE_ROOT = "https://www.gstatic.com/firebasejs/10.12.2";
const PRIVATE_STATE_FIELDS = [
  "format",
  "schemaVersion",
  "updatedAt",
  "plan",
  "teacherProgress",
  "checklist",
  "classes",
  "lessonGuides",
  "specialEvents",
  "resources",
  "notes",
  "preferences",
  "tombstones",
  "classroomFacing"
];

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function documentPath(uid) {
  if (typeof uid !== "string" || uid.trim() === "") throw new Error("An authenticated UID is required for private sync");
  return `playbookTeachers/${uid}`;
}

function currentUser(firebase) {
  return firebase?.currentUser?.() ?? null;
}

function unavailableResult(status) {
  return { status, state: null, error: null };
}

export function buildTeacherDocumentPatch(state) {
  const admitted = admitResourceState(state, { source: "local" });
  const privateState = {};
  for (const field of PRIVATE_STATE_FIELDS) {
    if (Object.hasOwn(admitted, field)) privateState[field] = structuredClone(admitted[field]);
  }
  return { playbookPrivateV1: privateState };
}

export function createFirebaseAdapter({ config = null, firebase = null, merge = mergeStates } = {}) {
  const configured = config !== null && config !== undefined;
  const status = !configured ? "not-configured" : firebase ? "ready" : "cloud-blocked";

  async function loadPrivateState() {
    if (status !== "ready") return unavailableResult(status);
    try {
      const remoteState = await firebase.getDocument(documentPath(currentUser(firebase)?.uid));
      return {
        status: "loaded",
        state: remoteState
          ? admitResourceState(remoteState, { source: "authorized-cloud" })
          : null,
        error: null
      };
    } catch (error) {
      return { status: "load-error", state: null, error: errorMessage(error) };
    }
  }

  async function savePrivateState(localState) {
    if (status !== "ready") return unavailableResult(status);
    const path = documentPath(currentUser(firebase)?.uid);
    try {
      const remoteState = await firebase.getDocument(path);
      const merged = merge(localState, remoteState).state;
      await firebase.setDocument(path, buildTeacherDocumentPatch(merged), { merge: true });
      return { status: "saved", state: merged, error: null };
    } catch (error) {
      return { status: "save-error", state: null, error: errorMessage(error) };
    }
  }

  async function authAction(name, ...args) {
    if (status !== "ready") return { status, user: null, error: null };
    try {
      const user = await firebase[name](...args);
      return { status: "authenticated", user: user ?? null, error: null };
    } catch (error) {
      return { status: "auth-error", user: null, error: errorMessage(error) };
    }
  }

  return {
    status,
    signInWithGoogle: () => authAction("signInWithGoogle"),
    signInWithEmail: (email, password) => authAction("signInWithEmail", email, password),
    createEmailAccount: (email, password) => authAction("createEmailAccount", email, password),
    requestPasswordReset: async (email) => {
      if (status !== "ready") return { status, error: null };
      try {
        await firebase.requestPasswordReset(email);
        return { status: "password-reset-sent", error: null };
      } catch (error) {
        return { status: "auth-error", error: errorMessage(error) };
      }
    },
    signOut: async () => {
      if (status !== "ready") return { status, error: null };
      try {
        await firebase.signOut();
        return { status: "signed-out", error: null };
      } catch (error) {
        return { status: "auth-error", error: errorMessage(error) };
      }
    },
    loadPrivateState,
    savePrivateState
  };
}

export async function createBrowserFirebaseDependencies(config) {
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import(`${FIREBASE_MODULE_ROOT}/firebase-app.js`),
    import(`${FIREBASE_MODULE_ROOT}/firebase-auth.js`),
    import(`${FIREBASE_MODULE_ROOT}/firebase-firestore.js`)
  ]);
  const app = appModule.initializeApp(config);
  const auth = authModule.getAuth(app);
  const database = firestoreModule.getFirestore(app);
  const readDocument = async (path) => {
    const snapshot = await firestoreModule.getDoc(firestoreModule.doc(database, path));
    return snapshot.exists() ? snapshot.data().playbookPrivateV1 ?? null : null;
  };

  return {
    currentUser: () => auth.currentUser,
    signInWithGoogle: async () => (await authModule.signInWithPopup(auth, new authModule.GoogleAuthProvider())).user,
    signInWithEmail: async (email, password) => (await authModule.signInWithEmailAndPassword(auth, email, password)).user,
    createEmailAccount: async (email, password) => (await authModule.createUserWithEmailAndPassword(auth, email, password)).user,
    requestPasswordReset: (email) => authModule.sendPasswordResetEmail(auth, email),
    signOut: () => authModule.signOut(auth),
    getDocument: readDocument,
    setDocument: (path, patch, options) => firestoreModule.setDoc(firestoreModule.doc(database, path), patch, options)
  };
}

export async function createBrowserFirebaseAdapter({ config = null, loadDependencies = createBrowserFirebaseDependencies } = {}) {
  if (config === null || config === undefined) return createFirebaseAdapter();
  try {
    const firebase = await loadDependencies(config);
    return createFirebaseAdapter({ config, firebase });
  } catch {
    return createFirebaseAdapter({ config });
  }
}
