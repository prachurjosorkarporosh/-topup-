import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import { initializeFirestore, getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const app = firebase.app();
const auth = firebase.auth();
const db = firebase.firestore();

// Enable long-polling & robust network transport in iframe / restricted networks
try {
  if (firebaseConfig.firestoreDatabaseId) {
    const namedDb = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      useFetchStreams: false,
    }, firebaseConfig.firestoreDatabaseId);
    db._delegate = namedDb;
    console.log("Connected to named Firestore database with auto long-polling:", firebaseConfig.firestoreDatabaseId);
  }
} catch(err) {
  try {
    if (firebaseConfig.firestoreDatabaseId) {
      db._delegate = getFirestore(app, firebaseConfig.firestoreDatabaseId);
      console.log("Connected to named Firestore database:", firebaseConfig.firestoreDatabaseId);
    }
  } catch(innerErr) {
    console.warn("Firestore named database attachment warning:", innerErr);
  }
}

// Error handler helper according to skill
const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser ? auth.currentUser.uid : null,
      email: auth.currentUser ? auth.currentUser.email : null,
      emailVerified: auth.currentUser ? auth.currentUser.emailVerified : null,
      isAnonymous: auth.currentUser ? auth.currentUser.isAnonymous : null,
      tenantId: auth.currentUser ? auth.currentUser.tenantId : null,
      providerInfo: auth.currentUser && auth.currentUser.providerData ? auth.currentUser.providerData.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) : []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test according to skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'settings', 'general'));
    console.log("Firestore connection verified successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

const globalScope = typeof window !== 'undefined' ? window : globalThis;
globalScope.firebase = firebase;
globalScope.firebaseConfig = firebaseConfig;
globalScope.db = db;
globalScope.auth = auth;
let rtdb = null;
try {
  if (firebaseConfig.databaseURL && typeof firebase.database === 'function') {
    rtdb = firebase.database();
  }
} catch(e) {}
globalScope.rtdb = rtdb;
globalScope.handleFirestoreError = handleFirestoreError;
globalScope.OperationType = OperationType;

export { firebase, db, auth, rtdb, firebaseConfig, handleFirestoreError, OperationType };
