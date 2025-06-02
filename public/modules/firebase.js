// modules/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js';
import { getMessaging } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyBPurWNRib5yjg-jEe3x2hBewL_Cvy132E",
    authDomain: "traduchat-2.firebaseapp.com",
    projectId: "traduchat-2",
    storageBucket: "traduchat-2.appspot.com",
    messagingSenderId: "304746474467",
    appId: "1:304746474467:web:a0496a8d1d891cec170ed6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messaging = getMessaging(app);
const auth = getAuth(app);

export { db, messaging, auth };
