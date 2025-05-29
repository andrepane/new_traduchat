// Firebase imports
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
    startAfter
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';

import { translations, getTranslation, translateInterface, animateTitleWave } from './translations.js';
import { translateText, getFlagEmoji, AVAILABLE_LANGUAGES } from './translation-service.js';

import { auth } from './modules/firebase.js'; // Esto lo importa de forma limpia y segura
import { state } from './modules/state.js';
import { startAuthListener, setUserLanguage } from './modules/auth.js';

import { initializeNotifications } from './modules/notificaciones.js';

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
        setupRealtimeChats();
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
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessage');
const messagesList = document.getElementById('messagesList');
const searchInput = document.getElementById('searchContacts');
const newChatBtn = document.getElementById('newChat');
const userInfo = document.getElementById('userInfo');
const currentChatInfo = document.getElementById('currentChatInfo');

const logoutBtn = document.getElementById('logoutBtn');


// Referencias adicionales para móvil
const backButton = document.getElementById('backToChats');
const sidebar = document.querySelector('.sidebar');

// Variables globales
let languageSelect;
let languageSelectMain;
let currentUser = null;
let currentChat = null;
let verificationCode = null;
let timerInterval = null;
const CODE_EXPIRY_TIME = 5 * 60; // 5 minutos en segundos
let unsubscribeMessages = null; // Variable para almacenar la función de cancelación de suscripción
let typingTimeouts = {};
let lastSender = null;
let unsubscribeChats = null;

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
    timerElement.textContent = `Código válido por: ${formatTime(timeLeft)}`;
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        timerElement.textContent = `Código válido por: ${formatTime(timeLeft)}`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            verificationCode = null;
            resendCodeBtn.disabled = false;
            timerElement.textContent = 'Código expirado';
        }
    }, 1000);
}

// Función para simular el envío de SMS
function simulateSendSMS(phoneNumber, code) {
    console.log(`Código enviado a ${phoneNumber}: ${code}`);
    // En una implementación real, aquí se llamaría a un servicio de SMS
    alert(`Para fines de demostración, tu código es: ${code}`);
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
        alert('Error al enviar el código: ' + error.message);
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
        alert('Error al verificar el código: ' + error.message);
        return false;
    }
}

// Función para mostrar mensajes de error
function showError(errorKey) {
    alert(getTranslation(errorKey, userLanguage));
}

// Función para actualizar la información del usuario
function updateUserInfo(user) {
    if (!user) {
        console.warn('updateUserInfo: usuario no definido');
        return;
    }

    const name = user.username || user.email?.split('@')[0] || 'Usuario';
    userInfo.textContent = name;
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
        alert('El nombre de usuario solo puede contener letras, números, guiones y guiones bajos, y debe tener entre 3 y 20 caracteres');
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
                alert('Demasiados intentos. Intenta más tarde.');
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
        setupRealtimeChats();
    } catch (error) {
        console.error('Error al actualizar datos del usuario:', error);
        if (error.code === 'permission-denied') {
            // Si es un error de permisos pero el usuario está autenticado, continuar
            showMainScreen();
            updateUserInfo({...user, username});
            setupRealtimeChats();
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

    const handleLanguageChange = async (newLang) => {
        console.log('🔄 handleLanguageChange llamado con:', newLang);

        await setUserLanguage(newLang);
        translateInterface(newLang);

        if (languageSelect) languageSelect.value = newLang;
        if (languageSelectMain) languageSelectMain.value = newLang;

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

            if (languageSelect) languageSelect.value = lang;
            if (languageSelectMain) languageSelectMain.value = lang;

            showAuthScreen();
        }

        hideLoadingScreen();
    });
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

// Función para mostrar la pantalla principal
function showMainScreen() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('mainScreen').classList.add('active');
    toggleChatList(true); // Mostrar la lista de chats por defecto
}

// Función para limpiar el estado del chat
function resetChatState() {
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
    
    // Limpiar UI
    messagesList.innerHTML = '';
    messageInput.value = '';
    currentChatInfo.textContent = getTranslation('selectChat', userLanguage);
    
    // Limpiar estado
    currentChat = null;
    lastSender = null;
    
    // Limpiar lista de chats
    chatList.innerHTML = '';
}

// Función para cargar chats en tiempo real
async function setupRealtimeChats() {
    console.log('Configurando escucha de chats en tiempo real');
    
    // Cancelar suscripción anterior si existe
    if (unsubscribeChats) {
        unsubscribeChats();
        unsubscribeChats = null;
    }

    const currentUser = getCurrentUser();

    if (!db || !currentUser) {
        console.error('Firestore o usuario no inicializados');
        chatList.innerHTML = `<div class="chat-item error">${getTranslation('errorLoadingChats', userLanguage)}</div>`;
        return;
    }

    try {
        console.log('Intentando configurar consulta de chats...');
        const chatsRef = collection(db, 'chats');
        
        const q = query(
          collection(db, 'chats'),
          where('participants', 'array-contains', currentUser.uid),
          orderBy('lastMessageTime', 'desc')
        );


        unsubscribeChats = onSnapshot(q, async (snapshot) => {
            try {
            console.log('Actualización de chats detectada');
            chatList.innerHTML = '';
            
            if (snapshot.empty) {
                chatList.innerHTML = `<div class="chat-item" data-translate="noChats">${getTranslation('noChats', userLanguage)}</div>`;
                return;
            }

            // Obtener todos los chats y ordenarlos manualmente
            const chats = [];
            for (const doc of snapshot.docs) {
                const chatData = doc.data();
                chats.push({
                    id: doc.id,
                    ...chatData,
                    lastMessageTime: chatData.lastMessageTime ? chatData.lastMessageTime.toDate() : new Date(0)
                });
            }

            // Ordenar chats por lastMessageTime
            chats.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

            for (const chat of chats) {
                try {
                    const chatElement = document.createElement('div');
                    chatElement.className = 'chat-item';
                    if (chat.type === 'group') {
                        chatElement.classList.add('group-chat');
                    }
                    if (chat.id === currentChat) {
                        chatElement.classList.add('active');
                    }

                    let chatName = '';
                    if (chat.type === 'group') {
                        chatName = chat.name;
                    } else {
                        const otherUserId = chat.participants.find(id => id !== currentUser.uid);
                        if (otherUserId) {
                            const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
                            if (otherUserDoc.exists()) {
                                const otherUserData = otherUserDoc.data();
                                    chatName = otherUserData.username || otherUserData.email.split('@')[0];
                            }
                        }
                    }

                    const lastMessageTime = chat.lastMessageTime ? 
                        chat.lastMessageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                    chatElement.innerHTML = `
                        <div class="chat-info">
                            <div class="chat-details">
                            <div class="chat-name">${chatName}</div>
                                <div class="last-message">${chat.lastMessage || ''}</div>
                            </div>
                                <div class="last-message-time">${lastMessageTime}</div>
                        </div>
                    `;

                    if (chat.lastMessageTime && Date.now() - chat.lastMessageTime.getTime() < 2000) {
                        chatElement.classList.add('chat-updated');
                        setTimeout(() => chatElement.classList.remove('chat-updated'), 2000);
                    }

                    chatElement.addEventListener('click', () => {
                        console.log('Abriendo chat:', chat.id);
                        document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
                        chatElement.classList.add('active');
                        openChat(chat.id);
                    });

                    chatList.appendChild(chatElement);
                } catch (error) {
                    console.error('Error al procesar chat individual:', error);
                }
                }
            } catch (error) {
                console.error('Error al procesar actualización de chats:', error);
                chatList.innerHTML = `<div class="chat-item error">${getTranslation('errorLoadingChats', userLanguage)}</div>`;
            }
        }, (error) => {
            console.error('Error en escucha de chats:', error);
            // Si el error es de permisos, probablemente el usuario ya no está autenticado
            if (error.code === 'permission-denied') {
                handleLogout();
            } else {
            chatList.innerHTML = `<div class="chat-item error">${getTranslation('errorLoadingChats', userLanguage)}</div>`;
            }
        });

    } catch (error) {
        console.error('Error al configurar escucha de chats:', error);
        chatList.innerHTML = `<div class="chat-item error">${getTranslation('errorLoadingChats', userLanguage)}</div>`;
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
        setupRealtimeChats();
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
    chatList.innerHTML = '';
    
    // Añadir botón de crear grupo
   if (showGroupButton) {
    const createGroupButton = document.createElement('div');
    createGroupButton.className = 'chat-item create-group';
    createGroupButton.innerHTML = `
        <div class="group-button">
            <i class="fas fa-users"></i>
            <span data-translate="createNewGroup">${getTranslation('createNewGroup', userLanguage)}</span>
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
        noUsersMessage.textContent = getTranslation('noUsersFound', userLanguage);
        chatList.appendChild(noUsersMessage);
        return;
    }

    // Mostrar usuarios encontrados
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'chat-item';

        // Contenedor para la información del usuario
        const userInfoContainer = document.createElement('div');
        userInfoContainer.className = 'user-info';

        // Nombre de usuario
        const username = document.createElement('div');
        username.className = 'user-name';
        username.textContent = user.username;

        // Email del usuario
        const userEmail = document.createElement('div');
        userEmail.className = 'user-email';
        userEmail.textContent = user.email;

        userInfoContainer.appendChild(username);
        userInfoContainer.appendChild(userEmail);

        // Botón de iniciar chat
        const startChatBtn = document.createElement('button');
        startChatBtn.className = 'start-chat-btn';
        startChatBtn.setAttribute('data-userid', user.id);
        startChatBtn.innerHTML = `
            <i class="fas fa-comment"></i>
            <span data-translate="startChat">${getTranslation('startChat', userLanguage)}</span>
        `;

        startChatBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que el clic se propague al elemento padre
            console.log('Iniciando chat con usuario:', user.id);
            createChat(user.id);
        });

        userElement.appendChild(userInfoContainer);
        userElement.appendChild(startChatBtn);
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
                senderName = 'Tú';
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
                <button class="play-button">
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
                <span class="message-text">${messageText}</span>
                <span class="message-time">${timeString}</span>
            </div>
        `;
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
        messagesList.scrollTop = messagesList.scrollHeight;
    } else {
        console.error('❌ Lista de mensajes no encontrada');
    }
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
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    // Resetear variables de paginación
    isLoadingMore = false;
    allMessagesLoaded = false;
    lastVisibleMessage = null;

    currentChat = chatId;
    
    try {
        // Obtener información del chat
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        if (!chatDoc.exists()) {
            console.error('Chat no encontrado:', chatId);
            return;
        }

        const chatData = chatDoc.data();
        console.log('Datos del chat:', chatData);

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

        // Cambiar a la vista del chat
        toggleChatList(false);

        // Cargar mensajes iniciales
        await loadInitialMessages(chatId);

        // Suscribirse a nuevos mensajes
        const messagesRef = collection(db, 'chats', chatId, 'messages');
const newMessagesQuery = query(
    messagesRef,
    orderBy('timestamp', 'desc'),
    limit(1)
);

let initialSnapshotSkipped = false;

unsubscribeMessages = onSnapshot(newMessagesQuery, (snapshot) => {
    if (!initialSnapshotSkipped) {
        // Saltar el primer snapshot porque es el que ya se mostró con loadInitialMessages
        initialSnapshotSkipped = true;
        return;
    }

    snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
            const messageData = { ...change.doc.data(), id: change.doc.id };

            if (messageData.type === 'system') {
                displaySystemMessage(messageData);
            } else {
                await displayMessage(messageData);
            }
            if (messagesList) {
                messagesList.scrollTop = messagesList.scrollHeight;
            }
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
            return;
        }

        const messages = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));

        lastVisibleMessage = snapshot.docs[snapshot.docs.length - 1];

        // ✅ Ordenar por timestamp o usar 0 si no hay timestamp
        messages.sort((a, b) => {
            const timeA = a.timestamp?.toMillis?.() || 0;
            const timeB = b.timestamp?.toMillis?.() || 0;
            return timeA - timeB;
        });

        // ✅ Mostrar mensajes
        await Promise.all(messages.map(async (messageData) => {
            if (messageData.type === 'system') {
                displaySystemMessage(messageData);
            } else {
                await displayMessage(messageData);
            }
        }));

        messagesList.scrollTop = messagesList.scrollHeight;
    } catch (error) {
        console.error('Error al cargar mensajes iniciales:', error);
        showError('errorGeneric');
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

// Funciones auxiliares para la interfaz
async function setupGroupChatInterface(chatData) {
    const participantsInfo = await Promise.all(
        chatData.participants.map(async (userId) => {
            const userDoc = await getDoc(doc(db, 'users', userId));
            return userDoc.exists() ? userDoc.data() : { email: 'Usuario desconocido' };
        })
    );

    const groupInfoElement = document.createElement('div');
    groupInfoElement.className = 'group-info';
    groupInfoElement.innerHTML = `
        <div class="group-name">${chatData.name}</div>
        <div class="group-participants">
            ${participantsInfo.map(user => user.username || user.email.split('@')[0]).join(', ')}
        </div>
    `;

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
        currentChatInfo.textContent = otherUserData.email;
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
                    alert(limitMessage);
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

// Eventos para enviar mensajes
sendMessageBtn.addEventListener('click', () => {
    console.log('Botón enviar clickeado');
    sendMessage(messageInput.value);
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
        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
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
logoutBtn.addEventListener('click', handleLogout);

// Evento para el botón de volver
document.addEventListener('DOMContentLoaded', () => {
    const backButton = document.getElementById('backToChats');
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
});

// Función para manejar la navegación entre vistas
function toggleChatList(show) {
    console.log('Alternando vista de chat, mostrar lista:', show);
    
    const sidebar = document.querySelector('.sidebar');
    const chatContainer = document.querySelector('.chat-container');
    const backButton = document.getElementById('backToChats');
    
    if (show) {
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
        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
        }

        // Restablecer estado del chat actual
        currentChat = null;
        if (messagesList) {
            messagesList.innerHTML = '';
        }
        if (currentChatInfo) {
            currentChatInfo.textContent = getTranslation('selectChat', userLanguage);
        }

        // Recargar la lista de chats
        setupRealtimeChats();
    } else {
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
        backButton.style.display = window.innerWidth <= 768 && !show ? 'block' : 'none';
    }

    adjustMobileLayout();
}

// Asegurarse de que el botón de retorno se muestre/oculte correctamente al cambiar el tamaño de la ventana
window.addEventListener('resize', () => {
    const backButton = document.getElementById('backToChats');
    if (backButton) {
        if (window.innerWidth <= 768 && document.querySelector('.chat-container')?.style.display !== 'none') {
            backButton.style.display = 'block';
        } else {
            backButton.style.display = 'none';
        }
    }
});

// Función para actualizar la lista de usuarios seleccionados
function updateSelectedUsersList(selectedUsersList, createGroupBtn) {
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
            updateSelectedUsersList(selectedUsersList, createGroupBtn);
        });
    });

    // Actualizar estado del botón
    if (createGroupBtn) {
        const groupNameInput = document.getElementById('groupName');
        createGroupBtn.disabled = selectedUsers.size < 2 || !groupNameInput?.value.trim();
    }
}

// Función para mostrar el modal de creación de grupo
function showGroupCreationModal() {
    // Limpiar usuarios seleccionados anteriormente
    selectedUsers.clear();

    const modalHtml = `
        <div id="groupModal" class="modal">
            <div class="modal-content">
                <h2>${getTranslation('createGroup', userLanguage)}</h2>
                <div class="group-form">
                    <input type="text" id="groupName" placeholder="${getTranslation('groupNamePlaceholder', userLanguage)}" />
                    <div class="selected-users">
                        <h3>
                            ${getTranslation('selectedUsers', userLanguage)}
                            <span class="users-count">(0/2 mínimo)</span>
                        </h3>
                        <div id="selectedUsersList"></div>
                    </div>
                    <div class="user-search">
                        <input type="text" id="groupUserSearch" placeholder="${getTranslation('searchUsers', userLanguage)}" />
                        <div id="userSearchResults"></div>
                    </div>
                    <div class="modal-buttons">
                        <button id="createGroupBtn" disabled>
                            ${getTranslation('createGroup', userLanguage)}
                        </button>
                        <button id="cancelGroupBtn">
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
        usersCount.textContent = `(${selectedUsers.size}/2 mínimo)`;
        usersCount.style.color = selectedUsers.size >= 2 ? '#10b981' : '#ef4444';
    }

    // Búsqueda de usuarios
    userSearchInput.addEventListener('input', debounce(async (e) => {
        const searchTerm = e.target.value.trim();
        if (searchTerm.length < 2) {
            userSearchResults.innerHTML = '';
            return;
        }

        try {
            const users = await searchUsersForGroup(searchTerm);
            displayUserSearchResults(users, userSearchResults, selectedUsersList, createGroupBtn);
        } catch (error) {
            console.error('Error al buscar usuarios:', error);
            userSearchResults.innerHTML = `<div class="error-message">${getTranslation('errorSearch', userLanguage)}</div>`;
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
    updateSelectedUsersList(selectedUsersList, createGroupBtn);
    updateUsersCount();
}

// Función para buscar usuarios para el grupo
async function searchUsersForGroup(searchTerm) {
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
function displayUserSearchResults(users, container, selectedUsersList, createGroupBtn) {
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
                
                updateSelectedUsersList(selectedUsersList, createGroupBtn);
                item.remove();
                
                // Actualizar estado del botón de crear
                const groupNameInput = document.getElementById('groupName');
                createGroupBtn.disabled = !groupNameInput.value.trim() || selectedUsers.size < 2;
                
                // Actualizar contador
                const usersCount = document.querySelector('.users-count');
                if (usersCount) {
                    usersCount.textContent = `(${selectedUsers.size}/2 mínimo)`;
                    usersCount.style.color = selectedUsers.size >= 2 ? '#10b981' : '#ef4444';
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
    // Restaurar placeholder al idioma actual
    const currentLang = getUserLanguage();
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
        // Esperar que el reconocimiento anterior se detenga (si existe)
        await waitForRecognitionStop();

         await new Promise(r => setTimeout(r, 10));

        // Obtener idioma actual y mapearlo para reconocimiento
        const currentLang = languageSelect ? languageSelect.value : getUserLanguage();
        const languageMapping = {
            'es': 'es-ES',
            'en': 'en-US',
            'it': 'it-IT',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'pt': 'pt-PT'
        };
        const langCode = languageMapping[currentLang] || 'en-US';

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
            } else {
                // Si no hay idioma en la base de datos, usar el del state
                const currentLanguage = getUserLanguage();
                console.log('📤 Guardando idioma actual en la base de datos:', currentLanguage);
                await updateDoc(doc(db, 'users', user.uid), {
                    language: currentLanguage,
                    lastUpdated: serverTimestamp()
                });
            }
        }
    } catch (error) {
        console.error('❌ Error al sincronizar idioma:', error);
    }
}
