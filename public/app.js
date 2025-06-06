import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    serverTimestamp,
    getDocs,
    getDoc,
    doc,
    orderBy,
    setDoc,
    updateDoc,
    initializeFirestore,
    getFirestore,
    limit,
    startAfter,
    writeBatch,
    arrayUnion,
    Timestamp,
    getCountFromServer,
    deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';

import { translations, getTranslation, translateInterface, animateTitleWave, getTypingText, getTypingMessage } from './translations.js';
import { translateText, getFlagEmoji, AVAILABLE_LANGUAGES } from './translation-service.js';

import { auth } from './modules/firebase.js'; // Esto lo importa de forma limpia y segura
import { state } from './modules/state.js';
import { startAuthListener, setUserLanguage } from './modules/auth.js';

import { initializeNotifications } from './modules/notificaciones.js';

import {
    getUserLanguage,
    getCurrentUser
} from './modules/state.js';



let userLanguage = getUserLanguage();

setUserLanguage(userLanguage);

window.addEventListener('languageChanged', (e) => {
    userLanguage = e.detail;
});

startAuthListener(async (userData) => {
    if (userData) {
        console.log('Usuario autenticado:', userData.email);
        console.log('User ID:', userData.uid);
        currentUser = userData;

        resetChatState();
        hideLoadingScreen();
        showMainScreen();
        updateUserInfo(userData);
        setupRealtimeChats(chatList, 'individual');
        initializeNotifications(); // Aquí está bien colocada
    } else {
        console.log('No hay usuario autenticado');
        currentUser = null;
        resetChatState();
        hideLoadingScreen();
        showAuthScreen();
    }
});






// Verificar inicialización de Firebase

// Obtener la instancia de Firebase Messaging
let messaging;
try {
    messaging = window.messaging;
    console.log('Firebase Messaging obtenido correctamente');
} catch (error) {
    console.log('Firebase Messaging no está soportado en este navegador');
}

// Referencias a elementos del DOM
const authScreen = document.getElementById('authScreen');
const mainScreen = document.getElementById('mainScreen');
const emailInput = document.getElementById('emailInput');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const phoneInput = document.getElementById('phoneNumber');
const countrySelect = document.getElementById('countryCode');
const loginBtn = document.getElementById('loginBtn');
const chatList = document.getElementById('chatList');
const groupsListEl = document.getElementById('groupsList');
const groupsPage = document.getElementById('groupsPage');
const settingsPage = document.getElementById('settingsPage');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessage');
const messagesList = document.getElementById('messagesList');
const searchInput = document.getElementById('searchContacts');
const newChatBtn = document.getElementById('newChat');
const userInfo = document.getElementById('userInfo');
const currentChatInfo = document.getElementById('currentChatInfo');

const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');

// Referencias adicionales para móvil
const backButton = document.getElementById('backToChats');
const addMembersBtn = document.getElementById('addMembersBtn');
const sidebar = document.querySelector('.sidebar');

// Variables globales
let languageSelect;
let languageSelectMain;
let currentUser = null;
let currentChat = null;
let currentChatParticipants = [];
let verificationCode = null;
let timerInterval = null;
const CODE_EXPIRY_TIME = 5 * 60; // 5 minutos en segundos
let unsubscribeMessagesFn = null; // Variable para almacenar la función de cancelación de suscripción
let typingTimeouts = {};
let lastSender = null;
let unsubscribeChats = null;
let initialLoadComplete = false; // Variable para controlar la carga inicial de mensajes
let currentListType = 'individual';
let inMemoryReadTimes = {};
let chatsSnapshotVersion = 0; // Controlar versiones de snapshots para evitar duplicados

// Variables para grupos
let selectedUsers = new Set();
let isGroupCreationMode = false;

// Si se habilita, las notificaciones push se enviarán tanto
// desde el cliente como desde las Cloud Functions, pudiendo
// producir duplicados. Mantener en "true" para forzar los
// envíos manuales de notificación.
// Se vuelve a habilitar para asegurar envíos desde el cliente cuando
// las Cloud Functions no estén disponibles. Las notificaciones se
// deduplican por `messageId` en el Service Worker.
const manualPushNotifications = true;


// Variables para grabación de audio
let isRecording = false;

// Texto a voz
let currentUtterance = null;
let availableVoices = [];
if ('speechSynthesis' in window) {
    availableVoices = window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
        availableVoices = window.speechSynthesis.getVoices();
    };
}

function speakText(text, lang) {
    if (!('speechSynthesis' in window)) return;
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const voice = availableVoices.find(v => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
    if (voice) utterance.voice = voice;
    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

function createSpeakButton(text, lang) {
    const btn = document.createElement('button');
    btn.className = 'speech-bubble-button';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Escuchar');
    btn.tabIndex = 0;
    btn.innerHTML = `
        <svg class="icon-volume" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 9v6h4l5 5V4l-5 5H3z"></path>
            <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-1.01 7-4.63 7-8.77s-2.99-7.76-7-8.77z"></path>
        </svg>`;
    btn.addEventListener('click', () => speakText(text, lang));
    return btn;
}

function refreshSpeakButtons() {
    const lang = document.getElementById('languageSelect')?.value ||
                 document.getElementById('languageSelectMain')?.value ||
                 getUserLanguage();
    document.querySelectorAll('.message:not(.system-message)').forEach(el => {
        const textSpan = el.querySelector('.message-text');
        const timeSpan = el.querySelector('.message-time');
        const content = el.querySelector('.message-content');
        if (!textSpan || !timeSpan || !content) return;
        const existing = el.querySelector('.speech-bubble-button');
        if (existing) existing.remove();
        const btn = createSpeakButton(textSpan.textContent, lang);
        content.insertBefore(btn, timeSpan);
    });
}

window.addEventListener('languageChanged', refreshSpeakButtons);


// Variables para paginación
const MESSAGES_PER_BATCH = 20; // Número de mensajes a cargar por lote
let isLoadingMore = false;
let allMessagesLoaded = false;
let lastVisibleMessage = null;
let lastProcessedMessageId = null; // Variable para evitar duplicados

// Enviar notificaciones push a los participantes de un chat
// Esta función quedó obsoleta ya que las notificaciones se manejan
// mediante Cloud Functions al crear cada mensaje. Se mantiene por si se
// requieren envíos manuales en el futuro, pero no se invoca desde el cliente.
async function sendPushNotifications(chatData, messageText, chatId, messageId) {
    try {
        const sender = getCurrentUser();
        if (!sender) return;
        const senderName = sender.username || sender.email.split('@')[0] || 'Usuario';

        const recipientIds = (chatData.participants || []).filter(uid => uid !== sender.uid);
        if (recipientIds.length === 0) return;

        const recipientDocs = await Promise.all(
            recipientIds.map(uid => getDoc(doc(db, 'users', uid)))
        );

        const tokens = Array.from(new Set(
            recipientDocs
                .filter(snap => snap.exists())
                .map(snap => snap.data().fcmToken)
                .filter(Boolean)
        ));

        await Promise.all(tokens.map(token =>
            fetch('/api/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    title: `Nuevo mensaje de ${senderName}`,
                    body: messageText,
                    data: { chatId, messageId }
                })
            })
        ));
    } catch (err) {
        console.error('Error enviando notificaciones:', err);
    }
}



// Función para generar un código aleatorio de 6 dígitos
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Función para formatear el tiempo
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Función para iniciar el temporizador
function startTimer(duration) {
    let timeLeft = duration;
    timerElement.textContent = getTranslation('codeValidFor', getUserLanguage(), formatTime(timeLeft));
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        timerElement.textContent = getTranslation('codeValidFor', getUserLanguage(), formatTime(timeLeft));
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            verificationCode = null;
            resendCodeBtn.disabled = false;
            timerElement.textContent = getTranslation('codeExpired', getUserLanguage());
        }
    }, 1000);
}

// Función para simular el envío de SMS
function simulateSendSMS(phoneNumber, code) {
    console.log(`Código enviado a ${phoneNumber}: ${code}`);
    // En una implementación real, aquí se llamaría a un servicio de SMS
    showToast(getTranslation('demoVerificationCode', getUserLanguage(), code));
}

// Función para enviar el código vía API
async function sendVerificationCode(phoneNumber) {
    try {
        const response = await fetch('/api/send-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phoneNumber })
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message);
        }

        return true;
    } catch (error) {
        console.error('Error al enviar código:', error);
        showToast(getTranslation('errorSendingCode', getUserLanguage(), error.message));
        return false;
    }
}

// Función para verificar el código vía API
async function verifyCode(phoneNumber, code) {
    try {
        const response = await fetch('/api/verify-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phoneNumber, code })
        });

        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Error al verificar código:', error);
        showToast(getTranslation('errorVerifyingCode', getUserLanguage(), error.message));
        return false;
    }
}

// Función para mostrar mensajes de error
function showToast(message) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}
window.showToast = showToast;

function showError(errorKey) {
    showToast(getTranslation(errorKey, getUserLanguage()));
}

// Función para actualizar la información del usuario
function updateUserInfo(user) {
    if (!user) {
        console.warn('updateUserInfo: usuario no definido');
        return;
    }

    const name = user.username || user.email?.split('@')[0] || 'Usuario';
    const settingsUsername = document.getElementById('settingsUsername');
    if (settingsUsername) {
        settingsUsername.value = name;
        settingsUsername.setAttribute('readonly', true);
    }
}


// Función para actualizar el tema según el idioma
function updateTheme(lang) {
    // Remover cualquier clase de idioma existente
    document.body.classList.forEach(cls => {
        if (cls.startsWith('theme-')) {
            document.body.classList.remove(cls);
        }
    });
    // Agregar la nueva clase de idioma
    document.body.classList.add(`theme-${lang}`);
}

// Manejadores de eventos para el cambio de idioma
if (languageSelect) languageSelect.value = userLanguage;
if (languageSelectMain) languageSelectMain.value = userLanguage;

// Obtener idioma desde state


// Sincronizar selects de idioma
if (languageSelect) languageSelect.value = userLanguage;
if (languageSelectMain) languageSelectMain.value = userLanguage;




// Función de login/registro
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim().toLowerCase();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Validaciones básicas
    if (!email || !password || !username) {
        showError('errorEmptyFields');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('errorInvalidEmail');
        return;
    }

    if (password.length < 6) {
        showError('errorPassword');
        return;
    }

    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(username)) {
        showToast(getTranslation('errorUsernameChars', getUserLanguage()));
        return;
    }

    try {
        console.log('Iniciando proceso de login/registro...');

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('Login exitoso:', userCredential.user.uid);

            const userDocRef = doc(db, 'users', userCredential.user.uid);
            await setDoc(userDocRef, {
                email: email,
                username: username,
                lastLogin: serverTimestamp()
            }, { merge: true });

            return;
        } catch (loginError) {
            console.log('Fallo al iniciar sesión:', loginError.code);

            if (loginError.code === 'auth/user-not-found' || loginError.code === 'auth/invalid-credential') {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateUserData(userCredential.user, username, true);
                console.log('Usuario creado correctamente:', userCredential.user.uid);
                return;
            } else if (loginError.code === 'auth/wrong-password') {
                showError('errorPassword');
            } else {
                throw loginError;
            }
        }
    } catch (error) {
        console.error('Error completo:', error);
        switch (error.code) {
            case 'auth/email-already-in-use':
                showError('errorEmailInUse');
                break;
            case 'auth/invalid-email':
                showError('errorInvalidEmail');
                break;
            case 'auth/network-request-failed':
                showError('errorNetwork');
                break;
            case 'auth/too-many-requests':
                showToast(getTranslation('errorTooManyAttempts', getUserLanguage()));
                break;
            default:
                showError('errorGeneric');
        }
    }
});

function updateUITranslations() {
    translateInterface(getUserLanguage());

    const currentUser = getCurrentUser();
    if (currentUser) {
        updateUserInfo(currentUser);
    } else {
        console.log('updateUITranslations: usuario no disponible aún');
    }
}




// Función auxiliar para actualizar datos de usuario
async function updateUserData(user, username, isNewUser) {
    
    try {
        // Verificar si el nombre de usuario está disponible
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const currentData = userDoc.data();
            if (currentData.username !== username) {
                // Verificar si el nuevo nombre de usuario está disponible
                const usernameQuery = query(
                    collection(db, 'users'),
                    where('username', '==', username)
                );
                const usernameSnapshot = await getDocs(usernameQuery);
                
                if (!usernameSnapshot.empty) {
                    await signOut(auth); // Cerrar sesión si el nombre de usuario no está disponible
                    showError('errorUsernameInUse');
                    return;
                }
            }
        }

        // Preparar datos del usuario
        const userData = {
            uid: user.uid,
            email: user.email.toLowerCase(),
            username: username,
            language: userLanguage,
            lastUpdated: serverTimestamp()
        };

        if (isNewUser) {
            userData.createdAt = serverTimestamp();
        }

        console.log('Guardando datos en Firestore para usuario:', user.uid);
        console.log('Datos a guardar:', userData);
        
        // Guardar datos del usuario
        await setDoc(userDocRef, userData, { merge: true });  
        console.log('Datos guardados exitosamente en Firestore');

        // Verificar que se guardó correctamente
        const savedDoc = await getDoc(userDocRef);
        if (!savedDoc.exists()) {
            throw new Error('No se pudo verificar el documento del usuario');
        }
        console.log('Documento guardado:', savedDoc.data());

        // Actualizar la interfaz
        localStorage.setItem('userLanguage', userLanguage);
        showMainScreen();
        updateUserInfo({...user, username});
        setupRealtimeChats(chatList, 'individual');
    } catch (error) {
        console.error('Error al actualizar datos del usuario:', error);
        if (error.code === 'permission-denied') {
            // Si es un error de permisos pero el usuario está autenticado, continuar
            showMainScreen();
            updateUserInfo({...user, username});
            setupRealtimeChats(chatList, 'individual');
        } else {
            throw error;
        }
    }
}

// Función para mostrar la pantalla de autenticación
function showAuthScreen() {
    document.getElementById('mainScreen').classList.remove('active');
    document.getElementById('authScreen').classList.add('active');
    document.body.classList.remove('in-chat');
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Cargado');
    showLoadingScreen();

    if (!auth || !db) {
        console.error('Auth o Firestore no están inicializados');
        hideLoadingScreen();
        showError('errorGeneric');
        return;
    }

    const languageSelect = document.getElementById('languageSelect');
    const languageSelectMain = document.getElementById('languageSelectMain');

    // Inicializar el tema según el idioma actual
    const currentLang = getUserLanguage();
    document.body.classList.add(`theme-${currentLang}`);

    const handleLanguageChange = async (newLang) => {
        console.log('🔄 handleLanguageChange llamado con:', newLang);

        // Detener cualquier reconocimiento de voz activo
        if (recognition) {
            stopRecording();
        }

        // Actualizar el tema con el nuevo idioma
        const currentTheme = localStorage.getItem("selectedTheme") || "banderas";
        updateThemeAndLanguage(currentTheme, newLang);

        await setUserLanguage(newLang);
        translateInterface(newLang);

        // Sincronizar selectores de idioma
        if (languageSelect) languageSelect.value = newLang;
        if (languageSelectMain) languageSelectMain.value = newLang;

        // Actualizar traducciones en la búsqueda
        const searchInput = document.getElementById('searchContacts');
        if (searchInput) {
            searchInput.placeholder = getTranslation('searchPlaceholder', newLang);
            // Si hay resultados de búsqueda activos, actualizarlos
            if (searchInput.value.trim()) {
                searchUsers(searchInput.value.trim());
            }
        }

        // Actualizar la lista de chats
        if (chatList) {
            setupRealtimeChats(chatList, 'individual');
        }

        // Actualizar mensajes si hay un chat activo
        if (currentChat) {
            messagesList.innerHTML = '';
            lastVisibleMessage = null;
            allMessagesLoaded = false;
            await loadInitialMessages(currentChat);
        }

        const currentUser = getCurrentUser();
        if (currentUser) {
            try {
                const userRef = doc(db, 'users', currentUser.uid);
                await updateDoc(userRef, {
                    language: newLang,
                    lastUpdated: serverTimestamp()
                });
                console.log('✅ Idioma actualizado en Firestore');
            } catch (error) {
                console.error('❌ Error al guardar idioma en Firestore:', error);
                showError('errorGeneric');
            }
        }

        // Asegurar que el tema final coincida con el idioma seleccionado
        updateThemeAndLanguage(currentTheme, newLang);

        // Disparar evento personalizado de cambio de idioma
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: newLang }));
    };

    if (languageSelect) languageSelect.addEventListener('change', (e) => handleLanguageChange(e.target.value));
    if (languageSelectMain) languageSelectMain.addEventListener('change', (e) => handleLanguageChange(e.target.value));

    // 🔐 Autenticación y gestión de idioma
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('👤 Usuario autenticado:', user.uid);

            try {
                const userRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userRef);

                let lang = 'es';
                if (userDoc.exists()) {
                    lang = userDoc.data().language || 'es';
                    console.log('🌐 Idioma cargado desde Firestore:', lang);
                } else {
                    console.warn('⚠️ Usuario sin idioma en Firestore. Usando idioma local');
                    lang = getUserLanguage();
                }

                setUserLanguage(lang);
                translateInterface(lang);
                // Asegurarnos de que el tema se actualice con el idioma correcto
                updateTheme(lang);
                if (languageSelect) languageSelect.value = lang;
                if (languageSelectMain) languageSelectMain.value = lang;

                showMainScreen();
            } catch (error) {
                console.error('❌ Error cargando idioma:', error);
                showError('errorGeneric');
            }

        } else {
            console.log('🚪 Usuario no autenticado');
            const lang = getUserLanguage();
            setUserLanguage(lang);
            translateInterface(lang);
            // Actualizar el tema incluso cuando no hay usuario autenticado
            updateTheme(lang);

            if (languageSelect) languageSelect.value = lang;
            if (languageSelectMain) languageSelectMain.value = lang;

            showAuthScreen();
        }

        hideLoadingScreen();
    });

    // Inicializar selectores de tema
    const themeSelect = document.getElementById("themeSelect");
    const themeSelectMain = document.getElementById("themeSelectMain");

    // Restaurar tema guardado
    const savedTheme = localStorage.getItem("selectedTheme") || "banderas";
    const initialLang = getUserLanguage();

    // Aplicar tema inicial
    updateThemeAndLanguage(savedTheme, initialLang);

    // Event listener para el selector de tema en la pantalla de inicio
    if (themeSelect) {
        themeSelect.addEventListener("change", () => {
            const selectedTheme = themeSelect.value;
            const lang = getUserLanguage();
            updateThemeAndLanguage(selectedTheme, lang);
        });
    }

    // Event listener para el selector de tema en ajustes
    if (themeSelectMain) {
        themeSelectMain.addEventListener("change", () => {
            const selectedTheme = themeSelectMain.value;
            const lang = getUserLanguage();
            updateThemeAndLanguage(selectedTheme, lang);
        });
    }
});


// Funciones de UI mejoradas
function showLoadingScreen() {
    document.querySelector('.loading-screen').style.display = 'flex';
}

function hideLoadingScreen() {
    document.querySelector('.loading-screen').style.display = 'none';
}

// Función para ajustar el diseño en móvil
function adjustMobileLayout() {
    // Añadir meta viewport para evitar zoom en inputs
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
        viewportMeta = document.createElement('meta');
        viewportMeta.name = 'viewport';
        document.head.appendChild(viewportMeta);
    }
    viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

    // Ajustar scroll en mensajes cuando aparece el teclado
    if (window.innerWidth <= 768) {
        const messagesList = document.querySelector('.messages-list');
        if (messagesList) {
            setTimeout(() => {
                messagesList.scrollTop = messagesList.scrollHeight;
            }, 100);
        }
    }
}

// Asegurarse de que el teclado virtual no cause problemas
window.addEventListener('resize', () => {
    if (window.innerWidth <= 768) {
        const messagesList = document.querySelector('.messages-list');
        if (messagesList) {
            setTimeout(() => {
                messagesList.scrollTop = messagesList.scrollHeight;
            }, 100);
        }
    }
});

// Prevenir zoom en inputs en iOS
document.addEventListener('gesturestart', function(e) {
    e.preventDefault();
});

// Función para actualizar el tema y el idioma
function updateThemeAndLanguage(theme, lang) {
    // Limpiar todas las clases de tema e idioma
    document.body.classList.forEach(cls => {
        if (cls.startsWith('theme-set-') || cls.startsWith('theme-')) {
            document.body.classList.remove(cls);
        }
    });

    // Aplicar el nuevo tema y el idioma
    document.body.classList.add(`theme-set-${theme}`);
    document.body.classList.add(`theme-${lang}`);

    // Guardar tema en localStorage
    localStorage.setItem("selectedTheme", theme);

    // Actualizar TODOS los selectores de tema si existen
    const themeSelect = document.getElementById("themeSelect");
    const themeSelectMain = document.getElementById("themeSelectMain");
    if (themeSelect) themeSelect.value = theme;
    if (themeSelectMain) themeSelectMain.value = theme;

    // Actualizar TODOS los selectores de idioma si existen
    const languageSelect = document.getElementById("languageSelect");
    const languageSelectMain = document.getElementById("languageSelectMain");
    if (languageSelect) languageSelect.value = lang;
    if (languageSelectMain) languageSelectMain.value = lang;
}

// Función para mostrar la pantalla principal
function showMainScreen() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('mainScreen').classList.add('active');
    toggleChatList(true);
    
    // Inicializar el selector de tema
    const themeSelectMain = document.getElementById("themeSelectMain");
    if (themeSelectMain) {
        // Restaurar tema guardado
        const savedTheme = localStorage.getItem("selectedTheme") || "banderas";
        const currentLang = getUserLanguage();
        updateThemeAndLanguage(savedTheme, currentLang);

        themeSelectMain.addEventListener("change", () => {
            const selectedTheme = themeSelectMain.value;
            const currentLang = document.getElementById("languageSelectMain").value || "es";
            
            // Guardar en localStorage
            localStorage.setItem("selectedTheme", selectedTheme);
            
            // Actualizar tema e idioma
            updateThemeAndLanguage(selectedTheme, currentLang);
        });
    }
}

// Función para limpiar el estado del chat
function resetChatState() {
    console.log('🔄 Reseteando estado del chat');
    
    // Cancelar todas las suscripciones
    if (unsubscribeMessagesFn) {
        unsubscribeMessagesFn();
        unsubscribeMessagesFn = null;
    }
    
    if (unsubscribeChats) {
        unsubscribeChats();
        unsubscribeChats = null;
    }

    if (unsubscribeTypingStatus) {
        unsubscribeTypingStatus();
        unsubscribeTypingStatus = null;
    }
    
    // Limpiar UI
    if (messagesList) {
        messagesList.innerHTML = '';
    }
    
    if (messageInput) {
        messageInput.value = '';
    }
    
    if (currentChatInfo) {
        currentChatInfo.textContent = getTranslation('selectChat', userLanguage);
    }
    
    if (chatList) {
        chatList.innerHTML = '';
    }
    
    // Ocultar indicador de escritura y limpiar estado de escritura remoto
    hideTypingIndicator();
    setTypingStatus(false);

    // Limpiar estado
    currentChat = null;
    lastSender = null;
    lastProcessedMessageId = null;
    initialLoadComplete = false;
    allMessagesLoaded = false;
    lastVisibleMessage = null;
    
    console.log('✅ Estado del chat reseteado completamente');
}

// Función para borrar un chat
async function deleteChat(chatId) {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            console.error('No hay usuario autenticado');
            return;
        }

        // Obtener referencia al chat
        const chatRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);

        if (!chatDoc.exists()) {
            console.error('Chat no encontrado');
            return;
        }

        // Borrar todos los mensajes del chat
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const messagesSnapshot = await getDocs(messagesRef);
        const batch = writeBatch(db);

        messagesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Borrar el chat
        batch.delete(chatRef);

        // Ejecutar el batch
        await batch.commit();

        // Mostrar mensaje de éxito
        showToast(getTranslation('chatDeleted', getUserLanguage()));

    } catch (error) {
        console.error('Error al borrar chat:', error);
        showError('errorGeneric');
    }
}

// Función para mostrar el diálogo de confirmación
function showDeleteConfirmDialog(chatId, chatElement) {
    const currentLang = getUserLanguage();
    
    // Crear el backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    
    // Crear el diálogo
    const dialog = document.createElement('div');
    dialog.className = 'delete-confirm-dialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <p>${getTranslation('deleteChatConfirm', currentLang)}</p>
            <div class="dialog-buttons">
                <button class="cancel-delete" aria-label="${getTranslation('cancel', currentLang)}">${getTranslation('cancel', currentLang)}</button>
                <button class="confirm-delete" aria-label="${getTranslation('deleteChat', currentLang)}">${getTranslation('deleteChat', currentLang)}</button>
            </div>
        </div>
    `;

    // Añadir eventos
    const cancelBtn = dialog.querySelector('.cancel-delete');
    const confirmBtn = dialog.querySelector('.confirm-delete');

    cancelBtn.addEventListener('click', () => {
        backdrop.remove();
    });

    confirmBtn.addEventListener('click', async () => {
        chatElement.classList.add('deleting');
        backdrop.remove();
        await deleteChat(chatId);
    });

    // Añadir al DOM
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    // Cerrar al hacer clic fuera
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            backdrop.remove();
        }
    });
}

// Función para cargar chats en tiempo real
async function setupRealtimeChats(container = chatList, chatType = null) {
    console.log('🔄 Configurando escucha de chats en tiempo real');

    if (unsubscribeChats) {
        unsubscribeChats();
        unsubscribeChats = null;
    }

    if (container) {
        container.innerHTML = '';
    }

    const currentUser = getCurrentUser();
    const currentLang = document.getElementById('languageSelect')?.value ||
                       document.getElementById('languageSelectMain')?.value ||
                       getUserLanguage();

    if (!db || !currentUser) {
        console.error('❌ Firestore o usuario no inicializados');
        if (container) {
            container.innerHTML = `<div class="chat-item error">${getTranslation('errorLoadingChats', currentLang)}</div>`;
        }
        return;
    }

    try {
        const constraints = [where('participants', 'array-contains', currentUser.uid)];
        if (chatType) {
            constraints.push(where('type', '==', chatType));
        }

        const q = query(collection(db, 'chats'), ...constraints);

        unsubscribeChats = onSnapshot(q, async (snapshot) => {
            const snapshotVersion = ++chatsSnapshotVersion;
            try {

                if (snapshot.empty) {
                    if (container) {
                        const noChatsDiv = document.createElement('div');
                        noChatsDiv.className = 'chat-item';
                        noChatsDiv.setAttribute('data-translate', 'noChats');
                        noChatsDiv.textContent = getTranslation('noChats', currentLang);
                        container.appendChild(noChatsDiv);
                    }
                    return;
                }

                const readTimes = getChatReadTimes();

                const chats = await Promise.all(snapshot.docs.map(async docSnap => {
                    const data = docSnap.data();
                    let name = '';
                    if (data.type === 'group') {
                        name = data.name;
                    } else {
                        const otherId = data.participants.find(id => id !== currentUser.uid);
                        if (otherId) {
                            const otherDoc = await getDoc(doc(db, 'users', otherId));
                            if (otherDoc.exists()) {
                                const od = otherDoc.data();
                                name = od.username || od.email.split('@')[0];
                            }
                        }
                    }

                    const lastMsgTime = data.lastMessageTime ? data.lastMessageTime.toDate() : new Date(0);
                    const unread = lastMsgTime.getTime() > (readTimes[docSnap.id] || 0);

                    let unreadCount = 0;
                    if (unread) {
                        try {
                            const countQuery = query(
                                collection(db, 'chats', docSnap.id, 'messages'),
                                where('timestamp', '>', Timestamp.fromMillis(readTimes[docSnap.id] || 0)),
                                where('senderId', '!=', currentUser.uid)
                            );
                            const countSnap = await getCountFromServer(countQuery);
                            unreadCount = countSnap.data().count || 0;
                        } catch (err) {
                            console.error('Error counting unread messages:', err);
                        }
                    }

                    return {
                        id: docSnap.id,
                        name,
                        isUnread: unread,
                        unreadCount,
                        lastMessageTime: lastMsgTime,
                        lastMessage: data.lastMessage || '',
                        type: data.type,
                        participants: data.participants
                    };
                }));
                if (snapshotVersion !== chatsSnapshotVersion) {
                    return;
                }

                if (container) container.innerHTML = "";

                chats.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

                for (const chat of chats) {
                    const chatElement = document.createElement('div');
                    chatElement.className = 'chat-item';
                    chatElement.setAttribute('data-chat-id', chat.id);

                    if (chat.type === 'group') chatElement.classList.add('group-chat');
                    if (chat.id === currentChat) chatElement.classList.add('active');
                    if (chat.isUnread) chatElement.classList.add('unread', 'chat-updated');

                    const lastTime = chat.lastMessageTime ?
                        chat.lastMessageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                    const unreadBadge = chat.unreadCount > 0 ? `<div class="unread-badge">${chat.unreadCount}</div>` : '';

                    chatElement.innerHTML = `
                        <div class="chat-info">
                            <div class="chat-details">
                                <div class="chat-name">${chat.name}</div>
                                <div class="last-message">${chat.lastMessage}</div>
                            </div>
                            <div class="last-message-time">${lastTime}</div>
                        </div>
                        ${unreadBadge}
                        <button class="delete-chat-btn" title="${getTranslation('deleteChat', userLanguage)}" aria-label="${getTranslation('deleteChat', userLanguage)}">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;

                    const deleteBtn = chatElement.querySelector('.delete-chat-btn');
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showDeleteConfirmDialog(chat.id, chatElement);
                    });

                    chatElement.addEventListener('click', () => {
                        document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
                        chatElement.classList.remove('unread', 'chat-updated');
                        chatElement.classList.add('active');
                        openChat(chat.id);
                    });

                    if (container) container.appendChild(chatElement);
                }
            } catch (error) {
                console.error('❌ Error al procesar actualización de chats:', error);
                if (container) {
                    container.innerHTML = `<div class="chat-item error">${getTranslation('errorLoadingChats', userLanguage)}</div>`;
                }
            }
        }, error => {
            console.error('❌ Error en la suscripción de chats:', error);
            if (container) {
                container.innerHTML = `<div class="chat-item error">${getTranslation('errorLoadingChats', userLanguage)}</div>`;
            }
        });

    } catch (error) {
        console.error('❌ Error al configurar escucha de chats:', error);
        if (container) {
            container.innerHTML = `<div class="chat-item error">${getTranslation('errorLoadingChats', userLanguage)}</div>`;
        }
    }
}



// Función para notificar nuevo chat
function notifyNewChat(userEmail) {
    if (!("Notification" in window)) return;

    const notifyUser = () => {
        const options = {
            body: getTranslation('newMessageFrom', userLanguage).replace('{user}', userEmail),
            icon: '/icon.png'
        };

        new Notification("TraduChat", options);
    };

    if (Notification.permission === "granted") {
        notifyUser();
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                notifyUser();
            }
        });
    }
}

// Función para buscar usuarios
async function searchUsers(searchTerm) {
    if (!searchTerm) {
        setupRealtimeChats(chatList, 'individual');
        return;
    }

    try {
        console.log('Iniciando búsqueda con término:', searchTerm);
        const usersRef = collection(db, 'users');
        const currentUserUid = getCurrentUser().uid;
        console.log('Usuario actual:', currentUserUid);
        
        // Obtener todos los usuarios
        const snapshot = await getDocs(usersRef);
        console.log('Total de usuarios encontrados:', snapshot.size);
        
        const users = [];
        const searchTermLower = searchTerm.toLowerCase();
        
        snapshot.forEach(doc => {
            const userData = doc.data();
            // No incluir al usuario actual en los resultados
            if (userData.uid !== currentUserUid) {
                // Buscar en username y email
                const username = (userData.username || '').toLowerCase();
                const email = (userData.email || '').toLowerCase();
                
                if (username.includes(searchTermLower) || email.includes(searchTermLower)) {
                    users.push({
                        id: userData.uid,
                        username: userData.username || email.split('@')[0],
                        email: userData.email
                    });
                }
            }
        });

        console.log('Usuarios filtrados:', users);
        displaySearchResults(users, false);
    } catch (error) {
        console.error('Error detallado al buscar usuarios:', error);
        showError('errorSearch');
    }
}

// Función para mostrar resultados de búsqueda
function displaySearchResults(users, showGroupButton = false) {
    const currentLang = document.getElementById('languageSelect')?.value || 
                       document.getElementById('languageSelectMain')?.value || 
                       getUserLanguage();
    
    chatList.innerHTML = '';
    
    // Añadir botón de crear grupo
    if (showGroupButton) {
        const createGroupButton = document.createElement('div');
        createGroupButton.className = 'chat-item create-group';
        createGroupButton.innerHTML = `
            <div class="group-button">
                <i class="fas fa-users"></i>
                <span data-translate="createNewGroup">${getTranslation('createNewGroup', currentLang)}</span>
            </div>
        `;
        
        createGroupButton.addEventListener('click', () => {
            selectedUsers.clear();
            showGroupCreationModal();
        });
        
        chatList.appendChild(createGroupButton);
    }

    if (users.length === 0) {
        const noUsersMessage = document.createElement('div');
        noUsersMessage.className = 'chat-item';
        noUsersMessage.setAttribute('data-translate', 'noUsersFound');
        noUsersMessage.textContent = getTranslation('noUsersFound', currentLang);
        chatList.appendChild(noUsersMessage);
        return;
    }

    // Mostrar usuarios encontrados
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'chat-item search-result';

        userElement.innerHTML = `
            <div class="user-info">
                <div class="user-name">${user.username}</div>
                <div class="user-email">${user.email}</div>
            </div>
            <button class="start-chat-btn" data-userid="${user.id}" data-translate="startChat" aria-label="${getTranslation('startChat', currentLang)}">
                <i class="fas fa-comment"></i>
                <span>${getTranslation('startChat', currentLang)}</span>
            </button>
        `;

        const startChatBtn = userElement.querySelector('.start-chat-btn');
        startChatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Iniciando chat con usuario:', user.id);
            createChat(user.id);
        });

        chatList.appendChild(userElement);
    });
}

// Función para crear un nuevo chat
async function createChat(otherUserId) {
    console.log('Creando chat con usuario:', otherUserId);
    try {
        const currentUser = getCurrentUser();

        if (!currentUser || !otherUserId) {
            console.error('Falta información necesaria para crear el chat');
            return;
        }

        console.log('Verificando chat existente...');
        // Verificar si ya existe un chat individual entre estos usuarios
        const chatsRef = collection(db, 'chats');
        const q = query(
            chatsRef, 
            where('participants', 'array-contains', currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        let existingChat = null;

        // Buscar un chat individual existente
        querySnapshot.forEach(doc => {
            const chatData = doc.data();
            // Verificar que sea un chat individual (2 participantes y no sea grupo)
            if (chatData.participants.length === 2 && 
                chatData.participants.includes(otherUserId) && 
                (!chatData.type || chatData.type === 'individual')) {
                console.log('Chat individual existente encontrado:', doc.id);
                existingChat = { id: doc.id, ...chatData };
            }
        });

        if (existingChat) {
            console.log('Abriendo chat individual existente:', existingChat.id);
            openChat(existingChat.id);
            return;
        }

        console.log('Creando nuevo chat individual...');
        // Si no existe, crear nuevo chat individual
        const newChatRef = await addDoc(collection(db, 'chats'), {
            participants: [currentUser.uid, otherUserId],
            type: 'individual',
            createdAt: serverTimestamp(),
            lastMessage: null,
            lastMessageTime: null
        });

        console.log('Nuevo chat individual creado:', newChatRef.id);
        openChat(newChatRef.id);
        
        // En móvil, ocultar la lista de chats y mostrar el chat
        if (window.innerWidth <= 768) {
            toggleChatList(false);
        }
    } catch (error) {
        console.error('Error al crear chat:', error);
        showError('errorCreateChat');
    }
}

// Manejador para el botón de nuevo chat
newChatBtn.addEventListener('click', () => {
    // Limpiar la lista de chats actual
    chatList.innerHTML = '';
    
    // Mostrar mensaje instructivo
    chatList.innerHTML = `<div class="search-instruction" data-translate="searchInstruction">${getTranslation('searchInstruction', userLanguage)}</div>`;
    
    // Enfocar el campo de búsqueda
    searchInput.value = '';
    searchInput.placeholder = getTranslation('searchPlaceholder', userLanguage);
    searchInput.focus();
});

// Manejador para el botón de crear grupo
document.getElementById('createGroup').addEventListener('click', () => {
    showGroupCreationModal();
});

// Evento para búsqueda de usuarios
searchInput.addEventListener('input', debounce(async (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    await searchUsers(searchTerm);
}, 300));

// Función debounce para evitar muchas búsquedas seguidas
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Función para mostrar mensajes
async function displayMessage(messageData) {
    // Control de duplicados
    if (!messageData.id) {
        console.warn('⚠️ Mensaje sin ID, posible duplicado evitado:', messageData);
        return;
    }

    const currentUser = getCurrentUser();
    
    if (!currentUser) {
        console.error('❌ No hay usuario autenticado al mostrar mensaje');
        return;
    }

    // Obtener el idioma actual del usuario desde la base de datos
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const currentLanguage = userDoc.exists() ? userDoc.data().language : getUserLanguage();
    
    console.log('👤 Usuario actual:', currentUser.email, 'Idioma:', currentLanguage);

    // Determinar qué texto mostrar basado en el idioma actual
    let messageText = messageData.text;
    const originalLanguage = messageData.language || 'en';
    
    // Solo traducir si:
    // 1. El mensaje no es del usuario actual
    // 2. El idioma original es diferente al idioma actual del usuario
    if (messageData.senderId !== currentUser.uid && originalLanguage !== currentLanguage) {
        console.log(`🔄 Traduciendo mensaje de ${originalLanguage} a ${currentLanguage}`);
        
        // Primero intentar usar una traducción existente
        if (messageData.translations && messageData.translations[currentLanguage]) {
            console.log('✅ Usando traducción existente para', currentLanguage);
            messageText = messageData.translations[currentLanguage];
        } else {
            try {
                console.log('🔄 Solicitando nueva traducción a', currentLanguage);
                messageText = await translateText(messageData.text, currentLanguage, originalLanguage);
                
                // Guardar la traducción para uso futuro
                if (messageText !== messageData.text) {
                    const messagesRef = collection(db, 'chats', currentChat, 'messages');
                    await updateDoc(doc(messagesRef, messageData.id), {
                        [`translations.${currentLanguage}`]: messageText
                    });
                    console.log('✅ Nueva traducción guardada en la base de datos para', currentLanguage);
                }
            } catch (error) {
                console.error('❌ Error al traducir mensaje:', error);
                messageText = messageData.text + ' [Error de traducción]';
            }
        }
    } else {
        console.log('✅ Mostrando mensaje en idioma original:', originalLanguage);
        // Si el mensaje es nuestro o está en nuestro idioma, mostrar el texto original
        messageText = messageData.text;
    }

    // Mostrar la bandera del idioma original del mensaje
    const flag = getFlagEmoji(originalLanguage);
    
    let timeString = '';
    try {
        const timestamp = messageData.timestamp ?
            (typeof messageData.timestamp.toDate === 'function' ?
                messageData.timestamp.toDate() :
                new Date(messageData.timestamp)
            ) : new Date();
        timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
        console.error('❌ Error al formatear timestamp:', error);
        timeString = '';
    }

    // Obtener el tipo de chat actual
    const chatDoc = await getDoc(doc(db, 'chats', currentChat));
    const chatData = chatDoc.exists() ? chatDoc.data() : null;
    const isGroupChat = chatData && chatData.type === 'group';

    // Obtener el nombre del remitente para chats grupales
    let senderName = '';
    if (isGroupChat) {
        try {
            if (messageData.senderId === currentUser.uid) {
                senderName = getTranslation('youMessage', currentLanguage);
            } else {
                const senderDoc = await getDoc(doc(db, 'users', messageData.senderId));
                if (senderDoc.exists()) {
                    const senderData = senderDoc.data();
                    senderName = senderData.username || senderData.email.split('@')[0];
                }
            }
        } catch (error) {
            console.error('❌ Error al obtener información del remitente:', error);
        }
    }

    const messageElement = document.createElement('div');
    messageElement.setAttribute('data-message-id', messageData.id);
    const isSentByMe = messageData.senderId === currentUser.uid;
    messageElement.className = `message ${isSentByMe ? 'sent' : 'received'}`;

    if (messageData.type === 'audio') {
        messageElement.innerHTML = `
            ${isGroupChat ? `<div class="message-sender ${isSentByMe ? 'sent' : ''}">${senderName}</div>` : ''}
            <div class="audio-message">
                <button class="play-button" aria-label="Reproducir audio">
                    <span class="material-icons">play_arrow</span>
                </button>
                <div class="waveform"></div>
                <audio src="${messageData.audioUrl}" preload="none"></audio>
                <div class="transcription">${messageText}</div>
            </div>
            <span class="message-time">${timeString}</span>
        `;

        const playButton = messageElement.querySelector('.play-button');
        const audio = messageElement.querySelector('audio');

        playButton.addEventListener('click', () => {
            if (audio.paused) {
                audio.play();
                playButton.querySelector('.material-icons').textContent = 'pause';
            } else {
                audio.pause();
                playButton.querySelector('.material-icons').textContent = 'play_arrow';
            }
        });

        audio.addEventListener('ended', () => {
            playButton.querySelector('.material-icons').textContent = 'play_arrow';
        });
    } else {
        messageElement.innerHTML = `
            ${isGroupChat ? `<div class="message-sender ${isSentByMe ? 'sent' : ''}">${senderName}</div>` : ''}
            <div class="message-content">
                <span class="message-flag">${flag}</span>
                <span class="message-text"></span>
                <span class="message-time">${timeString}</span>
            </div>
        `;

        const textSpan = messageElement.querySelector('.message-text');
        textSpan.textContent = messageText;

        const speakBtn = createSpeakButton(messageText, currentLanguage);
        const contentDiv = messageElement.querySelector('.message-content');
        contentDiv.insertBefore(speakBtn, contentDiv.querySelector('.message-time'));
    }

    if (messagesList) {
        // Verificar si el mensaje anterior es del mismo remitente
        const previousMessage = messagesList.lastElementChild;
        if (
            previousMessage &&
            previousMessage.classList.contains('message') &&
            previousMessage.getAttribute('data-sender-id') === messageData.senderId
        ) {
            messageElement.setAttribute('data-same-sender', 'true');
        }

        // Guardar el ID del remitente para comparaciones futuras
        messageElement.setAttribute('data-sender-id', messageData.senderId);

        messagesList.appendChild(messageElement);
        addSwipeActions(messageElement);
        messagesList.scrollTop = messagesList.scrollHeight;
    } else {
        console.error('❌ Lista de mensajes no encontrada');
    }

    return { text: messageText, lang: currentLanguage };
}

// Función para abrir un chat
async function openChat(chatId) {
    console.log('Abriendo chat:', chatId);
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
        console.error('No hay usuario autenticado al abrir chat');
        return;
    }

    // Cancelar la suscripción anterior si existe
    if (unsubscribeMessagesFn) {
        unsubscribeMessagesFn();
    }

    // Resetear variables de paginación
    isLoadingMore = false;
    allMessagesLoaded = false;
    lastVisibleMessage = null;

    currentChat = chatId;

    // Limpia cualquier manejador previo en la cabecera del chat
    if (currentChatInfo) {
        currentChatInfo.onclick = null;
        currentChatInfo.removeAttribute('title');
    }

    
    try {
        // Obtener información del chat
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        if (!chatDoc.exists()) {
            console.error('Chat no encontrado:', chatId);
            return;
        }

        const chatData = chatDoc.data();
        console.log('Datos del chat:', chatData);
        currentChatParticipants = chatData.participants || [];
        if (addMembersBtn) {
            if (chatData.type === 'group') {
                addMembersBtn.classList.remove('hidden');
            } else {
                addMembersBtn.classList.add('hidden');
            }
        }



        // Limpiar mensajes anteriores
        if (messagesList) {
            messagesList.innerHTML = '';
            
            // Añadir el loader al inicio de la lista
            const loaderDiv = document.createElement('div');
            loaderDiv.id = 'messages-loader';
            loaderDiv.className = 'messages-loader';
            loaderDiv.style.display = 'none';
            loaderDiv.innerHTML = '<div class="loader-spinner"></div>';
            messagesList.appendChild(loaderDiv);

            // Añadir observer para detectar cuando se llega arriba
            const observer = new IntersectionObserver(async (entries) => {
                if (entries[0].isIntersecting && !isLoadingMore && !allMessagesLoaded) {
                    await loadMoreMessages(chatId);
                }
            }, { threshold: 0.1 });

            observer.observe(loaderDiv);

            // Añadir estilos para el loader si no existen
            if (!document.querySelector('#loader-styles')) {
            const style = document.createElement('style');
                style.id = 'loader-styles';
            style.textContent = `
                    .messages-loader {
                        text-align: center;
                    padding: 10px;
                    }
                    .loader-spinner {
                        width: 20px;
                        height: 20px;
                        border: 2px solid #f3f3f3;
                        border-top: 2px solid #3498db;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
            }
        }
        
        // Configurar la interfaz según el tipo de chat
        if (chatData.type === 'group') {
            await setupGroupChatInterface(chatData);
        } else {
            await setupIndividualChatInterface(chatData, currentUser);
        }

        // Cambiar a la vista del chat solo en móviles
        if (window.innerWidth <= 768) {
            toggleChatList(false);
        }

        // Cargar mensajes iniciales
        await loadInitialMessages(chatId);
        markChatAsRead(chatId);



        // Suscribirse a nuevos mensajes
        const messagesRef = collection(db, 'chats', chatId, 'messages');
const newMessagesQuery = query(
    messagesRef,
    orderBy('timestamp', 'desc'),
    limit(1)
);

unsubscribeMessagesFn = onSnapshot(newMessagesQuery, (snapshot) => {
    if (unsubscribeTypingStatus) {
        unsubscribeTypingStatus();
    }

    const typingCollection = collection(db, 'chats', chatId, 'typingStatus');
    unsubscribeTypingStatus = onSnapshot(typingCollection, (typingSnap) => {
        const typingUsers = typingSnap.docs
            .map(doc => doc.data())
            .filter(t => t.userId !== currentUser.uid);

        const currentLang = document.getElementById('languageSelect')?.value ||
                           document.getElementById('languageSelectMain')?.value ||
                           getUserLanguage();

        if (typingUsers.length > 0) {
            const username = typingUsers[0].username || typingUsers[0].userId;
            const typingMessage = getTypingMessage(username, currentLang);
            showTypingIndicator(typingMessage);
        } else {
            hideTypingIndicator();
        }
    });

    snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
            const messageData = { ...change.doc.data(), id: change.doc.id };
            
            // Evitar duplicados
            if (lastProcessedMessageId === messageData.id) {
                return;
            }
            
            // Actualizar el último mensaje procesado
            lastProcessedMessageId = messageData.id;

            if (messageData.type === 'system') {
                displaySystemMessage(messageData);
            } else {
                const result = await displayMessage(messageData);
                if (initialLoadComplete && messageData.senderId !== currentUser.uid) {
                    speakText(result.text, result.lang);
                }
            }
            if (messagesList) {
                messagesList.scrollTop = messagesList.scrollHeight;
            }
            markChatAsRead(chatId);
        }
    });
});


    } catch (error) {
        console.error('Error al abrir chat:', error);
        showError('errorOpenChat');
    }
}

// Función para cargar los mensajes iniciales
async function loadInitialMessages(chatId) {
    initialLoadComplete = false; // Resetear el estado de carga inicial
    const messagesRef = collection(db, 'chats', chatId, 'messages');

    const q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        limit(MESSAGES_PER_BATCH)
    );

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            allMessagesLoaded = true;
            initialLoadComplete = true; // Marcar como completo incluso si no hay mensajes
            return;
        }

        const messages = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));

        lastVisibleMessage = snapshot.docs[snapshot.docs.length - 1];
        
        // Si hay mensajes, guardar el ID del último para evitar duplicados
        if (messages.length > 0) {
            lastProcessedMessageId = messages[0].id; // Guardamos el ID del mensaje más reciente
        }

        // Ordenar por timestamp o usar 0 si no hay timestamp
        messages.sort((a, b) => {
            const timeA = a.timestamp?.toMillis?.() || 0;
            const timeB = b.timestamp?.toMillis?.() || 0;
            return timeA - timeB;
        });

        // Mostrar mensajes
        await Promise.all(messages.map(async (messageData) => {
            if (messageData.type === 'system') {
                displaySystemMessage(messageData);
            } else {
                await displayMessage(messageData);
            }
        }));

        messagesList.scrollTop = messagesList.scrollHeight;
        
        // Marcar la carga inicial como completa después de mostrar los mensajes
        initialLoadComplete = true;
        console.log('✅ Carga inicial completada, último mensaje procesado:', lastProcessedMessageId);
    } catch (error) {
        console.error('Error al cargar mensajes iniciales:', error);
        showError('errorGeneric');
        initialLoadComplete = true; // Marcar como completo incluso en caso de error
    }
}


// Función para cargar más mensajes antiguos
async function loadMoreMessages(chatId) {
    if (isLoadingMore || allMessagesLoaded) return;

    isLoadingMore = true;
    const loaderDiv = document.getElementById('messages-loader');
    if (loaderDiv) loaderDiv.style.display = 'block';

    try {
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const q = query(
            messagesRef,
            orderBy('timestamp', 'desc'),
            startAfter(lastVisibleMessage),
            limit(MESSAGES_PER_BATCH)
        );

        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            allMessagesLoaded = true;
            if (loaderDiv) loaderDiv.style.display = 'none';
            return;
        }

        const messages = [];
        snapshot.forEach(doc => {
            messages.push({ ...doc.data(), id: doc.id });
        });

        // Actualizar referencia al último mensaje
        lastVisibleMessage = snapshot.docs[snapshot.docs.length - 1];

        // Guardar la posición actual del scroll
        const scrollHeight = messagesList.scrollHeight;
        const scrollTop = messagesList.scrollTop;

        // Mostrar mensajes en orden cronológico al inicio de la lista
        messages.reverse().forEach(async messageData => {
            const messageElement = document.createElement('div');
            if (messageData.type === 'system') {
                await displaySystemMessage(messageData, messageElement);
            } else {
                await displayMessage(messageData, messageElement);
            }
            messagesList.insertBefore(messageElement, messagesList.firstChild);
        });

        // Mantener la posición del scroll
        messagesList.scrollTop = messagesList.scrollHeight - scrollHeight + scrollTop;
    } catch (error) {
        console.error('Error al cargar más mensajes:', error);
    } finally {
        isLoadingMore = false;
        if (loaderDiv) loaderDiv.style.display = 'none';
    }
}

// Guardar la marca de lectura de un chat
function markChatAsRead(chatId) {
    try {
        const times = JSON.parse(localStorage.getItem('chatReadTimes') || '{}');
        times[chatId] = Date.now();
        localStorage.setItem('chatReadTimes', JSON.stringify(times));
        inMemoryReadTimes = times;
    } catch (e) {
        console.warn('LocalStorage unavailable, storing in memory', e);
        inMemoryReadTimes[chatId] = Date.now();
    }

    const chatEl = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (chatEl) {
        chatEl.classList.remove('unread');
        const badge = chatEl.querySelector('.unread-badge');
        if (badge) badge.remove();
    }
}

function getChatReadTimes() {
    try {
        const stored = JSON.parse(localStorage.getItem('chatReadTimes') || '{}');
        inMemoryReadTimes = stored;
        return stored;
    } catch (e) {
        console.warn('LocalStorage unavailable, using in-memory times', e);
        return inMemoryReadTimes;
    }
}

// Funciones auxiliares para la interfaz
async function setupGroupChatInterface(chatData) {
    const participantsInfo = await Promise.all(
        chatData.participants.map(async (userId) => {
            const userDoc = await getDoc(doc(db, 'users', userId));
            return userDoc.exists() ? userDoc.data() : { email: 'Usuario desconocido' };
        })
    );

    const participantNames = participantsInfo.map(
        user => user.username || user.email.split('@')[0]
    );

    const groupInfoElement = document.createElement('div');
    groupInfoElement.className = 'group-info';
    groupInfoElement.innerHTML = `
        <div class="group-name">${chatData.name}</div>
        <div class="group-participants">
            ${participantNames.join(', ')}
        </div>
    `;

    groupInfoElement.title = participantNames.join(', ');
    groupInfoElement.onclick = () => showToast(participantNames.join(', '));

    if (currentChatInfo) {
        currentChatInfo.innerHTML = '';
        currentChatInfo.appendChild(groupInfoElement);
    }

}

async function setupIndividualChatInterface(chatData, currentUser) {
    const otherUserId = chatData.participants.find(id => id !== currentUser.uid);
    if (!otherUserId) {
        console.error('No se encontró el otro participante');
        return;
    }

    const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
    if (!otherUserDoc.exists()) {
        console.error('Usuario no encontrado:', otherUserId);
        return;
    }

    const otherUserData = otherUserDoc.data();
    if (currentChatInfo) {
        currentChatInfo.textContent = otherUserData.username || otherUserData.email.split('@')[0];
    }
}

// Función para mostrar mensajes del sistema
function displaySystemMessage(messageData) {
    if (!messagesList) return;

    const messageElement = document.createElement('div');
    messageElement.className = 'message system-message';
    messageElement.innerHTML = `
        <span class="message-text">${messageData.text}</span>
        <span class="message-time">${
            messageData.timestamp ? 
            new Date(messageData.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
            ''
        }</span>
    `;

    messagesList.appendChild(messageElement);
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Función para enviar mensaje
async function sendMessage(text) {
    console.log('📤 Intentando enviar mensaje:', text);
    if (!text.trim() || !currentChat) {
        console.log('❌ No hay texto o chat activo');
        return;
    }

    try {
        const user = getCurrentUser();
        if (!user) {
            console.error('❌ No hay usuario autenticado');
            return;
        }

        // Obtener el idioma actual del usuario desde la base de datos
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const currentLanguage = userDoc.exists() ? userDoc.data().language : getUserLanguage();
        
        console.log('👤 Usuario actual:', user.email, 'Idioma:', currentLanguage);
        
        // Crear el mensaje con el idioma correcto
        const messageData = {
            text: text.trim(),
            senderId: user.uid,
            senderEmail: user.email,
            timestamp: serverTimestamp(),
            language: currentLanguage, // Asegurar que se guarda el idioma correcto
            translations: {}
        };

        console.log('💾 Guardando mensaje en idioma original:', currentLanguage);
        // Enviar el mensaje
        const messagesRef = collection(db, 'chats', currentChat, 'messages');
        const docRef = await addDoc(messagesRef, messageData);
        console.log('✅ Mensaje enviado con ID:', docRef.id);
        
        // Actualizar último mensaje del chat
        const chatRef = doc(db, 'chats', currentChat);
        await updateDoc(chatRef, {
            lastMessage: text.trim(),
            lastMessageTime: serverTimestamp()
        });
        
        // Limpiar el input
        messageInput.value = '';
        
        // Obtener información del chat
        const chatDoc = await getDoc(chatRef);
        const chatData = chatDoc.data();
        const isGroupChat = chatData.type === 'group';



        // Enviar notificaciones push manualmente si no se utilizan Cloud Functions
        if (manualPushNotifications) {
            sendPushNotifications(chatData, text.trim(), currentChat, docRef.id);
        }
        
        // Determinar los idiomas necesarios para traducción
        let targetLanguages = new Set();
        
        if (isGroupChat) {
            console.log('👥 Chat grupal detectado, obteniendo idiomas de participantes...');
            // Para grupos, obtener los idiomas únicos de todos los participantes
            const participantsData = await Promise.all(
                chatData.participants.map(uid => getDoc(doc(db, 'users', uid)))
            );
            
            participantsData.forEach(participantDoc => {
                if (participantDoc.exists()) {
                    const participantLang = participantDoc.data().language || 'en';
                    if (participantLang !== currentLanguage) {
                        targetLanguages.add(participantLang);
                    }
                }
            });
        } else {
            console.log('👤 Chat individual detectado, obteniendo idioma del otro usuario...');
            // Para chats individuales, solo traducir al idioma del otro usuario
            const otherUserId = chatData.participants.find(uid => uid !== user.uid);
            if (otherUserId) {
                const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
                if (otherUserDoc.exists()) {
                    const otherUserLang = otherUserDoc.data().language || 'en';
                    if (otherUserLang !== currentLanguage) {
                        targetLanguages.add(otherUserLang);
                    }
                }
            }
        }
        
        console.log('🎯 Idiomas objetivo para traducción:', Array.from(targetLanguages));
        // Realizar las traducciones necesarias
        for (const targetLang of targetLanguages) {
            try {
                console.log(`🔄 Traduciendo mensaje a ${targetLang}...`);
                const translation = await translateText(text, targetLang, currentLanguage);
                
                if (translation === 'LIMIT_EXCEEDED') {
                    console.warn('⚠️ Límite de traducción excedido');
                    await updateDoc(doc(messagesRef, docRef.id), {
                        [`translations.${targetLang}`]: text,
                        translationStatus: 'limit_exceeded'
                    });
                    const limitMessage = getTranslation('translationLimitExceeded', currentLanguage);
                    showToast(limitMessage);
                    break;
                } else {
                    console.log(`✅ Traducción a ${targetLang} completada:`, translation);
                    await updateDoc(doc(messagesRef, docRef.id), {
                        [`translations.${targetLang}`]: translation
                    });
                }
            } catch (translationError) {
                console.error(`❌ Error al traducir al ${targetLang}:`, translationError);
                await updateDoc(doc(messagesRef, docRef.id), {
                    [`translations.${targetLang}`]: text,
                    translationError: true
                });
            }
        }
    } catch (error) {
        console.error('❌ Error al enviar mensaje:', error);
        showError('errorGeneric');
    }
}

let typingTimeout = null;
let unsubscribeTypingStatus = null;

async function setTypingStatus(isTyping) {
    const currentUser = getCurrentUser();
    if (!currentChat || !currentUser) return;

    console.log(`🔄 setTypingStatus llamado con: ${isTyping}`);

    const typingRef = doc(db, 'chats', currentChat, 'typingStatus', currentUser.uid);

    try {
        if (isTyping) {
            await setDoc(typingRef, {
                userId: currentUser.uid,
                timestamp: serverTimestamp(),
                username: currentUser.username || currentUser.email.split('@')[0]
            });
            console.log('✅ Estado de escritura actualizado (escribiendo)');
        } else {
            await deleteDoc(typingRef);
            console.log('✅ Estado de escritura eliminado');
        }
    } catch (error) {
        console.error('❌ Error actualizando estado de escritura:', error);
    }
}

function handleTyping() {
    setTypingStatus(true);

    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        setTypingStatus(false);
    }, 3000); // 3 segundos sin escribir = no está escribiendo
}

const typingIndicator = document.getElementById('typingIndicator');

function showTypingIndicator(text) {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.textContent = text;
        typingIndicator.style.display = 'block';
        console.log('✨ Mostrando indicador:', text);
    }
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.style.display = 'none';
        typingIndicator.textContent = '';
        console.log('🚫 Ocultando indicador de escritura');
    }
}


// Eventos para enviar mensajes
sendMessageBtn.addEventListener('click', (e) => {
    createRipple(e);
    console.log('Botón enviar clickeado');
    sendMessage(messageInput.value);
});

messageInput.addEventListener('input', () => {
    handleTyping();
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        console.log('Enter presionado');
        sendMessage(messageInput.value);
    }
});

// Verificar si hay una sesión guardada
window.addEventListener('load', () => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainScreen();
    }
});

// Mejorar la función de cerrar sesión
async function handleLogout() {
    try {
        // Cancelar todas las suscripciones antes de cerrar sesión
        if (unsubscribeChats) {
            unsubscribeChats();
            unsubscribeChats = null;
        }
        if (unsubscribeMessagesFn) {
            unsubscribeMessagesFn();
            unsubscribeMessagesFn = null;
        }

        // Limpiar el estado de la aplicación
        resetChatState();
        currentUser = null;
        currentChat = null;
        
        // Cerrar sesión en Firebase
        await signOut(auth);
        
        // Limpiar localStorage
        localStorage.removeItem('userLanguage');
        localStorage.removeItem('userPhone');
        
        // Mostrar pantalla de autenticación
        showAuthScreen();
        
        // Mostrar mensaje de éxito
        showToast(getTranslation('logoutSuccess', getUserLanguage()));
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showToast(getTranslation('errorGeneric', getUserLanguage()));
    }
}

// Evento para el botón de cerrar sesión
settingsLogoutBtn.addEventListener('click', handleLogout);

// Evento para el botón de volver
document.addEventListener('DOMContentLoaded', () => {
    const backButton = document.getElementById('backToChats');
    const addBtn = document.getElementById('addMembersBtn');
    const chatContainer = document.querySelector('.chat-container');
    if (backButton) {
        backButton.addEventListener('click', () => {
            console.log('Botón volver clickeado');
            // Prevenir múltiples clics
            backButton.disabled = true;
            setTimeout(() => backButton.disabled = false, 500);

            toggleChatList(true);
        });

        // Inicialmente ocultar el botón
        backButton.style.display = 'none';
    }

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            if (currentChat) {
                showAddMembersModal(currentChat, currentChatParticipants);
            }
        });
        addBtn.classList.add('hidden');
    }

    if (chatContainer) {
        let startX = 0;
        let startY = 0;
        chatContainer.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });
        chatContainer.addEventListener('touchend', (e) => {
            const diffX = e.changedTouches[0].clientX - startX;
            const diffY = e.changedTouches[0].clientY - startY;
            if (diffX > 50 && Math.abs(diffY) < 30) {
                toggleChatList(true);
            }
        });
    }
});

// Función para manejar la navegación entre vistas
function toggleChatList(show) {
    console.log('Alternando vista de chat, mostrar lista:', show);

    const sidebar = document.querySelector('.sidebar');
    const chatContainer = document.querySelector('.chat-container');
    const backButton = document.getElementById('backToChats');
    const addBtn = document.getElementById('addMembersBtn');

    const isMobile = window.innerWidth <= 768;

    if (!isMobile) {
        // En pantallas grandes siempre mostramos ambas secciones
        if (sidebar) {
            sidebar.classList.remove('hidden');
            sidebar.style.display = 'block';
        }
        if (chatContainer) {
            chatContainer.classList.remove('hidden');
            chatContainer.style.display = 'block';
        }
    }

    if (isMobile && show) {
        // Mostrar lista de chats
        if (sidebar) {
            sidebar.classList.remove('hidden');
            sidebar.style.display = 'block';
        }
        if (chatContainer) {
            chatContainer.classList.add('hidden');
            chatContainer.style.display = 'none';
        }
        
        // Cancelar suscripción a mensajes si existe
        if (unsubscribeMessagesFn) {
            unsubscribeMessagesFn();
            unsubscribeMessagesFn = null;
        }

        if (currentChat) {
            markChatAsRead(currentChat);
        }

        if (addBtn) {
            addBtn.classList.add('hidden');
        }

        // Restablecer estado del chat actual
        currentChat = null;
        if (messagesList) {
            messagesList.innerHTML = '';
        }
        if (currentChatInfo) {
            currentChatInfo.textContent = getTranslation('selectChat', userLanguage);
            currentChatInfo.onclick = null;
            currentChatInfo.removeAttribute('title');
        }

        // Recargar la lista correspondiente
        if (currentListType === 'group') {
            if (groupsPage) groupsPage.classList.add('active');
            if (chatList) chatList.classList.add('hidden');
            setupRealtimeChats(groupsListEl, 'group');
        } else {
            if (groupsPage) groupsPage.classList.remove('active');
            if (chatList) chatList.classList.remove('hidden');
            setupRealtimeChats(chatList, 'individual');
        }
    } else if (isMobile && !show) {

        // Mostrar chat
        if (sidebar) {
            sidebar.classList.add('hidden');
            sidebar.style.display = 'none';
        }
        if (chatContainer) {
            chatContainer.classList.remove('hidden');
            chatContainer.style.display = 'block';
        }
    }

    // Manejar visibilidad del botón de retorno
    if (backButton) {
        backButton.style.display = isMobile && !show ? 'block' : 'none';
    }

    if (addBtn && show) {
        addBtn.classList.add('hidden');
    }

    adjustMobileLayout();
}

// Asegurarse de que el botón de retorno se muestre/oculte correctamente al cambiar el tamaño de la ventana
window.addEventListener('resize', () => {
    const backButton = document.getElementById('backToChats');
    const sidebar = document.querySelector('.sidebar');
    const chatContainer = document.querySelector('.chat-container');

    if (window.innerWidth > 768) {
        if (sidebar) {
            sidebar.classList.remove('hidden');
            sidebar.style.display = 'block';
        }
        if (chatContainer) {
            chatContainer.classList.remove('hidden');
            chatContainer.style.display = 'block';
        }
        if (backButton) backButton.style.display = 'none';
    } else if (backButton) {
        backButton.style.display = chatContainer?.style.display !== 'none' ? 'block' : 'none';
    }
});

function createRipple(e) {
    const button = e.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - button.getBoundingClientRect().left - radius}px`;
    circle.style.top = `${e.clientY - button.getBoundingClientRect().top - radius}px`;
    circle.classList.add('ripple-effect');

    button.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
}

function addSwipeActions(messageEl) {
    let startX = 0;
    let startY = 0;
    messageEl.addEventListener('touchstart', (ev) => {
        const t = ev.touches[0];
        startX = t.clientX;
        startY = t.clientY;
    });
    messageEl.addEventListener('touchend', (ev) => {
        const t = ev.changedTouches[0];
        const diffX = t.clientX - startX;
        const diffY = t.clientY - startY;
        if (diffX < -50 && Math.abs(diffY) < 30) {
            showMessageOptions(messageEl);
        }
    });
}

function showMessageOptions(messageEl) {
    document.querySelectorAll('.quick-options').forEach(el => el.remove());
    const container = document.createElement('div');
    container.className = 'quick-options';
    container.innerHTML = `
        <button class="reply-btn" aria-label="Responder">↩</button>
        <button class="delete-btn" aria-label="Borrar">🗑</button>
    `;
    container.querySelector('.reply-btn').addEventListener('click', () => {
        showToast('Responder');
        container.remove();
    });
    container.querySelector('.delete-btn').addEventListener('click', () => {
        showToast('Borrar');
        container.remove();
    });
    messageEl.appendChild(container);
}

// Función para actualizar la lista de usuarios seleccionados
function updateSelectedUsersList(selectedUsersList, createGroupBtn, minUsers = 1) {
    selectedUsersList.innerHTML = Array.from(selectedUsers).map(user => `
        <div class="selected-user-item">
            <span>${user.email}</span>
            <span class="remove-user" data-userid="${user.id}">×</span>
        </div>
    `).join('');

    // Eventos para remover usuarios
    selectedUsersList.querySelectorAll('.remove-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.target.dataset.userid;
            selectedUsers.delete(Array.from(selectedUsers).find(u => u.id === userId));
            updateSelectedUsersList(selectedUsersList, createGroupBtn, minUsers);
        });
    });

    // Actualizar estado del botón
    if (createGroupBtn) {
        const groupNameInput = document.getElementById('groupName');
        if (groupNameInput) {
            createGroupBtn.disabled = selectedUsers.size < minUsers || !groupNameInput.value.trim();
        } else {
            createGroupBtn.disabled = selectedUsers.size < minUsers;
        }
    }
}

// Función para mostrar el modal de creación de grupo
function showGroupCreationModal() {
    // Limpiar usuarios seleccionados anteriormente
    selectedUsers.clear();

    const modalHtml = `
        <div id="groupModal" class="modal">
            <div class="modal-content">
                <h2 data-translate="createGroup">${getTranslation('createGroup', userLanguage)}</h2>
                <div class="group-form">
                    <input type="text" id="groupName" data-translate="groupNamePlaceholder" placeholder="${getTranslation('groupNamePlaceholder', userLanguage)}" />
                    <div class="selected-users">
                        <h3>
                            <span data-translate="selectedUsers">${getTranslation('selectedUsers', userLanguage)}</span>
                            <span class="users-count" data-translate="minUsersCount">(0/2 mínimo)</span>
                        </h3>
                        <div id="selectedUsersList"></div>
                    </div>
                    <div class="user-search">
                        <input type="text" id="groupUserSearch" data-translate="searchUsers" placeholder="${getTranslation('searchUsers', userLanguage)}" />
                        <div id="userSearchResults"></div>
                    </div>
                    <div class="modal-buttons">
                        <button id="createGroupBtn" disabled data-translate="createGroup" aria-label="${getTranslation('createGroup', userLanguage)}">
                            ${getTranslation('createGroup', userLanguage)}
                        </button>
                        <button id="cancelGroupBtn" data-translate="cancel" aria-label="${getTranslation('cancel', userLanguage)}">
                            ${getTranslation('cancel', userLanguage)}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Eventos del modal
    const modal = document.getElementById('groupModal');
    const groupNameInput = document.getElementById('groupName');
    const userSearchInput = document.getElementById('groupUserSearch');
    const createGroupBtn = document.getElementById('createGroupBtn');
    const cancelGroupBtn = document.getElementById('cancelGroupBtn');
    const selectedUsersList = document.getElementById('selectedUsersList');
    const userSearchResults = document.getElementById('userSearchResults');
    const usersCount = modal.querySelector('.users-count');

    // Actualizar contador de usuarios
    function updateUsersCount() {
        const currentLang = getUserLanguage();
        usersCount.textContent = getTranslation('minUsersCount', currentLang, selectedUsers.size);
        usersCount.style.color = selectedUsers.size >= 2 ? '#10b981' : '#ef4444';
    }

    // Traducir la interfaz del modal
    translateInterface(getUserLanguage());

    // Búsqueda de usuarios
    userSearchInput.addEventListener('input', debounce(async (e) => {
        const searchTerm = e.target.value.trim();
        if (searchTerm.length < 2) {
            userSearchResults.innerHTML = '';
            return;
        }

        try {
            const users = await searchUsersForGroup(searchTerm);
            displayUserSearchResults(users, userSearchResults, selectedUsersList, createGroupBtn, 2);
        } catch (error) {
            console.error('Error al buscar usuarios:', error);
            userSearchResults.innerHTML = `<div class="error-message" data-translate="errorSearch">${getTranslation('errorSearch', userLanguage)}</div>`;
        }
    }, 300));

    // Actualizar botón cuando cambia el nombre del grupo
    groupNameInput.addEventListener('input', () => {
        createGroupBtn.disabled = !groupNameInput.value.trim() || selectedUsers.size < 2;
    });

    // Crear grupo
    createGroupBtn.addEventListener('click', async () => {
        const groupName = groupNameInput.value.trim();
        if (!groupName || selectedUsers.size < 2) {
            showError('errorMinUsers');
            return;
        }

        try {
            await createGroupChat(groupName, Array.from(selectedUsers));
            modal.remove();
            // Mostrar mensaje de éxito
            showToast(getTranslation('groupCreated', getUserLanguage()));
        } catch (error) {
            console.error('Error al crear grupo:', error);
            showError('errorCreateGroup');
        }
    });

    // Cancelar
    cancelGroupBtn.addEventListener('click', () => {
        selectedUsers.clear();
        modal.remove();
    });

    // Cerrar modal al hacer clic fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            selectedUsers.clear();
            modal.remove();
        }
    });

    // Inicializar la lista de usuarios seleccionados
    updateSelectedUsersList(selectedUsersList, createGroupBtn, 2);
    updateUsersCount();

    // Escuchar cambios de idioma
    window.addEventListener('languageChanged', (e) => {
        const newLang = e.detail;
        translateInterface(newLang);
        updateUsersCount();
    });
}

// Función para buscar usuarios para el grupo
async function searchUsersForGroup(searchTerm, excludeIds = []) {
    const currentUser = getCurrentUser();
    
    try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        
        const users = [];
        snapshot.forEach(doc => {
            const userData = doc.data();
            if (
                userData.uid &&
                typeof userData.email === 'string' &&
                userData.uid !== currentUser.uid &&
                !excludeIds.includes(userData.uid) &&
                (
                    userData.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (typeof userData.username === 'string' && userData.username.toLowerCase().includes(searchTerm.toLowerCase()))
                ) &&
                !Array.from(selectedUsers).some(u => u.id === userData.uid)
            ) {
                users.push({
                    id: userData.uid,
                    email: userData.email,
                    username: userData.username || null
                });
            }
        });
        
        return users;
    } catch (error) {
        console.error('Error al buscar usuarios:', error);
        throw error;
    }
}

// Función para mostrar resultados de búsqueda de usuarios para el grupo
function displayUserSearchResults(users, container, selectedUsersList, createGroupBtn, minUsers = 1) {
    if (users.length === 0) {
        container.innerHTML = `<div class="user-item no-results">${getTranslation('noUsersFound', userLanguage)}</div>`;
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="user-item" data-userid="${user.id}" data-email="${user.email}">
            <i class="fas fa-user"></i>
            <div class="user-info">
                <div class="user-name">${user.username || user.email.split('@')[0]}</div>
                <div class="user-email">${user.email}</div>
            </div>

        </div>
    `).join('');

    container.querySelectorAll('.user-item').forEach(item => {
        if (item.classList.contains('no-results')) return;
        
        item.addEventListener('click', () => {
            const userId = item.dataset.userid;
            const userEmail = item.dataset.email;
            
            if (!Array.from(selectedUsers).some(u => u.id === userId)) {
                selectedUsers.add({
                    id: userId,
                    email: userEmail
                });
                
                updateSelectedUsersList(selectedUsersList, createGroupBtn, minUsers);
                item.remove();

                // Actualizar estado del botón de crear
                const groupNameInput = document.getElementById('groupName');
                if (groupNameInput) {
                    createGroupBtn.disabled = !groupNameInput.value.trim() || selectedUsers.size < minUsers;
                } else {
                    createGroupBtn.disabled = selectedUsers.size < minUsers;
                }

                // Actualizar contador
                const usersCount = document.querySelector('.users-count');
                if (usersCount) {
                    const minText = minUsers === 2 ? `${selectedUsers.size}/2 mínimo` : `(${selectedUsers.size})`;
                    usersCount.textContent = minText;
                    usersCount.style.color = selectedUsers.size >= minUsers ? '#10b981' : '#ef4444';
                }
            }
        });
    });
}

// Función para crear un chat grupal
async function createGroupChat(groupName, participants) {
    console.log('Intentando crear grupo:', groupName);
    console.log('Participantes:', participants);

    if (participants.length < 2) {
        console.error('Se necesitan al menos 2 participantes para crear un grupo');
        showError('errorMinUsers');
        return;
    }

    const currentUser = getCurrentUser();
    
    if (!currentUser) {
        console.error('No hay usuario autenticado');
        return;
    }

    try {
        // Añadir el usuario actual a los participantes
        const allParticipants = [
            currentUser.uid,
            ...participants.map(p => p.id)
        ];

        console.log('Todos los participantes:', allParticipants);

        // Crear el documento del grupo
        const groupChatRef = await addDoc(collection(db, 'chats'), {
            name: groupName,
            type: 'group',
            participants: allParticipants,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
            lastMessage: null,
            lastMessageTime: null
        });

        console.log('Grupo creado exitosamente:', groupChatRef.id);

        // Crear mensaje de sistema inicial
        const lang = getUserLanguage();
        await addDoc(collection(db, 'chats', groupChatRef.id, 'messages'), {
            text: getTranslation('groupCreatedBy', lang, groupName, currentUser.email),
            type: 'system',
            timestamp: serverTimestamp(),
            senderId: 'system'
        });

        // Abrir el chat recién creado
        openChat(groupChatRef.id);
    } catch (error) {
        console.error('Error al crear grupo:', error);
        showError('errorCreateGroup');
    }
}

// Función para mostrar modal para añadir miembros a un grupo existente
function showAddMembersModal(chatId, existingParticipants = []) {
    selectedUsers.clear();

    const modalHtml = `
        <div id="addMembersModal" class="modal">
            <div class="modal-content">
                <h2 data-translate="addMembers">${getTranslation('addMembers', userLanguage)}</h2>
                <div class="group-form">
                    <div class="selected-users">
                        <h3>
                            <span data-translate="selectedUsers">${getTranslation('selectedUsers', userLanguage)}</span>
                            <span class="users-count">(0)</span>
                        </h3>
                        <div id="addSelectedUsers"></div>
                    </div>
                    <div class="user-search">
                        <input type="text" id="addMemberSearch" data-translate="searchUsers" placeholder="${getTranslation('searchUsers', userLanguage)}" />
                        <div id="addMemberResults"></div>
                    </div>
                    <div class="modal-buttons">
                        <button id="confirmAddMembers" disabled data-translate="addMembers" aria-label="${getTranslation('addMembers', userLanguage)}">${getTranslation('addMembers', userLanguage)}</button>
                        <button id="cancelAddMembers" data-translate="cancel" aria-label="${getTranslation('cancel', userLanguage)}">${getTranslation('cancel', userLanguage)}</button>
                    </div>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('addMembersModal');
    const searchInput = document.getElementById('addMemberSearch');
    const results = document.getElementById('addMemberResults');
    const confirmBtn = document.getElementById('confirmAddMembers');
    const cancelBtn = document.getElementById('cancelAddMembers');
    const selectedList = document.getElementById('addSelectedUsers');
    const usersCount = modal.querySelector('.users-count');

    function updateUsersCount() {
        usersCount.textContent = `(${selectedUsers.size})`;
        usersCount.style.color = selectedUsers.size > 0 ? '#10b981' : '#ef4444';
    }

    translateInterface(getUserLanguage());

    searchInput.addEventListener('input', debounce(async (e) => {
        const term = e.target.value.trim();
        if (term.length < 2) {
            results.innerHTML = '';
            return;
        }
        try {
            const users = await searchUsersForGroup(term, existingParticipants);
            displayUserSearchResults(users, results, selectedList, confirmBtn);
            updateUsersCount();
        } catch (err) {
            console.error('Error al buscar usuarios:', err);
            results.innerHTML = `<div class="error-message" data-translate="errorSearch">${getTranslation('errorSearch', userLanguage)}</div>`;
        }
    }, 300));

    confirmBtn.addEventListener('click', async () => {
        try {
            await addMembersToGroup(chatId, Array.from(selectedUsers));
            modal.remove();
            showToast(getTranslation('membersAdded', getUserLanguage()));
        } catch (err) {
            console.error('Error al agregar miembros:', err);
            showError('errorAddMembers');
        }
    });

    cancelBtn.addEventListener('click', () => {
        selectedUsers.clear();
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            selectedUsers.clear();
            modal.remove();
        }
    });

    updateSelectedUsersList(selectedList, confirmBtn, 1);
    updateUsersCount();

    window.addEventListener('languageChanged', (e) => {
        const newLang = e.detail;
        translateInterface(newLang);
        updateUsersCount();
    });
}

// Función para agregar miembros a un grupo existente
async function addMembersToGroup(chatId, members) {
    const currentUser = getCurrentUser();
    if (!currentUser || members.length === 0) return;

    const lang = getUserLanguage();

    try {
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, {
            participants: arrayUnion(...members.map(m => m.id))
        });

        const memberNames = await Promise.all(members.map(async m => {
            const docSnap = await getDoc(doc(db, 'users', m.id));
            const data = docSnap.exists() ? docSnap.data() : null;
            return data?.username || (data?.email || m.email).split('@')[0];
        }));

        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const senderName = userDoc.exists() ? (userDoc.data().username || userDoc.data().email.split('@')[0]) : 'Usuario';

        await addDoc(collection(db, 'chats', chatId, 'messages'), {
            text: `${senderName} ${getTranslation('addedMembers', lang)} ${memberNames.join(', ')}`,
            type: 'system',
            timestamp: serverTimestamp(),
            senderId: 'system'
        });
    } catch (error) {
        console.error('Error al agregar miembros:', error);
        throw error;
    }
}

let recognition = null; // variable global para la instancia

function initializeSpeechRecognition(langCode) {
    if (!('webkitSpeechRecognition' in window)) {
        console.error('El reconocimiento de voz no está soportado en este navegador');
        return null;
    }

    const recognitionInstance = new webkitSpeechRecognition();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = langCode || 'en-US';

    recognitionInstance.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript = transcript;
                messageInput.value = finalTranscript;
            } else {
                interimTranscript += transcript;
                messageInput.value = interimTranscript;
            }
        }
    };

    recognitionInstance.onerror = (event) => {
        console.error('Error en reconocimiento de voz:', event.error);
        stopRecording();
        showError('errorVoiceRecognition');
    };

    recognitionInstance.onend = () => {
        stopRecording();
    };

    return recognitionInstance;
}

// Función para detener grabación
function stopRecording() {
    if (recognition) {
        recognition.stop();
        recognition = null;
    }
    isRecording = false;
    micButton.classList.remove('recording');
    const currentLang = languageSelect ? languageSelect.value : getUserLanguage();
    messageInput.placeholder = getTranslation('writeMessage', currentLang);
}

// Función para esperar que el reconocimiento termine de detenerse
function waitForRecognitionStop() {
    return new Promise((resolve) => {
        if (!recognition) {
            resolve();
        } else {
            recognition.onend = () => {
                resolve();
            };
            recognition.stop();
        }
    });
}

micButton.addEventListener('click', async () => {
    if (!currentChat) {
        showError('errorNoChat');
        return;
    }

    if (isRecording) {
        stopRecording();
    } else {
        // Asegurarnos de que cualquier reconocimiento previo se detenga
        await waitForRecognitionStop();
        await new Promise(r => setTimeout(r, 10));

        // Obtener el idioma actual directamente del selector
        const currentLang = document.getElementById('languageSelect')?.value || 
                          document.getElementById('languageSelectMain')?.value || 
                          getUserLanguage();

        console.log('🎤 Iniciando reconocimiento de voz en idioma:', currentLang);

        const languageMapping = {
            'es': 'es-ES',
            'en': 'en-US',
            'it': 'it-IT',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'pt': 'pt-PT'
        };

        const langCode = languageMapping[currentLang] || 'en-US';
        console.log('🌐 Código de idioma para reconocimiento:', langCode);

        // Crear nueva instancia de reconocimiento con el idioma actual
        recognition = initializeSpeechRecognition(langCode);
        recognition.start();
        micButton.classList.add('recording');
        isRecording = true;

        if (!messageInput.value.trim()) {
            messageInput.placeholder = getTranslation('listening', currentLang);
        }
    }
});

// Manejo del teclado en iOS
function handleKeyboard() {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    let keyboardHeight = 0;
    const body = document.body;
    const mainScreen = document.getElementById('mainScreen');
    const messagesList = document.querySelector('.messages-list');
    const messageInput = document.querySelector('.message-input');

    visualViewport.addEventListener('resize', () => {
        // Calcular la altura del teclado
        const newKeyboardHeight = window.innerHeight - visualViewport.height;
        
        if (newKeyboardHeight > 0) {
            // El teclado está abierto
            keyboardHeight = newKeyboardHeight;
            document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
            
            body.classList.add('keyboard-open');
            mainScreen.classList.add('keyboard-open');
            messagesList.classList.add('keyboard-open');
            messageInput.classList.add('keyboard-open');

            // Asegurar que el último mensaje sea visible
            setTimeout(() => {
                messagesList.scrollTop = messagesList.scrollHeight;
            }, 100);
        } else {
            // El teclado está cerrado
            keyboardHeight = 0;
            document.documentElement.style.setProperty('--keyboard-height', '0px');
            
            body.classList.remove('keyboard-open');
            mainScreen.classList.remove('keyboard-open');
            messagesList.classList.remove('keyboard-open');
            messageInput.classList.remove('keyboard-open');
        }
    });
}

// Inicializar el manejo del teclado si estamos en iOS
if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
    handleKeyboard();
}

// Asegurar que el scroll funcione correctamente después de que se cierre el teclado
document.addEventListener('focusout', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        setTimeout(() => {
            window.scrollTo(0, 0);
        }, 50);
    }
});

// Prevenir el zoom en inputs en iOS
document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
});

// Asegurar que el scroll funcione correctamente al abrir el chat
function adjustScrollAfterKeyboard() {
    const messagesList = document.querySelector('.messages-list');
    if (messagesList) {
        messagesList.scrollTop = messagesList.scrollHeight;
    }
}

// Llamar a la función cuando se abre un chat
const originalOpenChat = openChat;
openChat = async function(...args) {
    await originalOpenChat.apply(this, args);
    adjustScrollAfterKeyboard();
}; 

// Asegurar que el scroll funcione correctamente después de que se cierre el teclado
document.addEventListener('focusout', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        setTimeout(() => {
            window.scrollTo(0, 0);
        }, 50);
    }
});

// Prevenir el zoom en inputs en iOS
document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
});

// Función para sincronizar el idioma al iniciar sesión
async function syncUserLanguage(user) {
    try {
        console.log('🔄 Sincronizando idioma del usuario...');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.language) {
                console.log('📥 Idioma encontrado en la base de datos:', userData.language);
                setUserLanguage(userData.language);
                translateInterface(userData.language);
                // Actualizar el tema según el idioma
                updateTheme(userData.language);
            } else {
                // Si no hay idioma en la base de datos, usar el del state
                const currentLanguage = getUserLanguage();
                console.log('📤 Guardando idioma actual en la base de datos:', currentLanguage);
                await updateDoc(doc(db, 'users', user.uid), {
                    language: currentLanguage,
                    lastUpdated: serverTimestamp()
                });
                // Actualizar el tema según el idioma actual
                updateTheme(currentLanguage);
            }
        }
    } catch (error) {
        console.error('❌ Error al sincronizar idioma:', error);
    }
}

const togglePassword = document.getElementById("togglePassword");

togglePassword.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePassword.textContent = isHidden ? "🙈" : "👁️";
});


document.addEventListener("DOMContentLoaded", () => {
    const languageSelect = document.getElementById("languageSelect");
    const themeSelect = document.getElementById("themeSelect");

    function applyTheme() {
        const lang = languageSelect.value;
        const theme = themeSelect.value;

        // 👉 Guardar en localStorage
        localStorage.setItem("selectedLanguage", lang);
        localStorage.setItem("selectedTheme", theme);

        // 👉 Aplicar clases al <body>
        document.body.className = `theme-set-${theme} theme-${lang}`;
    }

    languageSelect.addEventListener("change", applyTheme);
    themeSelect.addEventListener("change", applyTheme);

    // 👉 Restaurar valores si existen en localStorage
    const savedLang = localStorage.getItem("selectedLanguage");
    const savedTheme = localStorage.getItem("selectedTheme");
    if (savedLang) languageSelect.value = savedLang;
    if (savedTheme) themeSelect.value = savedTheme;

    applyTheme();
});


// Funcionalidad del selector de tema
const themeSelectMain = document.getElementById("themeSelectMain");

if (themeSelectMain) {
    // Restaurar tema guardado
    const savedTheme = localStorage.getItem("selectedTheme");
    if (savedTheme) {
        themeSelectMain.value = savedTheme;
        document.body.classList.forEach(cls => {
            if (cls.startsWith("theme-set-")) {
                document.body.classList.remove(cls);
            }
        });
        document.body.classList.add(`theme-set-${savedTheme}`);
    }

    themeSelectMain.addEventListener("change", () => {
        const selectedTheme = themeSelectMain.value;
        const lang = getUserLanguage();
        updateThemeAndLanguage(selectedTheme, lang);
    });
}


/*
const themeSelectMain = document.getElementById("themeSelectMain");

if (themeSelectMain) {
    themeSelectMain.addEventListener("change", () => {
        const selectedTheme = themeSelectMain.value; // banderas, elegante, elegante2, creativo
        const currentLang = document.getElementById("languageSelectMain").value || "es";

        // Quitar cualquier clase de tema anterior
        document.body.classList.forEach(cls => {
            if (cls.startsWith("theme-set-")) {
                document.body.classList.remove(cls);
            }
        });

        // Aplicar nueva clase combinada
        document.body.classList.add(`theme-set-${selectedTheme}`);
        document.body.classList.add(`theme-${currentLang}`);
    });
}
*/

// Funcionalidad de la página de ajustes
document.addEventListener('DOMContentLoaded', function() {
    const btnSettings = document.querySelectorAll('#btnSettings');
    const btnChats = document.querySelectorAll('#btnChats');
    const btnGroups = document.querySelectorAll('#btnGroups');
    const backFromSettings = document.getElementById('backFromSettings');
    const backFromGroups = document.getElementById('backFromGroups');
    const settingsUsername = document.getElementById('settingsUsername');
    const settingsLanguage = document.getElementById('settingsLanguage');
    const settingsTheme = document.getElementById('settingsTheme');
    const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');


    // Función para actualizar los botones activos
    function updateActiveButtons(activeId) {
        document.querySelectorAll('.nav-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll(`#${activeId}`).forEach(btn => {
            btn.classList.add('active');
        });
    }

    // Mostrar página de chats
    btnChats.forEach(btn => {
        btn.addEventListener('click', function() {
            if (chatList) {
                chatList.classList.remove('hidden');
                if (settingsPage) settingsPage.classList.add('hidden');
                if (groupsPage) groupsPage.classList.remove('active');
                updateActiveButtons('btnChats');
                currentListType = 'individual';
                setupRealtimeChats(chatList, 'individual');
            }
        });
    });

    // Mostrar página de grupos
    btnGroups.forEach(btn => {
        btn.addEventListener('click', function() {
            if (groupsPage && chatList) {
                groupsPage.classList.add('active');
                chatList.classList.add('hidden');
                if (settingsPage) settingsPage.classList.add('hidden');
                updateActiveButtons('btnGroups');
                currentListType = 'group';
                setupRealtimeChats(groupsListEl, 'group');
            }
        });
    });

    // Mostrar página de ajustes
    btnSettings.forEach(btn => {
        btn.addEventListener('click', function() {
            const currentUser = getCurrentUser();
            if (settingsPage && chatList) {
                settingsPage.classList.remove('hidden');
                chatList.classList.add('hidden');
                if (groupsPage) groupsPage.classList.remove('active');
                updateActiveButtons('btnSettings');
                
                // Actualizar el nombre de usuario en ajustes
                if (settingsUsername && currentUser) {
                    const name = currentUser.username || currentUser.email?.split('@')[0] || 'Usuario';
                    settingsUsername.value = name;
                    settingsUsername.setAttribute('readonly', true);
                }
            }
        });
    });

    // Volver desde grupos
    if (backFromGroups) {
        backFromGroups.addEventListener('click', function() {
            if (groupsPage && chatList) {
                groupsPage.classList.remove('active');
                chatList.classList.remove('hidden');
                updateActiveButtons('btnChats');
                currentListType = 'individual';
                setupRealtimeChats(chatList, 'individual');
            }
        });
    }


    // Volver desde ajustes
    if (backFromSettings) {
        backFromSettings.addEventListener('click', function() {
            if (settingsPage && chatList) {
                settingsPage.classList.add('hidden');
                chatList.classList.remove('hidden');
                if (groupsPage) groupsPage.classList.remove('active');
                updateActiveButtons('btnChats');
                currentListType = 'individual';
                setupRealtimeChats(chatList, 'individual');
            }
        });
    }

    // Manejador para el botón de crear grupo en la página de grupos
    document.getElementById('createGroupFromGroups').addEventListener('click', () => {
        showGroupCreationModal();
    });
});




