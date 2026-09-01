import { createPrivateCloudSync, safeCloudFailureStatus } from "./cloud-sync.js";
import { createRoomSyncClient } from "./room-sync.js";

const FIREBASE_MODULE_ROOT = "https://www.gstatic.com/firebasejs/10.12.2";

function normalizeUser(user) {
  if (user === null || user === undefined) return null;
  if (typeof user.uid !== "string" || user.uid.trim() === "" || user.uid.includes("/") || user.uid.includes("\\")) {
    return null;
  }
  return {
    uid: user.uid,
    displayName: typeof user.displayName === "string" ? user.displayName : null,
    email: typeof user.email === "string" ? user.email : null
  };
}

function lifecycleClient(status) {
  const unavailable = async () => ({ status });
  const unavailableMember = async () => ({ status, membership: null, room: null });
  const unavailableInvite = async () => ({ status, membership: null });
  const unavailableArtifact = async () => ({
    status,
    revision: null,
    value: null,
    projectProgress: null
  });
  return {
    status,
    observeAuth(listener) {
      if (typeof listener === "function") listener(null);
      return () => {};
    },
    signInWithGoogle: unavailable,
    signOut: unavailable,
    loadPrivateDomains: async () => ({ status, domains: null, revisions: null, updatedAt: null }),
    savePrivateDomain: async () => ({ status, revision: null, value: null }),
    verifyPrivateDomain: async () => ({ status, revision: null, value: null }),
    createTenantRoom: unavailable,
    loadRoomMembership: unavailableMember,
    loadSharedArtifact: unavailableArtifact,
    redeemRoomInvite: unavailableInvite,
    saveSharedArtifact: unavailableArtifact
  };
}

function safeAuthFailureStatus(error) {
  const code = typeof error?.code === "string" ? error.code.toLowerCase() : "";
  if (code.includes("popup-blocked")) return "popup-blocked";
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) return "popup-closed";
  if (code.includes("unauthorized-domain")) return "unauthorized-domain";
  return safeCloudFailureStatus(error);
}

export function createFirebaseClient({ config = null, firebase = null, crypto = globalThis.crypto } = {}) {
  if (config === null || config === undefined) return lifecycleClient("not-configured");
  if (firebase === null || firebase === undefined) return lifecycleClient("cloud-blocked");
  const privateSync = createPrivateCloudSync(firebase);
  const roomSync = createRoomSyncClient({ firebase, crypto });

  return {
    status: "ready",
    observeAuth(listener) {
      if (typeof listener !== "function") return () => {};
      try {
        const unsubscribe = firebase.observeAuth((user) => listener(normalizeUser(user)));
        return typeof unsubscribe === "function" ? unsubscribe : () => {};
      } catch {
        listener(null);
        return () => {};
      }
    },
    async signInWithGoogle() {
      try {
        await firebase.signInWithPopup();
        return { status: "pending" };
      } catch (error) {
        return { status: safeAuthFailureStatus(error) };
      }
    },
    async signOut() {
      try {
        await firebase.signOut();
        return { status: "signed-out" };
      } catch (error) {
        return { status: safeCloudFailureStatus(error) };
      }
    },
    ...privateSync,
    ...roomSync
  };
}

async function createBrowserFirebaseDependencies(config) {
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import(`${FIREBASE_MODULE_ROOT}/firebase-app.js`),
    import(`${FIREBASE_MODULE_ROOT}/firebase-auth.js`),
    import(`${FIREBASE_MODULE_ROOT}/firebase-firestore.js`)
  ]);
  const app = appModule.initializeApp(config);
  const auth = authModule.getAuth(app);
  const database = firestoreModule.getFirestore(app);

  function reference(path) {
    return firestoreModule.doc(database, path);
  }

  function dataFromSnapshot(snapshot) {
    return snapshot.exists() ? snapshot.data() : null;
  }

  return {
    currentUser: () => auth.currentUser,
    observeAuth: (listener) => authModule.onAuthStateChanged(auth, listener, () => listener(null)),
    signInWithPopup: () => authModule.signInWithPopup(auth, new authModule.GoogleAuthProvider()),
    signOut: () => authModule.signOut(auth),
    serverTimestamp: () => firestoreModule.serverTimestamp(),
    async getDocument(path) {
      return dataFromSnapshot(await firestoreModule.getDoc(reference(path)));
    },
    runTransaction(callback) {
      return firestoreModule.runTransaction(database, (transaction) => callback({
        async get(path) {
          return dataFromSnapshot(await transaction.get(reference(path)));
        },
        set(path, value) {
          transaction.set(reference(path), value);
        }
      }));
    }
  };
}

export async function createBrowserFirebaseClient(
  config,
  { loadDependencies = createBrowserFirebaseDependencies, crypto = globalThis.crypto } = {}
) {
  if (config === null || config === undefined) return createFirebaseClient();
  try {
    const firebase = await loadDependencies(config);
    return createFirebaseClient({ config, firebase, crypto });
  } catch {
    return createFirebaseClient({ config });
  }
}
