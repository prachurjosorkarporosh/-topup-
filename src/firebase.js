import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const app = firebase.app();
const auth = firebase.auth();
const db = firebase.firestore();

// Attach named database delegate
try {
  if (firebaseConfig.firestoreDatabaseId) {
    db._delegate = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    console.log("Connected to named Firestore database:", firebaseConfig.firestoreDatabaseId);
  }
} catch(err) {
  console.error("Failed to attach named Firestore database:", err);
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

window.firebase = firebase;
window.firebaseConfig = firebaseConfig;
window.db = db;
window.auth = auth;
let rtdb = null;
try {
  if (firebaseConfig.databaseURL && typeof firebase.database === 'function') {
    rtdb = firebase.database();
  }
} catch(e) {}
window.rtdb = rtdb;
window.handleFirestoreError = handleFirestoreError;
window.OperationType = OperationType;

export { firebase, db, auth, rtdb, firebaseConfig, handleFirestoreError, OperationType };
