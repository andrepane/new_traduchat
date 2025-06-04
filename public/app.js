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
    arrayUnion
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
    setupRealtimeChats,
    openChat,
    loadInitialMessages,
    loadMoreMessages,
    sendMessage,
    setTypingStatus,
    handleTyping,
    showTypingIndicator,
    hideTypingIndicator,
    markChatAsRead,
    getChatReadTimes
} from './modules/chat.js';

import {
    showAuthScreen,
    showMainScreen,
    showLoadingScreen,
    hideLoadingScreen,
    toggleChatList,
    updateTheme,
    updateThemeAndLanguage,
    showError
} from './modules/ui.js';

import {
    getUserLanguage,
    getCurrentUser
} from './modules/state.js';



const userLanguage = getUserLanguage(); // ✅ ahora sí puedes usarla


// Antes de llamar a startAuthListener

setUserLanguage(userLanguage);

startAuthListener(async (userData) => {
    if (userData) {
        console.log('Usuario autenticado:', userData.email);
        console.log('User ID:', userData.uid);

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

// Variables para grupos
let selectedUsers = new Set();
let isGroupCreationMode = false;

// Variables para grabación de audio
let isRecording = false;

// Variables para paginación
const MESSAGES_PER_BATCH = 20; // Número de mensajes a cargar por lote
let isLoadingMore = false;
let allMessagesLoaded = false;
let lastVisibleMessage = null;
let lastProcessedMessageId = null; // Variable para evitar duplicados



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
    alert(getTranslation('demoVerificationCode', getUserLanguage(), code));
}

// Función para enviar el código vía API
async function sendVerificationCode(phoneNumber) {
    try {
        const response = await fetch('http://localhost:3000/api/send-code', {
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
        alert(getTranslation('errorSendingCode', getUserLanguage(), error.message));
        return false;
    }
}

// Función para verificar el código vía API
async function verifyCode(phoneNumber, code) {
    try {
        const response = await fetch('http://localhost:3000/api/verify-code', {
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
        alert(getTranslation('errorVerifyingCode', getUserLanguage(), error.message));
        return false;
    }
}

// Función para mostrar mensajes de error

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
        alert(getTranslation('errorUsernameChars', getUserLanguage()));
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
                alert(getTranslation('errorTooManyAttempts', getUserLanguage()));
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

// Función para actualizar el tema y el idioma

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
        alert(getTranslation('chatDeleted', getUserLanguage()));

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
                <button class="cancel-delete">${getTranslation('cancel', currentLang)}</button>
                <button class="confirm-delete">${getTranslation('deleteChat', currentLang)}</button>
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
            <button class="start-chat-btn" data-userid="${user.id}" data-translate="startChat">
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
// Eventos para enviar mensajes
sendMessageBtn.addEventListener('click', () => {
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
        alert(getTranslation('logoutSuccess', userLanguage));
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        alert(getTranslation('errorGeneric', userLanguage));
    }
}

// Evento para el botón de cerrar sesión
settingsLogoutBtn.addEventListener('click', handleLogout);

// Evento para el botón de volver
document.addEventListener('DOMContentLoaded', () => {
    const backButton = document.getElementById('backToChats');
    const addBtn = document.getElementById('addMembersBtn');
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
});

// Función para manejar la navegación entre vistas

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
                        <button id="createGroupBtn" disabled data-translate="createGroup">
                            ${getTranslation('createGroup', userLanguage)}
                        </button>
                        <button id="cancelGroupBtn" data-translate="cancel">
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
            alert(getTranslation('groupCreated', userLanguage));
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
        await addDoc(collection(db, 'chats', groupChatRef.id, 'messages'), {
            text: `Grupo "${groupName}" creado por ${currentUser.email}`,
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
                        <button id="confirmAddMembers" disabled data-translate="addMembers">${getTranslation('addMembers', userLanguage)}</button>
                        <button id="cancelAddMembers" data-translate="cancel">${getTranslation('cancel', userLanguage)}</button>
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
            alert(getTranslation('membersAdded', userLanguage));
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
                if (groupsPage) groupsPage.classList.add('hidden');
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
                groupsPage.classList.remove('hidden');
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
                if (groupsPage) groupsPage.classList.add('hidden');
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
                groupsPage.classList.add('hidden');
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



