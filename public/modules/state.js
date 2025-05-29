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
    userLanguage: localStorage.getItem('userLanguage') || 'es'
};

let currentUser = null;

export function getCurrentUser() {
    return currentUser;
}

export function setCurrentUser(user) {
    currentUser = user;
}

export function getUserLanguage() {
    // Siempre verificar localStorage primero
    const storedLanguage = localStorage.getItem('userLanguage');
    if (storedLanguage && storedLanguage !== state.userLanguage) {
        state.userLanguage = storedLanguage;
    }
    console.log('Obteniendo idioma actual:', state.userLanguage);
    return state.userLanguage;
}

export function setUserLanguage(lang) {
    console.log('Estableciendo nuevo idioma:', lang);
    // Validar que el idioma sea válido
    if (!['es', 'en', 'it'].includes(lang)) {
        console.error('Idioma no válido:', lang);
        return;
    }
    state.userLanguage = lang;
    localStorage.setItem('userLanguage', lang);
}
