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
        chats: 'Chats',
        codeValidFor: 'Código válido por: {0}',
        codeExpired: 'Código expirado',
        
        // Mensajes de error/éxito
        errorEmptyFields: 'Por favor, completa todos los campos',
        errorPassword: 'La contraseña debe tener al menos 6 caracteres',
        errorInvalidEmail: 'Email inválido',
        errorEmailInUse: 'Este email ya está registrado',
        errorUsernameInUse: 'Este nombre de usuario ya está en uso',
        errorUsernameChange: 'No se puede usar ese nombre de usuario',
        usernameUpdated: 'Nombre de usuario actualizado',
        errorNetwork: 'Error de conexión. Verifica tu conexión a internet',
        errorGeneric: 'Ha ocurrido un error',
        errorSendingCode: 'Error al enviar el código: {0}',
        errorVerifyingCode: 'Error al verificar el código: {0}',
        errorUsernameChars: 'El nombre de usuario solo puede contener letras, números, guiones y guiones bajos, y debe tener entre 3 y 20 caracteres',
        errorTooManyAttempts: 'Demasiados intentos. Intenta más tarde.',
        demoVerificationCode: 'Para fines de demostración, tu código es: {0}',
        translationLimitExceeded: 'Límite de traducciones excedido',
        errorVoiceRecognition: 'Error en el reconocimiento de voz',
        errorNoChat: 'Selecciona un chat antes de grabar',
        groupCreatedBy: 'Grupo "{0}" creado por {1}',
        
        // Interfaz principal
        newChat: '+',
        search: 'Buscar por nombre de usuario',
        selectChat: 'Selecciona un chat para comenzar',
        writeMessage: 'Escribe un mensaje...',
        send: 'Enviar',
        noChats: 'No hay chats disponibles',
        errorLoadingChats: 'Error al cargar los chats',
          selectTheme: "Seleccionar tema",
          themeBanderas: "Colores de bandera",
          themeElegante: "Pastel",
          themeCreativo: "Creativo",
        themeElegante2: "Elegante",
        
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
        addMembers: 'Agregar miembros',
        membersAdded: 'Miembros agregados exitosamente',
        errorAddMembers: 'Error al agregar miembros',
        addedMembers: 'ha agregado a los miembros',
        groupImage: 'Imagen del grupo',
        groupAvatarUpdated: 'Foto de grupo actualizada',
        groups: 'Grupos',
        
        // Ajustes
        settings: 'Ajustes',
        profile: 'Perfil',
        language: 'Idioma',
        theme: 'Tema',
        about: 'Acerca de',
        developer: 'Desarrollado por Andrea Panepinto',
        edit: 'Editar',
        save: 'Guardar',
        profileImage: 'Foto de perfil',
        avatarUpdated: 'Foto de perfil actualizada',
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
        chats: 'Chats',
        codeValidFor: 'Code valid for: {0}',
        codeExpired: 'Code expired',
        
        // Error/success messages
        errorEmptyFields: 'Please fill in all fields',
        errorPassword: 'Password must be at least 6 characters long',
        errorInvalidEmail: 'Invalid email',
        errorEmailInUse: 'This email is already registered',
        errorUsernameInUse: 'This username is already taken',
        errorUsernameChange: 'Cannot use that username',
        usernameUpdated: 'Username updated',
        errorNetwork: 'Connection error. Check your internet connection',
        errorGeneric: 'An error has occurred',
        errorSendingCode: 'Error sending code: {0}',
        errorVerifyingCode: 'Error verifying code: {0}',
        errorUsernameChars: 'Username can only contain letters, numbers, hyphens and underscores, and must be between 3 and 20 characters',
        errorTooManyAttempts: 'Too many attempts. Try again later.',
        demoVerificationCode: 'For demonstration purposes, your code is: {0}',
        translationLimitExceeded: 'Translation limit exceeded',
        errorVoiceRecognition: 'Voice recognition error',
        errorNoChat: 'Please select a chat first',
        groupCreatedBy: 'Group "{0}" created by {1}',
        
        // Main interface
        newChat: '+',
        search: 'Search by username',
        selectChat: 'Select a chat to start',
        writeMessage: 'Write a message...',
        send: 'Send',
        noChats: 'No chats available',
        errorLoadingChats: 'Error loading chats',
          selectTheme: "Select theme",
  themeBanderas: "Flag colors",
  themeElegante: "Pastel",
  themeCreativo: "Creative",
        themeElegante2: "Elegant",
        
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
        addMembers: 'Add members',
        membersAdded: 'Members added successfully',
        errorAddMembers: 'Error adding members',
        addedMembers: 'has added members',
        groupImage: 'Group image',
        groupAvatarUpdated: 'Group picture updated',
        groups: 'Groups',


        
        // Settings
        settings: 'Settings',
        profile: 'Profile',
        language: 'Language',
        theme: 'Theme',
        about: 'About',
        developer: 'Developed by Andrea Panepinto',
        edit: 'Edit',
        save: 'Save',
        profileImage: 'Profile picture',
        avatarUpdated: 'Profile picture updated',
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
        chats: 'Chat',
        codeValidFor: 'Codice valido per: {0}',
        codeExpired: 'Codice scaduto',
        
        // Messaggi di errore/successo
        errorEmptyFields: 'Per favore, compila tutti i campi',
        errorPassword: 'La password deve contenere almeno 6 caratteri',
        errorInvalidEmail: 'Email non valida',
        errorEmailInUse: 'Questa email è già registrata',
        errorUsernameInUse: 'Questo nome utente è già in uso',
        errorUsernameChange: 'Non puoi usare quel nome utente',
        usernameUpdated: 'Nome utente aggiornato',
        errorNetwork: 'Errore di connessione. Verifica la tua connessione internet',
        errorGeneric: 'Si è verificato un errore',
        errorSendingCode: 'Errore nell\'invio del codice: {0}',
        errorVerifyingCode: 'Errore nella verifica del codice: {0}',
        errorUsernameChars: 'Il nome utente può contenere solo lettere, numeri, trattini e underscore e deve essere tra 3 e 20 caratteri',
        errorTooManyAttempts: 'Troppi tentativi. Riprova più tardi.',
        demoVerificationCode: 'Per scopi dimostrativi, il tuo codice è: {0}',
        translationLimitExceeded: 'Limite di traduzione superato',
        errorVoiceRecognition: 'Errore nel riconoscimento vocale',
        errorNoChat: 'Seleziona una chat prima di registrare',
        groupCreatedBy: 'Gruppo "{0}" creato da {1}',
        
        // Interfaccia principale
        newChat: '+',
        search: 'Cerca o inizia nuova chat',
        selectChat: 'Seleziona una chat per iniziare',
        writeMessage: 'Scrivi un messaggio...',
        send: 'Invia',
        noChats: 'Nessuna chat disponibile',
        errorLoadingChats: 'Errore nel caricamento delle chat',
         selectTheme: "Seleziona tema",
  themeBanderas: "Colori della bandiera",
  themeElegante: "Pastello",
  themeCreativo: "Creativo",
        themeElegante2: "Elegante",
        
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
        addMembers: 'Aggiungi membri',
        membersAdded: 'Membri aggiunti con successo',
        errorAddMembers: 'Errore durante l\'aggiunta dei membri',
        addedMembers: 'ha aggiunto i membri',
        groupImage: 'Immagine del gruppo',
        groupAvatarUpdated: 'Foto del gruppo aggiornata',
        groups: 'Gruppi',
        
        // Impostazioni
        settings: 'Impostazioni',
        profile: 'Profilo',
        language: 'Lingua',
        theme: 'Tema',
        about: 'Informazioni',
        developer: 'Sviluppato da Andrea Panepinto',
        edit: 'Modifica',
        save: 'Salva',
        profileImage: 'Foto profilo',
        avatarUpdated: 'Foto profilo aggiornata',
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

function animateTitleWave({ colors = [] } = {}) {
    const h1 = document.getElementById("titulo-wave");
    if (h1) {
        const text = h1.textContent;
        h1.textContent = "";
        [...text].forEach((char, i) => {
            const span = document.createElement("span");
            span.textContent = char === ' ' ? '\u00A0' : char;
            span.style.setProperty('--i', i);
            if (colors[i]) {
                span.style.color = colors[i];
            }
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

export function getTypingMessage(username, lang) {
    if (translations[lang] && translations[lang].userIsTyping) {
        return translations[lang].userIsTyping.replace('{user}', username);
    }
    return `${username} ${getTypingText(lang)}`;
}

// Exportar todo junto al final
export { translations, getTranslation, translateInterface, animateTitleWave };
