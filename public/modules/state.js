import { db } from '../modules/firebase.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export const state = {
    currentUser: null,
    currentChat: null,
    verificationCode: null,
    timerInterval: null,
    unsubscribeMessages: null,
    unsubscribeChats: null,
    typingTimeouts: {},
    lastSender: null,
    selectedUsers: new Set(),
    isGroupCreationMode: false,
    recognition: null,
    isRecording: false,
    MESSAGES_PER_BATCH: 20,
    isLoadingMore: false,
    allMessagesLoaded: false,
    lastVisibleMessage: null,
    userLanguage: 'es' // Valor por defecto
};

let currentUser = null;

// Inicializar el idioma desde localStorage si existe
const storedLanguage = localStorage.getItem('userLanguage');
if (storedLanguage) {
    state.userLanguage = storedLanguage;
    console.log('🔄 Idioma inicial cargado desde localStorage:', storedLanguage);
} else {
    localStorage.setItem('userLanguage', state.userLanguage);
    console.log('🔄 Idioma por defecto guardado en localStorage:', state.userLanguage);
}

export function getCurrentUser() {
    return currentUser;
}

export function setCurrentUser(user) {
    currentUser = user;
}

export function getUserLanguage() {
    // Siempre verificar localStorage primero
    const storedLanguage = localStorage.getItem('userLanguage');
    console.log('🔍 getUserLanguage - Idioma en localStorage:', storedLanguage);
    console.log('🔍 getUserLanguage - Idioma en state:', state.userLanguage);
    
    // Si hay un idioma en localStorage y es diferente al del state, actualizar state
    if (storedLanguage && storedLanguage !== state.userLanguage) {
        console.log('🔄 Actualizando state.userLanguage desde localStorage');
        state.userLanguage = storedLanguage;
    }
    // Si no hay idioma en localStorage, guardar el del state
    else if (!storedLanguage) {
        console.log('🔄 Guardando idioma del state en localStorage');
        localStorage.setItem('userLanguage', state.userLanguage);
    }
    
    return state.userLanguage;
}

export async function setUserLanguage(lang) {
    console.log('🌐 setUserLanguage llamado con:', lang);
    console.log('🌐 Idioma anterior en state:', state.userLanguage);
    console.log('🌐 Idioma anterior en localStorage:', localStorage.getItem('userLanguage'));

    if (!['es', 'en', 'it'].includes(lang)) {
        console.error('❌ Idioma no válido:', lang);
        return;
    }

    state.userLanguage = lang;
    localStorage.setItem('userLanguage', lang);

    console.log('✅ Nuevo idioma guardado en state y localStorage:', lang);

    window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));

    const user = getCurrentUser();
    if (user) {
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                language: lang
            });
            console.log('✅ Idioma actualizado en Firestore:', lang);
        } catch (err) {
            console.error('❌ Error al actualizar idioma en Firestore:', err);
        }
    }
}
