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
        loadChats();
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
            
            // Verificar y crear/actualizar documento del usuario
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
                } else {
                    console.log('Documento de usuario existe:', userDoc.data());
                }
            } catch (error) {
                console.error('Error al verificar/crear documento de usuario:', error);
            }

            hideLoadingScreen();
            showMainScreen();
            updateUserInfo(user);
            loadChats();
        } else {
            console.log('No hay usuario autenticado');
            hideLoadingScreen();
            showAuthScreen();
        }
    });
});

// Funciones de UI mejoradas
function showLoadingScreen() {
    document.querySelector('.loading-screen').style.display = 'flex';
}

function hideLoadingScreen() {
    document.querySelector('.loading-screen').style.display = 'none';
}

function toggleChatList(show) {
    const sidebar = document.querySelector('.sidebar');
    const chatContainer = document.querySelector('.chat-container');
    
    if (show) {
        sidebar.classList.remove('hidden');
        chatContainer.classList.remove('active');
    } else {
        sidebar.classList.add('hidden');
        chatContainer.classList.add('active');
    }
}

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

// Función para cargar chats
async function loadChats() {
    console.log('Cargando chats...');
    const db = window.db;
    if (!db) {
        console.error('Firestore no está inicializado');
        chatList.innerHTML = `<div class="chat-item" data-translate="errorLoadingChats">${getTranslation('errorLoadingChats', userLanguage)}</div>`;
        return;
    }

    const auth = window.auth;
    if (!auth.currentUser) {
        console.error('No hay usuario autenticado');
        return;
    }

    try {
        // Por ahora solo mostraremos un mensaje
        chatList.innerHTML = `<div class="chat-item" data-translate="noChats">${getTranslation('noChats', userLanguage)}</div>`;
        
        // Aquí más adelante cargaremos los chats reales
        console.log('Sistema listo para chats');
    } catch (error) {
        console.error('Error al cargar chats:', error);
        chatList.innerHTML = `<div class="chat-item" data-translate="errorLoadingChats">${getTranslation('errorLoadingChats', userLanguage)}</div>`;
    }
}

// Función para buscar usuarios
async function searchUsers(searchTerm) {
    if (!searchTerm) {
        loadChats();
        return;
    }

    try {
        console.log('Iniciando búsqueda con término:', searchTerm);
        const db = window.db;
        const usersRef = collection(db, 'users');
        const currentUserUid = auth.currentUser.uid;
        console.log('Usuario actual:', currentUserUid);
        
        // Primero, verificar todos los documentos
        const allUsersQuery = query(usersRef);
        const snapshot = await getDocs(allUsersQuery);
        
        console.log('Documentos en la colección users:', snapshot.size);
        snapshot.forEach(doc => {
            console.log('Documento encontrado:', doc.id, doc.data());
        });

        // Ahora hacer la búsqueda específica
        const emailQuery = query(usersRef, 
            where('email', '>=', searchTerm.toLowerCase()),
            where('email', '<=', searchTerm.toLowerCase() + '\uf8ff')
        );

        const emailResults = await getDocs(emailQuery);
        console.log('Resultados de búsqueda:', emailResults.size);
        
        const users = new Set();

        emailResults.forEach(doc => {
            const userData = doc.data();
            console.log('Evaluando usuario:', userData);
            if (userData.uid !== currentUserUid && userData.email) {
                console.log('Usuario coincide con búsqueda:', userData);
                users.add({ id: userData.uid, ...userData });
            }
        });

        const resultsArray = Array.from(users);
        console.log('Resultados finales:', resultsArray);
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
        userElement.className = 'chat-item';
        userElement.innerHTML = `
            <div class="user-info">
                <div class="user-name">${user.email}</div>
                <div class="user-phone">${user.phoneNumber}</div>
            </div>
            <button class="start-chat-btn" data-translate="startChat">${getTranslation('startChat', userLanguage)}</button>
        `;
        
        const startChatBtn = userElement.querySelector('.start-chat-btn');
        startChatBtn.onclick = () => createChat(user.id);
        
        chatList.appendChild(userElement);
    });
}

// Función para crear un nuevo chat
async function createChat(otherUserId) {
    try {
        const db = window.db;
        const currentUser = auth.currentUser;

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
                existingChat = { id: doc.id, ...chatData };
            }
        });

        if (existingChat) {
            // Si el chat ya existe, abrirlo
            openChat(existingChat.id);
            return;
        }

        // Si no existe, crear nuevo chat
        const newChatRef = await addDoc(collection(db, 'chats'), {
            participants: [currentUser.uid, otherUserId],
            createdAt: serverTimestamp(),
            lastMessage: null,
            lastMessageTime: null
        });

        openChat(newChatRef.id);
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

// Función para abrir un chat
async function openChat(chatId) {
    // Cancelar la suscripción anterior si existe
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    currentChat = chatId;
    
    try {
        // Obtener información del chat
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        const chatData = chatDoc.data();
        
        // Obtener información del otro participante
        const otherUserId = chatData.participants.find(id => id !== auth.currentUser.uid);
        const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
        const otherUserData = otherUserDoc.data();

        // Actualizar la interfaz
        currentChatInfo.textContent = otherUserData.email;
        messagesList.innerHTML = '';

        // Suscribirse a nuevos mensajes
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));
        
        unsubscribeMessages = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    displayMessage(change.doc.data());
                }
            });
            
            // Scroll al último mensaje
            messagesList.scrollTop = messagesList.scrollHeight;
        });
    } catch (error) {
        console.error('Error al abrir chat:', error);
        showError('errorOpenChat');
    }
}

// Función para mostrar mensajes
async function displayMessage(messageData) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${messageData.senderId === currentUser.uid ? 'sent' : 'received'}`;
    
    // Traducir el mensaje si es necesario
    let messageText = messageData.text;
    if (messageData.language !== userLanguage) {
        messageText = await translateText(messageText, userLanguage);
        
        // Guardar traducción en Firestore
        const messageRef = doc(db, 'chats', currentChat, 'messages', messageData.id);
        await updateDoc(messageRef, {
            [`translations.${userLanguage}`]: messageText
        });
    }
    
    const flag = getFlagEmoji(messageData.language);
    messageElement.innerHTML = `
        <span class="message-flag">${flag}</span>
        <span class="message-text">${messageText}</span>
        <span class="message-time">${formatTime(messageData.timestamp)}</span>
    `;
    
    messagesList.appendChild(messageElement);
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Función para enviar mensaje
async function sendMessage(text) {
    if (!text.trim() || !currentChat) return;

    try {
        // Crear el mensaje
        const messageData = {
            text: text,
            senderId: auth.currentUser.uid,
            senderEmail: auth.currentUser.email,
            timestamp: serverTimestamp(),
            language: userLanguage,
            translations: {}
        };

        // Enviar el mensaje
        const docRef = await addDoc(collection(db, 'chats', currentChat, 'messages'), messageData);
        
        // Limpiar el input
        messageInput.value = '';
        
        // Traducir y guardar traducciones
        const otherLanguages = AVAILABLE_LANGUAGES.filter(lang => lang !== userLanguage);
        for (const targetLang of otherLanguages) {
            const translation = await translateText(text, targetLang);
            await updateDoc(docRef, {
                [`translations.${targetLang}`]: translation
            });
        }
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        alert(getTranslation('errorGeneric', userLanguage));
    }
}

// Evento de escritura
messageInput.addEventListener('input', debounce(() => {
    if (!currentChat || !currentUser) return;
    
    const typingRef = doc(db, 'chats', currentChat, 'typing', currentUser.uid);
    setDoc(typingRef, {
        isTyping: true,
        timestamp: serverTimestamp(),
        userEmail: currentUser.email
    });

    // Limpiar estado después de 3 segundos
    if (typingTimeouts[currentUser.uid]) {
        clearTimeout(typingTimeouts[currentUser.uid]);
    }
    
    typingTimeouts[currentUser.uid] = setTimeout(async () => {
        await setDoc(typingRef, {
            isTyping: false,
            timestamp: serverTimestamp(),
            userEmail: currentUser.email
        });
    }, 3000);
}, 300));

// Evento enviar mensaje
sendMessageBtn.addEventListener('click', () => {
    sendMessage(messageInput.value);
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
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
    toggleChatList(true);
}); 
