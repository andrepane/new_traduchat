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

import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

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

// Variables para grabación de audio
let recognition = null;
let isRecording = false;

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
                        // Para grupos, usar el nombre del grupo
                        chatName = chat.name;
                    } else {
                        // Para chats individuales, obtener el nombre del otro usuario
                        const otherUserId = chat.participants.find(id => id !== currentUser.uid);
                        if (otherUserId) {
                            const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
                            if (otherUserDoc.exists()) {
                                const otherUserData = otherUserDoc.data();
                                // Extraer el nombre del email (todo antes del @)
                                chatName = otherUserData.email.split('@')[0];
                            }
                        }
                    }

                    // Formatear la hora del último mensaje
                    const lastMessageTime = chat.lastMessageTime ? 
                        chat.lastMessageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                    chatElement.innerHTML = `
                        <div class="chat-info">
                            <div class="chat-name">${chatName}</div>
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
                        // Remover clase active de todos los chats
                        document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
                        // Añadir clase active al chat seleccionado
                        chatElement.classList.add('active');
                        openChat(chat.id);
                    });

                    chatList.appendChild(chatElement);
                } catch (error) {
                    console.error('Error al procesar chat individual:', error);
                }
            }
        }, (error) => {
            console.error('Error en escucha de chats:', error);
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

// Función unificada para mostrar resultados de búsqueda
function displaySearchResults(users) {
    chatList.innerHTML = '';
    
    // Añadir botón de crear grupo
    const createGroupButton = document.createElement('div');
    createGroupButton.className = 'chat-item create-group';
    createGroupButton.style.display = 'flex';
    createGroupButton.style.alignItems = 'center';
    createGroupButton.style.padding = '15px';
    createGroupButton.style.backgroundColor = '#f8f9fa';
    createGroupButton.style.cursor = 'pointer';
    createGroupButton.style.borderBottom = '1px solid #dee2e6';
    createGroupButton.innerHTML = `
        <div class="group-button" style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-users" style="font-size: 20px; color: #007bff;"></i>
            <span data-translate="createNewGroup" style="font-weight: 500;">${getTranslation('createNewGroup', userLanguage)}</span>
        </div>
    `;
    
    // Efecto hover para el botón de crear grupo
    createGroupButton.addEventListener('mouseover', () => {
        createGroupButton.style.backgroundColor = '#e9ecef';
    });
    createGroupButton.addEventListener('mouseout', () => {
        createGroupButton.style.backgroundColor = '#f8f9fa';
    });
    
    createGroupButton.addEventListener('click', () => {
        selectedUsers.clear(); // Limpiar usuarios seleccionados anteriormente
        showGroupCreationModal();
    });
    
    chatList.appendChild(createGroupButton);

    if (users.length === 0) {
        const noUsersMessage = document.createElement('div');
        noUsersMessage.className = 'chat-item';
        noUsersMessage.setAttribute('data-translate', 'noUsersFound');
        noUsersMessage.textContent = getTranslation('noUsersFound', userLanguage);
        noUsersMessage.style.padding = '15px';
        noUsersMessage.style.textAlign = 'center';
        noUsersMessage.style.color = '#6c757d';
        chatList.appendChild(noUsersMessage);
        return;
    }

    // Mostrar usuarios encontrados
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'chat-item';
        userElement.style.display = 'flex';
        userElement.style.justifyContent = 'space-between';
        userElement.style.alignItems = 'center';
        userElement.style.padding = '10px 15px';
        userElement.style.borderBottom = '1px solid #dee2e6';

        // Contenedor para la información del usuario
        const userInfoContainer = document.createElement('div');
        userInfoContainer.className = 'user-info';
        userInfoContainer.style.flex = '1';
        userInfoContainer.style.minWidth = '0';
        userInfoContainer.style.overflow = 'hidden';

        // Email del usuario
        const userEmail = document.createElement('div');
        userEmail.className = 'user-name';
        userEmail.textContent = user.email;
        userEmail.style.fontWeight = '500';
        userEmail.style.overflow = 'hidden';
        userEmail.style.textOverflow = 'ellipsis';
        userEmail.style.whiteSpace = 'nowrap';

        // Número de teléfono
        const userPhone = document.createElement('div');
        userPhone.className = 'user-phone';
        userPhone.textContent = user.phoneNumber || '';
        userPhone.style.fontSize = '0.875rem';
        userPhone.style.color = '#6c757d';
        userPhone.style.overflow = 'hidden';
        userPhone.style.textOverflow = 'ellipsis';
        userPhone.style.whiteSpace = 'nowrap';

        userInfoContainer.appendChild(userEmail);
        userInfoContainer.appendChild(userPhone);

        // Botón de iniciar chat
        const startChatBtn = document.createElement('button');
        startChatBtn.className = 'start-chat-btn';
        startChatBtn.setAttribute('data-userid', user.id);
        startChatBtn.setAttribute('data-translate', 'startChat');
        startChatBtn.textContent = getTranslation('startChat', userLanguage);
        startChatBtn.style.padding = '6px 12px';
        startChatBtn.style.fontSize = '0.875rem';
        startChatBtn.style.backgroundColor = '#007bff';
        startChatBtn.style.color = 'white';
        startChatBtn.style.border = 'none';
        startChatBtn.style.borderRadius = '4px';
        startChatBtn.style.cursor = 'pointer';
        startChatBtn.style.marginLeft = '10px';

        // Efectos del botón
        startChatBtn.addEventListener('mouseover', () => {
            startChatBtn.style.backgroundColor = '#0056b3';
        });
        startChatBtn.addEventListener('mouseout', () => {
            startChatBtn.style.backgroundColor = '#007bff';
        });

        startChatBtn.addEventListener('click', () => {
            console.log('Iniciando chat con usuario:', user.id);
            createChat(user.id);
        });

        userElement.appendChild(userInfoContainer);
        userElement.appendChild(startChatBtn);

        // Efecto hover para el elemento completo
        userElement.addEventListener('mouseover', () => {
            userElement.style.backgroundColor = '#f8f9fa';
        });
        userElement.addEventListener('mouseout', () => {
            userElement.style.backgroundColor = '';
        });

        chatList.appendChild(userElement);
    });

    // Ajustes específicos para móvil
    if (window.innerWidth <= 768) {
        const searchResults = document.querySelectorAll('.chat-item');
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

    // Obtener el tipo de chat actual
    const db = window.db;
    const chatDoc = await getDoc(doc(db, 'chats', currentChat));
    const chatData = chatDoc.exists() ? chatDoc.data() : null;
    const isGroupChat = chatData && chatData.type === 'group';
    
    // Si es un chat grupal, mostrar el email del remitente
    let senderEmail = '';
    if (isGroupChat && !isSentByMe) {
        try {
            const senderDoc = await getDoc(doc(db, 'users', messageData.senderId));
            if (senderDoc.exists()) {
                senderEmail = senderDoc.data().email;
            }
        } catch (error) {
            console.error('Error al obtener información del remitente:', error);
        }
    }

    if (messageData.type === 'audio') {
        messageElement.innerHTML = `
            ${isGroupChat && !isSentByMe ? `<span class="message-sender">${senderEmail}</span>` : ''}
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

        // Añadir evento para reproducir audio
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
            ${isGroupChat && !isSentByMe ? `<span class="message-sender">${senderEmail}</span>` : ''}
            <span class="message-flag">${flag}</span>
            <span class="message-text">${messageText}</span>
            <span class="message-time">${timeString}</span>
        `;
    }

    // Añadir estilos para el remitente si no existen
    if (!document.querySelector('#message-sender-styles')) {
        const style = document.createElement('style');
        style.id = 'message-sender-styles';
        style.textContent = `
            .message-sender {
                display: block;
                font-size: 0.8em;
                color: #666;
                margin-bottom: 2px;
                font-weight: bold;
            }
            .message.sent .message-sender {
                display: none;
            }
            .message.received {
                margin-top: 8px;
            }
            .message.received + .message.received {
                margin-top: 2px;
            }
            .message.received + .message.received .message-sender {
                display: none;
            }
        `;
        document.head.appendChild(style);
    }
    
    if (messagesList) {
        // Verificar si el mensaje anterior es del mismo remitente
        const previousMessage = messagesList.lastElementChild;
        if (previousMessage && 
            previousMessage.classList.contains('message') && 
            previousMessage.getAttribute('data-sender-id') === messageData.senderId) {
            messageElement.querySelector('.message-sender')?.remove();
        }

        // Guardar el ID del remitente para comparaciones futuras
        messageElement.setAttribute('data-sender-id', messageData.senderId);
        
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

        // Limpiar mensajes anteriores
        if (messagesList) {
            messagesList.innerHTML = '';
        }
        
        if (chatData.type === 'group') {
            // Es un chat grupal
            console.log('Abriendo chat grupal:', chatData.name);
            
            // Obtener información de todos los participantes
            const participantsInfo = await Promise.all(
                chatData.participants.map(async (userId) => {
                    const userDoc = await getDoc(doc(db, 'users', userId));
                    return userDoc.exists() ? userDoc.data() : { email: 'Usuario desconocido' };
                })
            );

            // Crear elemento para mostrar información del grupo
            const groupInfoElement = document.createElement('div');
            groupInfoElement.className = 'group-info';
            groupInfoElement.innerHTML = `
                <div class="group-name">${chatData.name}</div>
                <div class="group-participants">
                    ${participantsInfo.map(user => user.email).join(', ')}
                </div>
            `;

            // Actualizar la interfaz
            if (currentChatInfo) {
                currentChatInfo.innerHTML = '';
                currentChatInfo.appendChild(groupInfoElement);
            }

            // Añadir estilos para la información del grupo
            const style = document.createElement('style');
            style.textContent = `
                .group-info {
                    padding: 10px;
                    border-bottom: 1px solid #ddd;
                }
                .group-name {
                    font-weight: bold;
                    font-size: 1.1em;
                    margin-bottom: 5px;
                }
                .group-participants {
                    font-size: 0.9em;
                    color: #666;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            `;
            document.head.appendChild(style);
        } else {
            // Es un chat individual
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
                    
                    // Manejar mensajes de sistema de manera especial
                    if (messageData.type === 'system') {
                        displaySystemMessage(messageData);
                    } else {
                        displayMessage(messageData);
                    }
                }
            });
            
            // Scroll al último mensaje
            if (messagesList) {
                messagesList.scrollTop = messagesList.scrollHeight;
            }
        }, (error) => {
            console.error('Error en la suscripción a mensajes:', error);
        });
    } catch (error) {
        console.error('Error al abrir chat:', error);
        showError('errorOpenChat');
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

    // Añadir estilos para mensajes del sistema si no existen
    if (!document.querySelector('#system-message-styles')) {
        const style = document.createElement('style');
        style.id = 'system-message-styles';
        style.textContent = `
            .system-message {
                text-align: center;
                margin: 10px 0;
                padding: 5px 10px;
                background-color: #f8f9fa;
                border-radius: 15px;
                font-style: italic;
                color: #6c757d;
                font-size: 0.9em;
            }
            .system-message .message-time {
                font-size: 0.8em;
                margin-left: 5px;
                color: #adb5bd;
            }
        `;
        document.head.appendChild(style);
    }

    messagesList.appendChild(messageElement);
    messagesList.scrollTop = messagesList.scrollHeight;
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
        
        // Obtener información del chat
        const chatDoc = await getDoc(chatRef);
        const chatData = chatDoc.data();
        const isGroupChat = chatData.type === 'group';
        
        // Determinar los idiomas necesarios para traducción
        let targetLanguages = new Set();
        
        if (isGroupChat) {
            // Para grupos, obtener los idiomas únicos de todos los participantes
            const participantsData = await Promise.all(
                chatData.participants.map(uid => getDoc(doc(db, 'users', uid)))
            );
            
            participantsData.forEach(participantDoc => {
                if (participantDoc.exists()) {
                    const participantLang = participantDoc.data().language || 'en';
                    if (participantLang !== userLanguage) {
                        targetLanguages.add(participantLang);
                    }
                }
            });
        } else {
            // Para chats individuales, solo traducir al idioma del otro usuario
            const otherUserId = chatData.participants.find(uid => uid !== user.uid);
            if (otherUserId) {
                const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
                if (otherUserDoc.exists()) {
                    const otherUserLang = otherUserDoc.data().language || 'en';
                    if (otherUserLang !== userLanguage) {
                        targetLanguages.add(otherUserLang);
                    }
                }
            }
        }
        
        // Realizar las traducciones necesarias
        console.log('Traduciendo mensaje a idiomas:', Array.from(targetLanguages));
        for (const targetLang of targetLanguages) {
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

// Función para mostrar resultados de búsqueda de usuarios para el grupo
function displayUserSearchResults(users, container, selectedUsersList, createGroupBtn) {
    if (users.length === 0) {
        container.innerHTML = `<div class="user-item no-results">${getTranslation('noUsersFound', userLanguage)}</div>`;
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="user-item" data-userid="${user.id}" data-email="${user.email}">
            <i class="fas fa-user"></i>
            <span>${user.email}</span>
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

    const db = window.db;
    const currentUser = auth.currentUser;
    
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

// Función para inicializar el reconocimiento de voz
function initializeSpeechRecognition() {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = userLanguage === 'es' ? 'es-ES' : 
                      userLanguage === 'it' ? 'it-IT' : 'en-US';
    
    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript = transcript;
                // Cuando tenemos la transcripción final, la enviamos como mensaje
                if (finalTranscript.trim()) {
                    messageInput.value = finalTranscript;
                    sendMessage(finalTranscript);
                    stopRecording();
                }
            } else {
                interimTranscript += transcript;
                messageInput.value = interimTranscript;
            }
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Error en reconocimiento de voz:', event.error);
        stopRecording();
    };
    
    recognition.onend = () => {
        stopRecording();
    };
    
    return recognition;
}

// Función para detener la grabación
function stopRecording() {
    if (recognition) {
        recognition.stop();
    }
    isRecording = false;
    micButton.classList.remove('recording');
}

// Evento para el botón de micrófono
const micButton = document.getElementById('micButton');

micButton.addEventListener('click', () => {
    if (!currentChat) {
        showError('errorNoChat');
        return;
    }

    if (isRecording) {
        stopRecording();
    } else {
        // Iniciar grabación
        if (!recognition) {
            recognition = initializeSpeechRecognition();
        }
        
        recognition.start();
        micButton.classList.add('recording');
        isRecording = true;
        messageInput.value = '';
        messageInput.placeholder = getTranslation('listening', userLanguage);
    }
}); 
