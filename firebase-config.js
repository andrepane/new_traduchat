// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBPurWNRib5yjg-jEe3x2hBewL_Cvy132E",
    authDomain: "traduchat-2.firebaseapp.com",
    databaseURL: "https://traduchat-2-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "traduchat-2",
    storageBucket: "traduchat-2.firebasestorage.app",
    messagingSenderId: "304746474467",
    appId: "1:304746474467:web:a0496a8d1d891cec170ed6"
};

// Inicializar Firebase
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase inicializado correctamente');
        
        // Configurar Firestore para una sola pestaña
        firebase.firestore().settings({
            cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
        });
        
        // Habilitar persistencia offline solo si es necesario
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            firebase.firestore().enablePersistence({
                synchronizeTabs: true // Permitir sincronización entre pestañas
            }).catch((err) => {
                if (err.code == 'failed-precondition') {
                    console.warn('La persistencia requiere una sola pestaña abierta');
                } else if (err.code == 'unimplemented') {
                    console.warn('El navegador no soporta persistencia');
                }
            });
        }
    }
} catch (error) {
    console.error('Error al inicializar Firebase:', error);
} 