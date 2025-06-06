import { messaging, db } from './firebase.js';
import { getCurrentUser } from './state.js';
import {
    doc,
    setDoc,
    serverTimestamp,
    getDoc,
    getDocs,
    query,
    where,
    collection,
    limit,
    updateDoc,
    deleteField
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getToken, onMessage, deleteToken } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';

function showForegroundToast(title, body) {
    if (typeof window.showToast === 'function') {
        window.showToast(`${title}: ${body}`);
        return;
    }
}

export async function guardarTokenUnico(userId, token) {
    try {
        if (!userId || !token) return;

        // Verificar si el token ya existe en otra cuenta
        const dupQuery = query(
            collection(db, 'users'),
            where('fcmToken', '==', token),
            limit(1)
        );

        const dupSnap = await getDocs(dupQuery);
        if (!dupSnap.empty && dupSnap.docs[0].id !== userId) {
            console.log('⛔ Token ya registrado en otra cuenta. No se guarda.');
            return;
        }

        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        const currentToken = userSnap.exists() ? userSnap.data().fcmToken : null;

        if (currentToken === token) {
            console.log('🔁 El usuario ya tiene este token registrado.');
            return;
        }

        await setDoc(
            userRef,
            {
                fcmToken: token,
                lastTokenUpdate: serverTimestamp(),
                notificationsEnabled: true
            },
            { merge: true }
        );

        console.log(currentToken ? '🔄 Token FCM actualizado' : '✅ Token FCM guardado');
    } catch (err) {
        console.error('❌ Error al guardar token único:', err);
        throw err;
    }
}

export async function eliminarTokenUsuario(userId) {
    try {
        if (!userId) return;

        try {
            await deleteToken(messaging);
            console.log('🗑️ Token FCM local eliminado');
        } catch (err) {
            console.warn('⚠️ No se pudo eliminar el token local:', err);
        }

        await updateDoc(doc(db, 'users', userId), {
            fcmToken: deleteField(),
            notificationsEnabled: false,
            lastTokenUpdate: serverTimestamp()
        });

        console.log('🗑️ Token FCM eliminado en Firestore');
    } catch (err) {
        console.error('❌ Error al eliminar token FCM:', err);
    }
}

export async function initializeNotifications() {
    console.log('🔄 Iniciando configuración de notificaciones...');

    if (!messaging) {
        console.warn('⚠️ Firebase Messaging no está disponible');
        return;
    }

    try {
        let registration;
        // Registrar el Service Worker primero
        if ('serviceWorker' in navigator) {
            try {
                registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                    scope: '/'
                });
                console.log('✅ Service Worker registrado:', registration);

                // Esperar a que el Service Worker esté activo
                await navigator.serviceWorker.ready;
                console.log('🚀 Service Worker está activo');
            } catch (error) {
                console.error('❌ Error al registrar Service Worker:', error);
                return;
            }
        }

        console.log('🔐 Solicitando permiso de notificaciones...');
        const permission = await Notification.requestPermission();
        console.log('📱 Estado del permiso:', permission);

        if (permission !== 'granted') {
            console.warn('⛔ Permiso de notificaciones no concedido');
            return;
        }

        console.log('🔑 Obteniendo token FCM...');
        const token = await getToken(messaging, {
            vapidKey: 'BHOz-BX2_ZDpjjQEvZ03bfRVTWyMgBd6CcZ5HgpLAJnKre2UbZYd4vMmCTVVF1MY17nJJTEb7nPiAJ9M5xIXTeY',
            serviceWorkerRegistration: registration
        });

        if (!token) {
            console.error('❌ No se pudo obtener el token FCM');
            return;
        }

        console.log('✅ Token FCM obtenido:', token);

        const user = getCurrentUser();
        if (user && token) {
            try {
                console.log('💾 Guardando token en Firestore para usuario:', user.uid);
                await guardarTokenUnico(user.uid, token);
                console.log('✅ Token guardado o verificado');

                // Escuchar cambios de token para actualizarlo en Firestore
                if (messaging.onTokenRefresh) {
                    messaging.onTokenRefresh(async () => {
                        try {
                            const newToken = await getToken(messaging, {
                                vapidKey: 'BHOz-BX2_ZDpjjQEvZ03bfRVTWyMgBd6CcZ5HgpLAJnKre2UbZYd4vMmCTVVF1MY17nJJTEb7nPiAJ9M5xIXTeY',
                                serviceWorkerRegistration: registration
                            });
                            if (newToken) {
                                await guardarTokenUnico(user.uid, newToken);
                                console.log('🔄 Token FCM actualizado en Firestore');
                            }
                        } catch (refreshError) {
                            console.error('❌ Error al refrescar token:', refreshError);
                        }
                    });
                }

                // Configurar listener para mensajes en primer plano
                onMessage(messaging, (payload) => {
                    console.log('🔔 Mensaje recibido en primer plano:', payload);
                    
                    if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
                        navigator.serviceWorker.ready.then(registration => {
                            const notificationTitle = payload.notification.title;
                            const notificationOptions = {
                                body: payload.notification.body,
                                icon: '/images/icon-192.png',
                                badge: '/images/icon-72x72.png',
                                vibrate: [200, 100, 200],
                                tag: 'new-message',
                                data: payload.data,
                                requireInteraction: true
                            };

                            registration.showNotification(notificationTitle, notificationOptions);
                            showForegroundToast(notificationTitle, payload.notification.body);
                        });
                    }
                });

            } catch (error) {
                console.error('❌ Error al guardar token en Firestore:', error);
                throw error;
            }
        }

    } catch (error) {
        console.error('❌ Error al inicializar notificaciones:', error);
        throw error;
    }
}

