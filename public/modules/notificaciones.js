import { messaging, db } from './firebase.js';
import { getCurrentUser } from './state.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onMessage, getToken } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';

export async function initializeNotifications() {
    if (!messaging) {
        console.warn('Firebase Messaging no está disponible');
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('Permiso de notificaciones no concedido');
            return;
        }

        const token = await getToken(messaging, {
            vapidKey: 'BHOz-BX2_ZDpjjQEvZ03bfRVTWyMgBd6CcZ5HgpLAJnKre2UbZYd4vMmCTVVF1MY17nJJTEb7nPiAJ9M5xIXTeY' // Sustituye por tu clave pública
        });

        console.log('Token FCM obtenido:', token);

        const user = getCurrentUser();
        if (user && token) {
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, {
                fcmToken: token,
                lastTokenUpdate: serverTimestamp()
            }, { merge: true });
        }
    } catch (error) {
        console.error('Error al inicializar notificaciones:', error);
    }

    // Recibir mensajes mientras la app está en primer plano
    onMessage(messaging, (payload) => {
        console.log('🔔 Mensaje recibido en primer plano:', payload);
        // Aquí puedes mostrar una notificación personalizada si quieres
    });
}
