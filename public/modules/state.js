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
};

let currentUser = null;


export function getCurrentUser() {
    return currentUser;
}

export function setCurrentUser(user) {
    currentUser = user;
}

export function getUserLanguage() {
    const lang = localStorage.getItem('userLanguage') || 'es';
    console.log('🔍 getUserLanguage - Desde localStorage:', lang);
    return lang;
}

export async function setUserLanguage(lang) {
    console.log('🌐 setUserLanguage llamado con:', lang);

    if (!['es', 'en', 'it'].includes(lang)) {
        console.error('❌ Idioma no válido:', lang);
        return;
    }

    localStorage.setItem('userLanguage', lang);
    console.log('✅ Nuevo idioma guardado en localStorage:', lang);

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
