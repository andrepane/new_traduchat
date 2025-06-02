import { messaging, db } from './firebase.js';
import { getCurrentUser } from './state.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onMessage, getToken } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';

export async function initializeNotifications() {
    console.log('🔄 Iniciando configuración de notificaciones...');

    if (!messaging) {
        console.warn('⚠️ Firebase Messaging no está disponible');
        return;
    }

    try {
        console.log('🔐 Solicitando permiso de notificaciones...');
        const permission = await Notification.requestPermission();
        console.log('📱 Estado del permiso:', permission);

        if (permission !== 'granted') {
            console.warn('⛔ Permiso de notificaciones no concedido');
            return;
        }

        console.log('🔑 Obteniendo token FCM...');
        const token = await getToken(messaging, {
            vapidKey: 'BHOz-BX2_ZDpjjQEvZ03bfRVTWyMgBd6CcZ5HgpLAJnKre2UbZYd4vMmCTVVF1MY17nJJTEb7nPiAJ9M5xIXTeY'
        });

        console.log('✅ Token FCM obtenido:', token);

        const user = getCurrentUser();
        if (user && token) {
            console.log('💾 Guardando token en Firestore para usuario:', user.uid);
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, {
                fcmToken: token,
                lastTokenUpdate: serverTimestamp()
            }, { merge: true });
            console.log('✅ Token guardado en Firestore');
        }

        // Registrar el Service Worker si no está registrado
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                console.log('✅ Service Worker registrado:', registration);
            } catch (error) {
                console.error('❌ Error al registrar Service Worker:', error);
            }
        }

    } catch (error) {
        console.error('❌ Error al inicializar notificaciones:', error);
    }

    // Recibir mensajes mientras la app está en primer plano
    onMessage(messaging, (payload) => {
        console.log('🔔 Mensaje recibido en primer plano:', payload);
        
        // Mostrar notificación incluso en primer plano
        if (Notification.permission === 'granted') {
            const notificationTitle = payload.notification.title;
            const notificationOptions = {
                body: payload.notification.body,
                icon: '/images/icon-192.png',
                badge: '/images/icon-72.png',
                vibrate: [200, 100, 200],
                tag: 'new-message',
                data: payload.data
            };

            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(notificationTitle, notificationOptions);
            });
        }
    });
}
