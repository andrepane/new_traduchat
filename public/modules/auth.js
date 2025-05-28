import { auth, db } from './firebase.js';
import {
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Esto se puede pasar desde app.js si quieres más flexibilidad
let userLanguage = 'es';

let currentUser = null;

function getCurrentUser() {
    return currentUser;
}

function setUserLanguage(lang) {
    userLanguage = lang;
}

async function logout() {
    try {
        await signOut(auth);
        console.log('Sesión cerrada correctamente');
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
}

function startAuthListener(callback) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);

                let userData = {
                    uid: user.uid,
                    email: user.email.toLowerCase(),
                };

                if (userDoc.exists()) {
                    userData = { ...userData, ...userDoc.data() };
                } else {
                    console.log('Creando documento de usuario...');
                    await setDoc(userDocRef, {
                        uid: user.uid,
                        email: user.email.toLowerCase(),
                        language: userLanguage,
                        createdAt: serverTimestamp(),
                        lastUpdated: serverTimestamp()
                    });
                    console.log('Documento de usuario creado exitosamente');
                }

                currentUser = userData;
                callback(userData);
            } catch (error) {
                console.error('Error al verificar/crear documento de usuario:', error);
                callback(null);
            }
        } else {
            currentUser = null;
            callback(null);
        }
    });
}

export { startAuthListener, getCurrentUser, logout, setUserLanguage };
