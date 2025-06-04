// modules/chat.js
import {
    collection, query, orderBy, limit, startAfter, onSnapshot,
    addDoc, updateDoc, getDocs, getDoc, doc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { translateText, getFlagEmoji } from '../translation-service.js';
import { getTranslation } from '../translations.js';
import { db } from './firebase.js';
import { getCurrentUser, getUserLanguage } from './state.js';
import { toggleChatList } from './ui.js';

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

        // Cambiar a la vista del chat
        toggleChatList(false);

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

    unsubscribeTypingStatus = onSnapshot(doc(db, 'chats', chatId), (chatDoc) => {
        if (!chatDoc.exists()) return;

        const data = chatDoc.data();
        const typingStatus = data.typingStatus;
        console.log('📝 Estado de escritura recibido:', typingStatus);

        const currentLang = document.getElementById('languageSelect')?.value || 
                           document.getElementById('languageSelectMain')?.value || 
                           getUserLanguage();

        console.log('🌐 Idioma actual para indicador de escritura:', currentLang);

        if (typingStatus && typingStatus.userId && typingStatus.userId !== currentUser.uid) {
            const username = typingStatus.username || typingStatus.userId;
            const typingMessage = getTypingMessage(username, currentLang);
            console.log('💬 Usuario escribiendo:', username);
            showTypingIndicator(typingMessage);
        } else {
            console.log('💬 Nadie está escribiendo');
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
                await displayMessage(messageData);
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
    groupInfoElement.onclick = () => alert(participantNames.join(', '));

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

let typingTimeout = null;
let unsubscribeTypingStatus = null;

async function setTypingStatus(isTyping) {
    if (!currentChat || !currentUser) return;

    console.log(`🔄 setTypingStatus llamado con: ${isTyping}`);

    const chatRef = doc(db, 'chats', currentChat);

    try {
        const typingData = isTyping ? {
            userId: currentUser.uid,
            timestamp: serverTimestamp(),
            username: currentUser.email.split('@')[0] // o el nombre de usuario si lo tienes
        } : null;

        await updateDoc(chatRef, {
            typingStatus: typingData
        });
        console.log('✅ Estado de escritura actualizado:', typingData);
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



export {
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
    getChatReadTimes,
    displayMessage,
    displaySystemMessage
};
