import { getUserLanguage } from './modules/state.js';


const translations = {
    es: {
        // Autenticación
        appTitle: 'TraduChat',
        email: 'Correo electrónico',
        username: 'Nombre de usuario',
        password: 'Contraseña',
        loginRegister: 'Registrar/Iniciar Sesión',
        selectLanguage: 'Seleccionar idioma',
        loading: 'Cargando...',
        logout: 'Cerrar Sesión',
        logoutConfirm: '¿Estás seguro de que quieres cerrar sesión?',
        logoutSuccess: 'Has cerrado sesión correctamente',
        noPhone: 'Sin teléfono',
        listening: 'Escuchando...',
        
        // Mensajes de error/éxito
        errorEmptyFields: 'Por favor, completa todos los campos',
        errorPassword: 'La contraseña debe tener al menos 6 caracteres',
        errorInvalidEmail: 'Email inválido',
        errorEmailInUse: 'Este email ya está registrado',
        errorUsernameInUse: 'Este nombre de usuario ya está en uso',
        errorNetwork: 'Error de conexión. Verifica tu conexión a internet',
        errorGeneric: 'Ha ocurrido un error',
        
        // Interfaz principal
        newChat: '+',
        search: 'Buscar por nombre de usuario',
        selectChat: 'Selecciona un chat para comenzar',
        writeMessage: 'Escribe un mensaje...',
        send: 'Enviar',
        noChats: 'No hay chats disponibles',
        errorLoadingChats: 'Error al cargar los chats',
        
        // Idiomas
        languageEs: 'Español',
        languageEn: 'Inglés',
        languageIt: 'Italiano',
        changeLanguage: 'Cambiar idioma',
        
        // Búsqueda y chats
        searchInstruction: 'Escribe un nombre de usuario para buscar',
        searchPlaceholder: 'Buscar por nombre de usuario...',
        noUsersFound: 'No se encontraron usuarios',
        startChat: 'Iniciar chat',
        errorSearch: 'Error al buscar usuarios',
        errorCreateChat: 'Error al crear el chat',
        errorOpenChat: 'Error al abrir el chat',
        newChatCreated: 'Nuevo chat creado',
        chatExists: 'Ya tienes un chat con este usuario',
        typing: 'está escribiendo',
        deleteChat: 'Borrar chat',
        deleteChatConfirm: '¿Estás seguro de que quieres borrar este chat?',
        chatDeleted: 'Chat eliminado correctamente',
        
        // Notificaciones
        newMessageFrom: 'Nuevo mensaje de {user}',
        newChatStarted: '{user} ha iniciado un nuevo chat contigo',
        userIsTyping: '{user} está escribiendo...',
        userIsOnline: '{user} está en línea',
        userIsOffline: '{user} se ha desconectado',
        newNotification: 'Nueva notificación',
        notificationPermission: 'Permitir notificaciones',
        notificationsEnabled: 'Notificaciones activadas',
        notificationsDisabled: 'Notificaciones desactivadas',
        
        // Grupos
        createNewGroup: 'Crear nuevo grupo',
        createGroup: 'Crear grupo',
        groupNamePlaceholder: 'Nombre del grupo',
        selectedUsers: 'Usuarios seleccionados',
        searchUsers: 'Buscar usuarios',
        cancel: 'Cancelar',
        errorCreateGroup: 'Error al crear el grupo',
        errorMinUsers: 'Se necesitan al menos 2 participantes para crear un grupo',
        groupCreated: 'Grupo creado exitosamente',
        minUsersCount: '({0}/2 mínimo)',
        youMessage: 'Tú',
    },
    en: {
        // Authentication
        appTitle: 'TraduChat',
        email: 'Email',
        username: 'Username',
        password: 'Password',
        loginRegister: 'Login/Register',
        selectLanguage: 'Select language',
        loading: 'Loading...',
        logout: 'Logout',
        logoutConfirm: 'Are you sure you want to logout?',
        logoutSuccess: 'You have successfully logged out',
        listening: 'Listening...',
        
        // Error/success messages
        errorEmptyFields: 'Please fill in all fields',
        errorPassword: 'Password must be at least 6 characters long',
        errorInvalidEmail: 'Invalid email',
        errorEmailInUse: 'This email is already registered',
        errorUsernameInUse: 'This username is already taken',
        errorNetwork: 'Connection error. Check your internet connection',
        errorGeneric: 'An error has occurred',
        
        // Main interface
        newChat: '+',
        search: 'Search by username',
        selectChat: 'Select a chat to start',
        writeMessage: 'Write a message...',
        send: 'Send',
        noChats: 'No chats available',
        errorLoadingChats: 'Error loading chats',
        
        // Languages
        languageEs: 'Spanish',
        languageEn: 'English',
        languageIt: 'Italian',
        changeLanguage: 'Change language',
        
        // Search and chats
        searchInstruction: 'Type a username to search',
        searchPlaceholder: 'Search by username...',
        noUsersFound: 'No users found',
        startChat: 'Start chat',
        errorSearch: 'Error searching users',
        errorCreateChat: 'Error creating chat',
        errorOpenChat: 'Error opening chat',
        newChatCreated: 'New chat created',
        chatExists: 'You already have a chat with this user',
        typing: 'is typing',
        deleteChat: 'Delete chat',
        deleteChatConfirm: 'Are you sure you want to delete this chat?',
        chatDeleted: 'Chat successfully deleted',
        
        // Notifications
        newMessageFrom: 'New message from {user}',
        newChatStarted: '{user} has started a new chat with you',
        userIsTyping: '{user} is typing...',
        userIsOnline: '{user} is online',
        userIsOffline: '{user} has gone offline',
        newNotification: 'New notification',
        notificationPermission: 'Allow notifications',
        notificationsEnabled: 'Notifications enabled',
        notificationsDisabled: 'Notifications disabled',
        
        // Groups
        createNewGroup: 'Create new group',
        createGroup: 'Create group',
        groupNamePlaceholder: 'Group name',
        selectedUsers: 'Selected users',
        searchUsers: 'Search users',
        cancel: 'Cancel',
        errorCreateGroup: 'Error creating group',
        errorMinUsers: 'At least 2 participants are needed to create a group',
        groupCreated: 'Group successfully created',
        minUsersCount: '({0}/2 minimum)',
        youMessage: 'You',
    },
    it: {
        // Autenticazione
        appTitle: 'TraduChat',
        email: 'Email',
        username: 'Nome utente',
        password: 'Password',
        phoneNumber: 'Numero di telefono',
        loginRegister: 'Registrati/Accedi',
        selectLanguage: 'Seleziona lingua',
        loading: 'Caricamento...',
        logout: 'Disconnetti',
        logoutConfirm: 'Sei sicuro di voler disconnetterti?',
        logoutSuccess: 'Disconnessione effettuata con successo',
        listening: 'In ascolto...',
        
        // Messaggi di errore/successo
        errorEmptyFields: 'Per favore, compila tutti i campi',
        errorPassword: 'La password deve contenere almeno 6 caratteri',
        errorInvalidEmail: 'Email non valida',
        errorEmailInUse: 'Questa email è già registrata',
        errorNetwork: 'Errore di connessione. Verifica la tua connessione internet',
        errorGeneric: 'Si è verificato un errore',
        
        // Interfaccia principale
        newChat: '+',
        search: 'Cerca o inizia nuova chat',
        selectChat: 'Seleziona una chat per iniziare',
        writeMessage: 'Scrivi un messaggio...',
        send: 'Invia',
        noChats: 'Nessuna chat disponibile',
        errorLoadingChats: 'Errore nel caricamento delle chat',
        
        // Lingue
        languageEs: 'Spagnolo',
        languageEn: 'Inglese',
        languageIt: 'Italiano',
        changeLanguage: 'Cambia lingua',
        
        // Ricerca e chat
        searchInstruction: 'Scrivi un\'email o un numero di telefono per cercare gli utenti',
        searchPlaceholder: 'Cerca per email o telefono...',
        noUsersFound: 'Nessun utente trovato',
        startChat: 'Inizia chat',
        errorSearch: 'Errore nella ricerca degli utenti',
        errorCreateChat: 'Errore nella creazione della chat',
        errorOpenChat: 'Errore nell\'apertura della chat',
        newChatCreated: 'Nuova chat creata',
        chatExists: 'Hai già una chat con questo utente',
        typing: 'sta scrivendo',
        deleteChat: 'Elimina chat',
        deleteChatConfirm: 'Sei sicuro di voler eliminare questa chat?',
        chatDeleted: 'Chat eliminata con successo',
        
        // Notifiche
        newMessageFrom: 'Nuovo messaggio da {user}',
        newChatStarted: '{user} ha iniziato una nuova chat con te',
        userIsTyping: '{user} sta scrivendo...',
        userIsOnline: '{user} è online',
        userIsOffline: '{user} è offline',
        newNotification: 'Nuova notifica',
        notificationPermission: 'Abilita notifiche',
        notificationsEnabled: 'Notifiche abilitate',
        notificationsDisabled: 'Notifiche disabilitate',
        
        // Gruppi
        createNewGroup: 'Crea nuovo gruppo',
        createGroup: 'Crea gruppo',
        groupNamePlaceholder: 'Nome del gruppo',
        selectedUsers: 'Utenti selezionati',
        searchUsers: 'Cerca utenti',
        cancel: 'Annulla',
        errorCreateGroup: 'Errore durante la creazione del gruppo',
        errorMinUsers: 'Sono necessari almeno 2 partecipanti per creare un gruppo',
        groupCreated: 'Gruppo creato con successo',
        minUsersCount: '({0}/2 minimo)',
        youMessage: 'Tu',
    }
};

// Función para obtener una traducción
function getTranslation(key, lang = getUserLanguage()) {
    if (!translations[lang] || !translations[lang][key]) {
        console.warn(`Falta traducción para "${key}" en idioma "${lang}"`);
        return translations.es[key] || key;
    }
    
    // Si la traducción contiene placeholders {0}, {1}, etc., reemplazarlos con los argumentos adicionales
    let translation = translations[lang][key];
    const args = Array.prototype.slice.call(arguments, 2);
    args.forEach((arg, i) => {
        translation = translation.replace(`{${i}}`, arg);
    });
    
    return translation;
}

// Función para traducir la interfaz
function translateInterface(language) {
    console.log('🌐 translateInterface llamada con idioma:', language);
    
    // Obtener todos los elementos con atributo data-translate
    const elements = document.querySelectorAll('[data-translate]');
    console.log(`🔍 Encontrados ${elements.length} elementos para traducir`);
    
    elements.forEach(element => {
        const key = element.getAttribute('data-translate');
        const translation = getTranslation(key, language);
        console.log(`📝 Traduciendo elemento [${key}] de:`, element.textContent, 'a:', translation);
        
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.getAttribute('placeholder')) {
                element.placeholder = translation;
            }
        } else {
    if (element.id === 'titulo-wave') {
        element.textContent = translation;
        animateTitleWave(); // Aplicar efecto tras traducción
    } else {
        element.textContent = translation;
    }
}

    });

    // Traducir elementos OPTION
    const options = document.querySelectorAll('option[data-translate]');
    console.log(`🔍 Encontrados ${options.length} elementos OPTION para traducir`);
    
    options.forEach(option => {
        const key = option.getAttribute('data-translate');
        const translation = getTranslation(key, language);
        console.log(`📝 Traduciendo OPTION [${key}] de:`, option.textContent, 'a:', translation);
        option.textContent = translation;
    });

    console.log('✅ Traducción de interfaz completada');
}

function animateTitleWave() {
    const h1 = document.getElementById("titulo-wave");
    if (h1) {
        const text = h1.textContent;
        h1.textContent = "";
        [...text].forEach((char) => {
            const span = document.createElement("span");
            span.textContent = char === ' ' ? '\u00A0' : char;
            h1.appendChild(span);
        });
    }
}

export function getTypingText(lang) {
    // Verificar que el idioma y la traducción existan
    if (translations[lang] && translations[lang].typing) {
        return translations[lang].typing;
    }
    
    // Mapeo de fallback para cada idioma
    const fallbackMessages = {
        'es': 'está escribiendo...',
        'en': 'is typing...',
        'it': 'sta scrivendo...'
    };
    
    // Usar el fallback específico del idioma o el fallback por defecto
    return fallbackMessages[lang] || 'is typing...';
}

// Exportar todo junto al final
export { translations, getTranslation, translateInterface, animateTitleWave };
