// modules/firebase.js
import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';

import { getAuth, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getMessaging, isSupported } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

import { firebaseConfig } from './firebase-config.js'; // ← usa tu archivo actual

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

const db = getFirestore(app);
let messaging = null;
try {
    if (await isSupported()) {
        messaging = getMessaging(app);
    }
} catch (err) {
    console.warn('Firebase Messaging no soportado:', err);
const storage = getStorage(app);

export { app, auth, db, messaging, storage };
