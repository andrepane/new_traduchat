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

import { setCurrentUser } from './state.js'; // <--- usamos esto en lugar de una variable local

// Esto se puede pasar desde app.js si quieres más flexibilidad
let userLanguage = 'es';

function setUserLanguage(lang) {
    userLanguage = lang;
}

async function logout() {
    try {
        await signOut(auth);
        console.log('Sesión cerrada correctamente');
        setCurrentUser(null); // <- limpiamos el estado al cerrar sesión
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

                setCurrentUser(userData); // <-- actualizamos el estado global
                callback(userData);
            } catch (error) {
                console.error('Error al verificar/crear documento de usuario:', error);
                setCurrentUser(null);
                callback(null);
            }
        } else {
            setCurrentUser(null); // <-- limpiamos el estado
            callback(null);
        }
    });
}

export { startAuthListener, logout, setUserLanguage };
