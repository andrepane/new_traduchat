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
    console.log('🔍 getUserLanguage - Idioma en localStorage:', storedLanguage);
    console.log('🔍 getUserLanguage - Idioma en state:', state.userLanguage);
    
    if (storedLanguage && storedLanguage !== state.userLanguage) {
        console.log('🔄 Actualizando state.userLanguage desde localStorage');
        state.userLanguage = storedLanguage;
    }
    
    return state.userLanguage;
}

export function setUserLanguage(lang) {
    console.log('🌐 setUserLanguage llamado con:', lang);
    console.log('🌐 Idioma anterior en state:', state.userLanguage);
    console.log('🌐 Idioma anterior en localStorage:', localStorage.getItem('userLanguage'));
    
    // Validar que el idioma sea válido
    if (!['es', 'en', 'it'].includes(lang)) {
        console.error('❌ Idioma no válido:', lang);
        return;
    }
    
    state.userLanguage = lang;
    localStorage.setItem('userLanguage', lang);
    
    console.log('✅ Nuevo idioma guardado en state y localStorage:', lang);
}
