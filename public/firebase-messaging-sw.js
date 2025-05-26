// Import and configure the Firebase SDK
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyBPurWNRib5yjg-jEe3x2hBewL_Cvy132E",
    authDomain: "traduchat-2.firebaseapp.com",
    projectId: "traduchat-2",
    storageBucket: "traduchat-2.appspot.com",
    messagingSenderId: "304746474467",
    appId: "1:304746474467:web:a0496a8d1d891cec170ed6"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('Recibido mensaje en background:', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/images/icon-192x192.png',
        badge: '/images/icon-72x72.png',
        vibrate: [200, 100, 200],
        tag: 'new-message'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
}); 
