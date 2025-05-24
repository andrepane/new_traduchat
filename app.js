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
    const mainHeader = document.querySelector('.chat-header');
    
    if (window.innerWidth <= 768) {
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
        
        if (mainHeader) {
            mainHeader.style.position = 'sticky';
            mainHeader.style.top = '0';
            mainHeader.style.zIndex = '1001';
        }
        
        if (messagesList) {
            messagesList.style.flex = '1';
            messagesList.style.height = 'calc(100vh - 130px)';
            messagesList.style.overflowY = 'auto';
            messagesList.style.paddingBottom = '70px';
            messagesList.style.WebkitOverflowScrolling = 'touch';
        }
        
        if (inputContainer) {
            inputContainer.style.position = 'fixed';
            inputContainer.style.bottom = '0';
            inputContainer.style.left = '0';
            inputContainer.style.width = '100%';
            inputContainer.style.padding = '10px';
            inputContainer.style.backgroundColor = '#fff';
            inputContainer.style.borderTop = '1px solid #ddd';
            inputContainer.style.zIndex = '1002';
            inputContainer.style.boxSizing = 'border-box';
        }

        // Ajustar el input de mensaje y el botón de enviar
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendMessage');
        if (messageInput && sendButton) {
            messageInput.style.width = 'calc(100% - 60px)';
            messageInput.style.marginRight = '10px';
            sendButton.style.width = '50px';
        }
    } else {
        // Restablecer estilos para desktop
        [chatContainer, sidebar, messagesList, inputContainer, mainHeader].forEach(element => {
            if (element) {
                element.style = '';
            }
        });
    }
}

// Evento para ajustar el diseño cuando cambia el tamaño de la ventana
window.addEventListener('resize', adjustMobileLayout);

// Función para mostrar la pantalla principal
function showMainScreen() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('mainScreen').classList.add('active');
    toggleChatList(true);
    loadExistingChats(); // Cargar chats existentes al mostrar la pantalla principal
    adjustMobileLayout();
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

// Función para cargar y mostrar chats existentes
async function loadExistingChats() {
    console.log('Cargando chats existentes...');
    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.error('No hay usuario autenticado al cargar chats');
        return;
    }

    try {
        const db = window.db;
        const chatsRef = collection(db, 'chats');
        const q = query(
            chatsRef,
            where('participants', 'array-contains', currentUser.uid),
            orderBy('lastMessageTime', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const chatsData = [];

        for (const doc of querySnapshot.docs) {
            const chatData = doc.data();
            const otherUserId = chatData.participants.find(id => id !== currentUser.uid);
            
            if (otherUserId) {
                const otherUserDoc = await getDoc(document.db, 'users', otherUserId);
                if (otherUserDoc.exists()) {
                    const otherUserData = otherUserDoc.data();
                    chatsData.push({
                        id: doc.id,
                        otherUser: otherUserData,
                        lastMessage: chatData.lastMessage,
                        lastMessageTime: chatData.lastMessageTime
                    });
                }
            }
        }

        displayExistingChats(chatsData);
    } catch (error) {
        console.error('Error al cargar chats existentes:', error);
    }
}

// Función para mostrar chats existentes
function displayExistingChats(chatsData) {
    const chatList = document.getElementById('chatList');
    if (!chatList) return;

    chatList.innerHTML = '';

    if (chatsData.length === 0) {
        chatList.innerHTML = `<div class="chat-item" data-translate="noChats">${getTranslation('noChats', userLanguage)}</div>`;
        return;
    }

    chatsData.forEach(chat => {
        const chatElement = document.createElement('div');
        chatElement.className = 'chat-item';
        
        const timeString = chat.lastMessageTime ? 
            new Date(chat.lastMessageTime.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        chatElement.innerHTML = `
            <div class="chat-info">
                <div class="chat-name">${chat.otherUser.email}</div>
                <div class="last-message-container">
                    <div class="last-message">${chat.lastMessage || ''}</div>
                    <div class="last-message-time">${timeString}</div>
                </div>
            </div>
        `;

        chatElement.addEventListener('click', () => {
            openChat(chat.id);
        });

        chatList.appendChild(chatElement);
    });
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
        
        // Obtener información del otro participante
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

        // Mostrar la sección de chat
        const chatContainer = document.querySelector('.chat-container');
        const sidebar = document.querySelector('.sidebar');
        
        if (chatContainer) {
            chatContainer.classList.remove('hidden');
            if (window.innerWidth <= 768) {
                chatContainer.style.display = 'block';
                if (sidebar) {
                    sidebar.style.display = 'none';
                }
            }
        }

        adjustMobileLayout();

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

// Evento para el botón de volver en móvil
backButton.addEventListener('click', () => {
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        chatContainer.style.display = 'none';
    }
    toggleChatList(true);
    adjustMobileLayout();
});

// Modificar la función toggleChatList para incluir los ajustes móviles
function toggleChatList(show) {
    const sidebar = document.querySelector('.sidebar');
    const chatContainer = document.querySelector('.chat-container');
    
    if (show) {
        if (sidebar) {
            sidebar.classList.remove('hidden');
            if (window.innerWidth <= 768) {
                sidebar.style.display = 'block';
                if (chatContainer) {
                    chatContainer.style.display = 'none';
                }
            }
        }
    } else {
        if (sidebar) {
            sidebar.classList.add('hidden');
            if (window.innerWidth <= 768) {
                sidebar.style.display = 'none';
                if (chatContainer) {
                    chatContainer.style.display = 'block';
                }
            }
        }
    }
    
    adjustMobileLayout();
}

// Modificar la función setupRealtimeChats para mantener la lista actualizada
async function setupRealtimeChats() {
    console.log('Configurando escucha de chats en tiempo real');
    if (unsubscribeChats) {
        unsubscribeChats();
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.error('No hay usuario autenticado');
        return;
    }

    try {
        const chatsRef = collection(db, 'chats');
        const q = query(
            chatsRef,
            where('participants', 'array-contains', currentUser.uid),
            orderBy('lastMessageTime', 'desc')
        );

        unsubscribeChats = onSnapshot(q, async (snapshot) => {
            await loadExistingChats(); // Recargar la lista cuando hay cambios
        }, (error) => {
            console.error('Error en escucha de chats:', error);
        });
    } catch (error) {
        console.error('Error al configurar escucha de chats:', error);
    }
} 
