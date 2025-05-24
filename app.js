// Firebase imports
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged,
    signOut
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
    getFirestore
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { translations, getTranslation, translateInterface, animateTitleWave } from './translations.js';
import { translateText, getFlagEmoji, AVAILABLE_LANGUAGES } from './translation-service.js';

// Verificar inicialización de Firebase
console.log('Verificando inicialización de Firebase...');
if (!window.db) {
    console.log('Inicializando Firestore...');
    window.db = getFirestore();
}
if (!window.auth) {
    console.error('Auth no está inicializado!');
}

// Referencias a elementos del DOM
const authScreen = document.getElementById('authScreen');
const mainScreen = document.getElementById('mainScreen');
const emailInput = document.getElementById('emailInput');
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
const languageSelect = document.getElementById('languageSelect');
const languageSelectMain = document.getElementById('languageSelectMain');
const logoutBtn = document.getElementById('logoutBtn');

// Referencias adicionales para móvil
const backButton = document.getElementById('backToChats');
const sidebar = document.querySelector('.sidebar');

// Variables globales
let currentUser = null;
let currentChat = null;
let verificationCode = null;
let timerInterval = null;
const CODE_EXPIRY_TIME = 5 * 60; // 5 minutos en segundos
let userLanguage = localStorage.getItem('userLanguage') || 'es';
let unsubscribeMessages = null; // Variable para almacenar la función de cancelación de suscripción
let typingTimeouts = {};
let lastSender = null;
let unsubscribeChats = null;

// Variables para grupos
let selectedUsers = new Set();
let isGroupCreationMode = false;

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
    const phoneNumber = localStorage.getItem('userPhone');
    if (userInfo) {
        userInfo.textContent = `${user.email} (${phoneNumber || getTranslation('noPhone', userLanguage)})`;
    }
    if (currentChatInfo) {
        currentChatInfo.textContent = getTranslation('selectChat', userLanguage);
    }
}

// Manejadores de eventos para el cambio de idioma
languageSelect.value = userLanguage;
languageSelectMain.value = userLanguage;

languageSelect.addEventListener('change', (e) => {
    userLanguage = e.target.value;
    languageSelectMain.value = userLanguage;
    translateInterface(userLanguage);
});

languageSelectMain.addEventListener('change', (e) => {
    userLanguage = e.target.value;
    languageSelect.value = userLanguage;
    translateInterface(userLanguage);
});

// Función de login/registro
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const phoneNumber = countrySelect.value + phoneInput.value.trim();

    if (!email || !password || !phoneNumber) {
        showError('errorEmptyFields');
        return;
    }

    if (password.length < 6) {
        showError('errorPassword');
        return;
    }

    const auth = window.auth;
    const db = window.db;
    
    if (!auth || !db) {
        console.error('Auth o Firestore no están inicializados');
        showError('errorGeneric');
        return;
    }

    try {
        console.log('Iniciando proceso de registro/login...');
        let userCredential;
        
        try {
            console.log('Intentando crear nuevo usuario:', email);
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log('Usuario creado exitosamente:', userCredential.user.uid);
        } catch (error) {
            console.log('Error en creación:', error.code);
            if (error.code === 'auth/email-already-in-use') {
                console.log('Email en uso, intentando login...');
                userCredential = await signInWithEmailAndPassword(auth, email, password);
                console.log('Login exitoso:', userCredential.user.uid);
            } else {
                throw error;
            }
        }

        const user = userCredential.user;
        console.log('Guardando datos en Firestore para usuario:', user.uid);

        // Crear el documento del usuario
        const userDocRef = doc(db, 'users', user.uid);
        const userData = {
            uid: user.uid,
            email: email.toLowerCase(),
            phoneNumber: phoneNumber,
            language: userLanguage,
            lastUpdated: serverTimestamp()
        };

        // Si es nuevo registro, añadir createdAt
        if (!userCredential.operationType || userCredential.operationType === 'signIn') {
            userData.createdAt = serverTimestamp();
        }

        console.log('Datos a guardar:', userData);
        await setDoc(userDocRef, userData, { merge: true });
        console.log('Datos guardados exitosamente en Firestore');

        // Verificar que se guardó correctamente
        const savedDoc = await getDoc(userDocRef);
        console.log('Documento guardado:', savedDoc.exists(), savedDoc.data());

        localStorage.setItem('userPhone', phoneNumber);
        localStorage.setItem('userLanguage', userLanguage);
        
        showMainScreen();
        updateUserInfo(user);
        setupRealtimeChats();
    } catch (error) {
        console.error('Error completo:', error);
        
        switch (error.code) {
            case 'auth/weak-password':
                showError('errorPassword');
                break;
            case 'auth/invalid-email':
                showError('errorInvalidEmail');
                break;
            case 'auth/network-request-failed':
                showError('errorNetwork');
                break;
            default:
                showError('errorGeneric');
        }
    }
});

// Función para mostrar la pantalla de autenticación
function showAuthScreen() {
    document.getElementById('mainScreen').classList.remove('active');
    document.getElementById('authScreen').classList.add('active');
    document.body.classList.remove('in-chat');
}

// Inicialización cuando se carga el documento
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Cargado');
    showLoadingScreen();

    // Inicializar la interfaz con el idioma guardado y activar la animación
    translateInterface(userLanguage);
    setTimeout(animateTitleWave, 100);

    const auth = window.auth;
    const db = window.db;
    
    if (!auth || !db) {
        console.error('Auth o Firestore no están inicializados');
        hideLoadingScreen();
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('Usuario autenticado:', user.email);
            console.log('User ID:', user.uid);
            
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                
                if (!userDoc.exists()) {
                    console.log('Creando documento de usuario...');
                    const phoneNumber = localStorage.getItem('userPhone') || '';
                    await setDoc(userDocRef, {
                        uid: user.uid,
                        email: user.email.toLowerCase(),
                        phoneNumber: phoneNumber,
                        language: userLanguage,
                        createdAt: serverTimestamp(),
                        lastUpdated: serverTimestamp()
                    });
                    console.log('Documento de usuario creado exitosamente');
                }
            } catch (error) {
                console.error('Error al verificar/crear documento de usuario:', error);
            }

            hideLoadingScreen();
            showMainScreen();
            updateUserInfo(user);
            setupRealtimeChats();
        } else {
            console.log('No hay usuario autenticado');
            hideLoadingScreen();
            showAuthScreen();
        }
    });

    adjustMobileLayout();
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
    const chatContainer = document.querySelector('.chat-container');
    const sidebar = document.querySelector('.sidebar');
    const messagesList = document.querySelector('.messages-list');
    const inputContainer = document.querySelector('.input-container');
    const mainScreen = document.getElementById('mainScreen');
    
    if (window.innerWidth <= 768) {
        // Prevenir scroll y zoom indeseado en móviles
        document.body.style.height = '100vh';
        document.body.style.overflow = 'hidden';
        
        if (mainScreen) {
            mainScreen.style.height = '100vh';
            mainScreen.style.overflow = 'hidden';
        }

        // Ajustes específicos para móvil
        if (chatContainer) {
            chatContainer.style.width = '100%';
            chatContainer.style.height = '100vh';
            chatContainer.style.position = 'fixed';
            chatContainer.style.top = '0';
            chatContainer.style.left = '0';
            chatContainer.style.zIndex = '1000';
            chatContainer.style.display = 'flex';
            chatContainer.style.flexDirection = 'column';
        }
        
        if (sidebar) {
            sidebar.style.width = '100%';
            sidebar.style.height = '100vh';
            sidebar.style.position = 'fixed';
            sidebar.style.top = '0';
            sidebar.style.left = '0';
            sidebar.style.zIndex = '1000';
        }
        
        if (messagesList) {
            messagesList.style.flex = '1';
            messagesList.style.height = 'calc(100vh - 130px)'; // Ajustado para dejar espacio para el input
            messagesList.style.overflow = 'auto';
            messagesList.style.paddingBottom = '20px';
            messagesList.style.WebkitOverflowScrolling = 'touch'; // Para scroll suave en iOS
        }
        
        if (inputContainer) {
            inputContainer.style.position = 'fixed';
            inputContainer.style.bottom = '0';
            inputContainer.style.left = '0';
            inputContainer.style.width = '100%';
            inputContainer.style.minHeight = '60px';
            inputContainer.style.padding = '10px';
            inputContainer.style.backgroundColor = '#fff';
            inputContainer.style.borderTop = '1px solid #ddd';
            inputContainer.style.zIndex = '1001';
            inputContainer.style.display = 'flex';
            inputContainer.style.alignItems = 'center';
            inputContainer.style.justifyContent = 'space-between';
            
            // Ajustar el input de mensaje
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.style.flex = '1';
                messageInput.style.margin = '0 10px';
                messageInput.style.padding = '8px';
                messageInput.style.fontSize = '16px'; // Previene zoom en iOS
            }
        }
    } else {
        // Restablecer estilos para desktop
        document.body.style.height = '';
        document.body.style.overflow = '';
        
        if (mainScreen) {
            mainScreen.style.height = '';
            mainScreen.style.overflow = '';
        }

        if (chatContainer) {
            chatContainer.style.width = '';
            chatContainer.style.height = '';
            chatContainer.style.position = '';
            chatContainer.style.top = '';
            chatContainer.style.left = '';
            chatContainer.style.zIndex = '';
            chatContainer.style.display = '';
            chatContainer.style.flexDirection = '';
        }
        
        if (sidebar) {
            sidebar.style.width = '';
            sidebar.style.height = '';
            sidebar.style.position = '';
            sidebar.style.top = '';
            sidebar.style.left = '';
            sidebar.style.zIndex = '';
        }
        
        if (messagesList) {
            messagesList.style.flex = '';
            messagesList.style.height = '';
            messagesList.style.overflow = '';
            messagesList.style.paddingBottom = '';
            messagesList.style.WebkitOverflowScrolling = '';
        }
        
        if (inputContainer) {
            inputContainer.style.position = '';
            inputContainer.style.bottom = '';
            inputContainer.style.left = '';
            inputContainer.style.width = '';
            inputContainer.style.minHeight = '';
            inputContainer.style.padding = '';
            inputContainer.style.backgroundColor = '';
            inputContainer.style.borderTop = '';
            inputContainer.style.zIndex = '';
            inputContainer.style.display = '';
            inputContainer.style.alignItems = '';
            inputContainer.style.justifyContent = '';
            
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.style.flex = '';
                messageInput.style.margin = '';
                messageInput.style.padding = '';
                messageInput.style.fontSize = '';
            }
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
    if (unsubscribeChats) {
        unsubscribeChats();
    }

    const db = window.db;
    const currentUser = auth.currentUser;

    if (!db || !currentUser) {
        console.error('Firestore o usuario no inicializados');
        return;
    }

    try {
        console.log('Intentando configurar consulta de chats...');
        const chatsRef = collection(db, 'chats');
        
        // Primero, intentamos obtener los chats sin ordenar
        const q = query(
            chatsRef,
            where('participants', 'array-contains', currentUser.uid)
        );

        unsubscribeChats = onSnapshot(q, async (snapshot) => {
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
                    const otherUserId = chat.participants.find(id => id !== currentUser.uid);
                    if (!otherUserId) continue;

                    // Obtener información del otro usuario
                    const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
                    if (!otherUserDoc.exists()) continue;

                    const otherUserData = otherUserDoc.data();
                    const chatElement = document.createElement('div');
                    chatElement.className = 'chat-item';
                    
                    // Formatear la hora del último mensaje
                    const lastMessageTime = chat.lastMessageTime ? 
                        chat.lastMessageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                    chatElement.innerHTML = `
                        <div class="chat-info">
                            <div class="chat-name">${otherUserData.email}</div>
                            <div class="last-message-container">
                                <div class="last-message">${chat.lastMessage || ''}</div>
                                <div class="last-message-time">${lastMessageTime}</div>
                            </div>
                        </div>
                    `;

                    // Si es un chat nuevo o actualizado, añadir clase para animación
                    if (chat.lastMessageTime && Date.now() - chat.lastMessageTime.getTime() < 2000) {
                        chatElement.classList.add('chat-updated');
                        setTimeout(() => chatElement.classList.remove('chat-updated'), 2000);
                    }

                    chatElement.addEventListener('click', () => {
                        console.log('Abriendo chat:', chat.id);
                        openChat(chat.id);
                    });

                    chatList.appendChild(chatElement);
                } catch (error) {
                    console.error('Error al procesar chat individual:', error);
                }
            }
        }, (error) => {
            console.error('Error en escucha de chats:', error);
            // Mostrar mensaje de error al usuario
            chatList.innerHTML = `<div class="chat-item error">${getTranslation('errorLoadingChats', userLanguage)}</div>`;
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
        const db = window.db;
        const usersRef = collection(db, 'users');
        const currentUserUid = auth.currentUser.uid;
        console.log('Usuario actual:', currentUserUid);
        
        // Obtener todos los usuarios primero
        const allUsersQuery = query(usersRef);
        const snapshot = await getDocs(allUsersQuery);
        
        console.log('Total de usuarios en la base de datos:', snapshot.size);
        
        const users = new Set();
        
        // Buscar coincidencias
        snapshot.forEach(doc => {
            const userData = doc.data();
            console.log('Revisando usuario:', userData.email);
            
            if (userData.uid !== currentUserUid && 
                userData.email && 
                userData.email.toLowerCase().includes(searchTerm.toLowerCase())) {
                console.log('¡Coincidencia encontrada!:', userData.email);
                users.add({ id: userData.uid, ...userData });
            }
        });

        const resultsArray = Array.from(users);
        console.log('Resultados de búsqueda:', resultsArray.length);
        if (resultsArray.length === 0) {
            console.log('No se encontraron usuarios que coincidan con:', searchTerm);
        } else {
            console.log('Usuarios encontrados:', resultsArray.map(u => u.email));
        }
        
        displaySearchResults(resultsArray);
    } catch (error) {
        console.error('Error detallado al buscar usuarios:', error);
        showError('errorSearch');
    }
}

// Función para mostrar resultados de búsqueda
function displaySearchResults(users) {
    chatList.innerHTML = '';
    if (users.length === 0) {
        chatList.innerHTML = `<div class="chat-item" data-translate="noUsersFound">${getTranslation('noUsersFound', userLanguage)}</div>`;
        return;
    }

    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'chat-item search-result';
        userElement.style.display = 'flex';
        userElement.style.justifyContent = 'space-between';
        userElement.style.alignItems = 'center';
        userElement.style.padding = '10px 15px';
        userElement.style.gap = '10px'; // Espacio entre elementos

        // Contenedor para la información del usuario
        const userInfoContainer = document.createElement('div');
        userInfoContainer.className = 'user-info';
        userInfoContainer.style.flex = '1';
        userInfoContainer.style.minWidth = '0'; // Permite que el texto se ajuste
        userInfoContainer.style.overflow = 'hidden'; // Previene desbordamiento

        // Email del usuario con ellipsis si es muy largo
        const userEmail = document.createElement('div');
        userEmail.className = 'user-name';
        userEmail.textContent = user.email;
        userEmail.style.overflow = 'hidden';
        userEmail.style.textOverflow = 'ellipsis';
        userEmail.style.whiteSpace = 'nowrap';
        userEmail.style.marginBottom = '2px';
        userEmail.style.fontSize = '14px';
        userEmail.style.fontWeight = '500';

        // Número de teléfono (si existe)
        const userPhone = document.createElement('div');
        userPhone.className = 'user-phone';
        userPhone.textContent = user.phoneNumber || '';
        userPhone.style.fontSize = '12px';
        userPhone.style.color = '#666';
        userPhone.style.overflow = 'hidden';
        userPhone.style.textOverflow = 'ellipsis';
        userPhone.style.whiteSpace = 'nowrap';

        userInfoContainer.appendChild(userEmail);
        userInfoContainer.appendChild(userPhone);

        // Botón de inicio de chat
        const startChatBtn = document.createElement('button');
        startChatBtn.className = 'start-chat-btn';
        startChatBtn.setAttribute('data-userid', user.id);
        startChatBtn.setAttribute('data-translate', 'startChat');
        startChatBtn.textContent = getTranslation('startChat', userLanguage);
        
        // Estilos del botón
        startChatBtn.style.padding = '6px 12px';
        startChatBtn.style.fontSize = '13px';
        startChatBtn.style.backgroundColor = '#007bff';
        startChatBtn.style.color = 'white';
        startChatBtn.style.border = 'none';
        startChatBtn.style.borderRadius = '4px';
        startChatBtn.style.cursor = 'pointer';
        startChatBtn.style.whiteSpace = 'nowrap';
        startChatBtn.style.minWidth = 'auto';
        startChatBtn.style.flexShrink = '0'; // Evita que el botón se encoja

        // Hover effect
        startChatBtn.addEventListener('mouseover', () => {
            startChatBtn.style.backgroundColor = '#0056b3';
        });
        startChatBtn.addEventListener('mouseout', () => {
            startChatBtn.style.backgroundColor = '#007bff';
        });

        // Click effect
        startChatBtn.addEventListener('mousedown', () => {
            startChatBtn.style.transform = 'scale(0.98)';
        });
        startChatBtn.addEventListener('mouseup', () => {
            startChatBtn.style.transform = 'scale(1)';
        });

        startChatBtn.addEventListener('click', () => {
            console.log('Iniciando chat con usuario:', user.id);
            createChat(user.id);
        });

        // Agregar elementos al contenedor principal
        userElement.appendChild(userInfoContainer);
        userElement.appendChild(startChatBtn);
        
        // Hover effect para todo el elemento
        userElement.addEventListener('mouseover', () => {
            userElement.style.backgroundColor = '#f8f9fa';
        });
        userElement.addEventListener('mouseout', () => {
            userElement.style.backgroundColor = '';
        });

        chatList.appendChild(userElement);
    });

    // Ajustar el diseño para móviles
    if (window.innerWidth <= 768) {
        const searchResults = document.querySelectorAll('.search-result');
        searchResults.forEach(result => {
            result.style.padding = '12px 10px';
            const button = result.querySelector('.start-chat-btn');
            if (button) {
                button.style.padding = '4px 8px';
                button.style.fontSize = '12px';
            }
        });
    }
}

// Función para crear un nuevo chat
async function createChat(otherUserId) {
    console.log('Creando chat con usuario:', otherUserId);
    try {
        const db = window.db;
        const currentUser = auth.currentUser;

        if (!currentUser || !otherUserId) {
            console.error('Falta información necesaria para crear el chat');
            return;
        }

        console.log('Verificando chat existente...');
        // Verificar si ya existe un chat entre estos usuarios
        const chatsRef = collection(db, 'chats');
        const q = query(chatsRef, 
            where('participants', 'array-contains', currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        let existingChat = null;

        querySnapshot.forEach(doc => {
            const chatData = doc.data();
            if (chatData.participants.includes(otherUserId)) {
                console.log('Chat existente encontrado:', doc.id);
                existingChat = { id: doc.id, ...chatData };
            }
        });

        if (existingChat) {
            console.log('Abriendo chat existente:', existingChat.id);
            openChat(existingChat.id);
            return;
        }

        console.log('Creando nuevo chat...');
        // Si no existe, crear nuevo chat
        const newChatRef = await addDoc(collection(db, 'chats'), {
            participants: [currentUser.uid, otherUserId],
            createdAt: serverTimestamp(),
            lastMessage: null,
            lastMessageTime: null
        });

        console.log('Nuevo chat creado:', newChatRef.id);
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
    console.log('Mostrando mensaje:', messageData);
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.error('No hay usuario autenticado al mostrar mensaje');
        return;
    }

    const messageElement = document.createElement('div');
    const isSentByMe = messageData.senderId === currentUser.uid;
    messageElement.className = `message ${isSentByMe ? 'sent' : 'received'}`;
    
    let messageText = messageData.text;
    if (messageData.language !== userLanguage) {
        console.log('Traduciendo mensaje al idioma del usuario:', userLanguage);
        if (messageData.translations && messageData.translations[userLanguage]) {
            messageText = messageData.translations[userLanguage];
        } else {
            try {
                messageText = await translateText(messageText, userLanguage);
            } catch (error) {
                console.error('Error al traducir mensaje:', error);
                messageText = messageData.text + ' [Error de traducción]';
            }
        }
    }
    
    const flag = getFlagEmoji(messageData.language);
    let timeString = '';
    
    try {
        const timestamp = messageData.timestamp ? 
            (typeof messageData.timestamp.toDate === 'function' ? 
                messageData.timestamp.toDate() : 
                new Date(messageData.timestamp)
            ) : new Date();
        timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
        console.error('Error al formatear timestamp:', error);
        timeString = '';
    }
    
    messageElement.innerHTML = `
        <span class="message-flag">${flag}</span>
        <span class="message-text">${messageText}</span>
        <span class="message-time">${timeString}</span>
    `;
    
    if (messagesList) {
        messagesList.appendChild(messageElement);
        messagesList.scrollTop = messagesList.scrollHeight;
    } else {
        console.error('Lista de mensajes no encontrada');
    }
}

// Función para abrir un chat
async function openChat(chatId) {
    console.log('Abriendo chat:', chatId);
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.error('No hay usuario autenticado al abrir chat');
        return;
    }

    // Cancelar la suscripción anterior si existe
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    currentChat = chatId;
    
    try {
        const db = window.db;
        // Obtener información del chat
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        if (!chatDoc.exists()) {
            console.error('Chat no encontrado:', chatId);
            return;
        }

        const chatData = chatDoc.data();
        console.log('Datos del chat:', chatData);
        
        if (chatData.type === 'group') {
            // Es un chat grupal
            if (currentChatInfo) {
                currentChatInfo.textContent = chatData.name;
            }
        } else {
            // Es un chat individual (código existente)
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
            console.log('Datos del otro usuario:', otherUserData);

            // Actualizar la interfaz
            if (currentChatInfo) {
                currentChatInfo.textContent = otherUserData.email;
            }
            if (messagesList) {
                messagesList.innerHTML = '';
            }

            // Cambiar a la vista del chat
            toggleChatList(false);

            // Suscribirse a nuevos mensajes
            const messagesRef = collection(db, 'chats', chatId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'asc'));
            
            unsubscribeMessages = onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const messageData = change.doc.data();
                        console.log('Nuevo mensaje recibido:', messageData);
                        displayMessage(messageData);
                    }
                });
                
                // Scroll al último mensaje
                if (messagesList) {
                    messagesList.scrollTop = messagesList.scrollHeight;
                }
            }, (error) => {
                console.error('Error en la suscripción a mensajes:', error);
            });
        }
    } catch (error) {
        console.error('Error al abrir chat:', error);
        showError('errorOpenChat');
    }
}

// Función para enviar mensaje
async function sendMessage(text) {
    console.log('Intentando enviar mensaje:', text);
    if (!text.trim() || !currentChat) {
        console.log('No hay texto o chat activo');
        return;
    }

    try {
        const db = window.db;
        const user = auth.currentUser;
        
        if (!user) {
            console.error('No hay usuario autenticado');
            return;
        }

        console.log('Preparando mensaje para enviar...');
        // Crear el mensaje
        const messageData = {
            text: text.trim(),
            senderId: user.uid,
            senderEmail: user.email,
            timestamp: serverTimestamp(),
            language: userLanguage,
            translations: {}
        };

        console.log('Enviando mensaje a Firestore...');
        // Enviar el mensaje
        const messagesRef = collection(db, 'chats', currentChat, 'messages');
        const docRef = await addDoc(messagesRef, messageData);
        console.log('Mensaje enviado con ID:', docRef.id);
        
        // Actualizar último mensaje del chat
        const chatRef = doc(db, 'chats', currentChat);
        await updateDoc(chatRef, {
            lastMessage: text.trim(),
            lastMessageTime: serverTimestamp()
        });
        
        // Limpiar el input
        messageInput.value = '';
        
        // Traducir y guardar traducciones
        console.log('Traduciendo mensaje...');
        const otherLanguages = AVAILABLE_LANGUAGES.filter(lang => lang !== userLanguage);
        for (const targetLang of otherLanguages) {
            try {
                const translation = await translateText(text, targetLang);
                await updateDoc(doc(messagesRef, docRef.id), {
                    [`translations.${targetLang}`]: translation
                });
                console.log(`Traducción guardada para ${targetLang}`);
            } catch (translationError) {
                console.error('Error al traducir al', targetLang, translationError);
            }
        }
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
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
        await signOut(auth);
        resetChatState();
        showAuthScreen();
        
        localStorage.removeItem('userLanguage');
        localStorage.removeItem('userPhone');
        
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
            toggleChatList(true);
        });
        
        // Inicialmente ocultar el botón
        backButton.style.display = 'none';
    }
});

// Función para manejar la navegación entre vistas
function toggleChatList(show) {
    const sidebar = document.querySelector('.sidebar');
    const chatContainer = document.querySelector('.chat-container');
    const backButton = document.getElementById('backToChats');
    
    console.log('Alternando vista de chat, mostrar lista:', show);
    
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
        // Limpiar el chat actual
        if (messagesList) {
            messagesList.innerHTML = '';
        }
        if (currentChatInfo) {
            currentChatInfo.textContent = getTranslation('selectChat', userLanguage);
        }
        // Cancelar suscripción a mensajes si existe
        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
        }
        currentChat = null;
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

    // Asegurar que el botón de retorno sea visible solo cuando se muestra el chat en móvil
    if (backButton) {
        if (window.innerWidth <= 768 && !show) {
            backButton.style.display = 'block';
        } else {
            backButton.style.display = 'none';
        }
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

// Función para mostrar el modal de creación de grupo
function showGroupCreationModal() {
    const modalHtml = `
        <div id="groupModal" class="modal">
            <div class="modal-content">
                <h2 data-translate="createGroup">${getTranslation('createGroup', userLanguage)}</h2>
                <div class="group-form">
                    <input type="text" id="groupName" placeholder="${getTranslation('groupNamePlaceholder', userLanguage)}" />
                    <div class="selected-users">
                        <h3 data-translate="selectedUsers">${getTranslation('selectedUsers', userLanguage)}</h3>
                        <div id="selectedUsersList"></div>
                    </div>
                    <div class="user-search">
                        <input type="text" id="groupUserSearch" placeholder="${getTranslation('searchUsers', userLanguage)}" />
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

    // Añadir estilos
    const style = document.createElement('style');
    style.textContent = `
        .modal {
            display: block;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        }
        .modal-content {
            background-color: white;
            margin: 15% auto;
            padding: 20px;
            border-radius: 8px;
            width: 80%;
            max-width: 500px;
        }
        .group-form {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .group-form input {
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .selected-users {
            border: 1px solid #ddd;
            padding: 10px;
            border-radius: 4px;
            max-height: 150px;
            overflow-y: auto;
        }
        .user-search {
            position: relative;
        }
        #userSearchResults {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1;
        }
        .user-item {
            padding: 8px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
        }
        .user-item:hover {
            background-color: #f5f5f5;
        }
        .selected-user-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px;
            background-color: #e9ecef;
            border-radius: 4px;
            margin: 2px 0;
        }
        .remove-user {
            color: red;
            cursor: pointer;
        }
        .modal-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        .modal-buttons button {
            padding: 8px 16px;
            border-radius: 4px;
            border: none;
            cursor: pointer;
        }
        #createGroupBtn {
            background-color: #007bff;
            color: white;
        }
        #createGroupBtn:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
        #cancelGroupBtn {
            background-color: #6c757d;
            color: white;
        }
    `;
    document.head.appendChild(style);

    // Eventos del modal
    const modal = document.getElementById('groupModal');
    const groupNameInput = document.getElementById('groupName');
    const userSearchInput = document.getElementById('groupUserSearch');
    const createGroupBtn = document.getElementById('createGroupBtn');
    const cancelGroupBtn = document.getElementById('cancelGroupBtn');
    const selectedUsersList = document.getElementById('selectedUsersList');
    const userSearchResults = document.getElementById('userSearchResults');

    // Búsqueda de usuarios
    userSearchInput.addEventListener('input', debounce(async (e) => {
        const searchTerm = e.target.value.trim();
        if (searchTerm.length < 2) {
            userSearchResults.innerHTML = '';
            return;
        }

        try {
            const users = await searchUsersForGroup(searchTerm);
            displayUserSearchResults(users, userSearchResults);
        } catch (error) {
            console.error('Error al buscar usuarios:', error);
        }
    }, 300));

    // Actualizar botón de crear grupo
    function updateCreateButton() {
        createGroupBtn.disabled = selectedUsers.size < 2 || !groupNameInput.value.trim();
    }

    // Mostrar usuarios seleccionados
    function updateSelectedUsersList() {
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
                updateSelectedUsersList();
                updateCreateButton();
            });
        });

        updateCreateButton();
    }

    groupNameInput.addEventListener('input', updateCreateButton);

    // Crear grupo
    createGroupBtn.addEventListener('click', async () => {
        const groupName = groupNameInput.value.trim();
        if (!groupName || selectedUsers.size < 2) return;

        try {
            await createGroupChat(groupName, Array.from(selectedUsers));
            modal.remove();
        } catch (error) {
            console.error('Error al crear grupo:', error);
            showError('errorCreateGroup');
        }
    });

    // Cancelar
    cancelGroupBtn.addEventListener('click', () => {
        modal.remove();
    });
}

// Función para buscar usuarios para el grupo
async function searchUsersForGroup(searchTerm) {
    const db = window.db;
    const currentUser = auth.currentUser;
    
    try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        
        const users = [];
        snapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.uid !== currentUser.uid && 
                userData.email.toLowerCase().includes(searchTerm.toLowerCase()) &&
                !Array.from(selectedUsers).some(u => u.id === userData.uid)) {
                users.push({
                    id: userData.uid,
                    email: userData.email,
                    phoneNumber: userData.phoneNumber
                });
            }
        });
        
        return users;
    } catch (error) {
        console.error('Error al buscar usuarios:', error);
        throw error;
    }
}

// Función para mostrar resultados de búsqueda de usuarios
function displayUserSearchResults(users, container) {
    container.innerHTML = users.map(user => `
        <div class="user-item" data-userid="${user.id}" data-email="${user.email}">
            ${user.email}
        </div>
    `).join('');

    container.querySelectorAll('.user-item').forEach(item => {
        item.addEventListener('click', () => {
            const userId = item.dataset.userid;
            const userEmail = item.dataset.email;
            
            selectedUsers.add({
                id: userId,
                email: userEmail
            });
            
            updateSelectedUsersList();
            item.remove();
        });
    });
}

// Función para crear un chat grupal
async function createGroupChat(groupName, participants) {
    const db = window.db;
    const currentUser = auth.currentUser;
    
    try {
        // Añadir el usuario actual a los participantes
        const allParticipants = [
            currentUser.uid,
            ...participants.map(p => p.id)
        ];

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

        console.log('Grupo creado:', groupChatRef.id);
        openChat(groupChatRef.id);
    } catch (error) {
        console.error('Error al crear grupo:', error);
        throw error;
    }
}

// Modificar la función displaySearchResults para incluir la opción de grupo
function displaySearchResults(users) {
    chatList.innerHTML = '';
    
    // Añadir botón de crear grupo
    const createGroupButton = document.createElement('div');
    createGroupButton.className = 'chat-item create-group';
    createGroupButton.innerHTML = `
        <div class="group-button">
            <i class="fas fa-users"></i>
            <span data-translate="createNewGroup">${getTranslation('createNewGroup', userLanguage)}</span>
        </div>
    `;
    createGroupButton.addEventListener('click', () => {
        showGroupCreationModal();
    });
    chatList.appendChild(createGroupButton);

    if (users.length === 0) {
        chatList.innerHTML += `<div class="chat-item" data-translate="noUsersFound">${getTranslation('noUsersFound', userLanguage)}</div>`;
        return;
    }

    // Mostrar usuarios encontrados
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'chat-item';
        userElement.innerHTML = `
            <div class="user-info">
                <div class="user-name">${user.email}</div>
                <div class="user-phone">${user.phoneNumber || ''}</div>
            </div>
            <button class="start-chat-btn" data-userid="${user.id}" data-translate="startChat">
                ${getTranslation('startChat', userLanguage)}
            </button>
        `;
        
        const startChatBtn = userElement.querySelector('.start-chat-btn');
        startChatBtn.addEventListener('click', () => {
            console.log('Iniciando chat con usuario:', user.id);
            createChat(user.id);
        });
        
        chatList.appendChild(userElement);
    });
} 
