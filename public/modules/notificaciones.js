import { messaging, db } from './firebase.js';
import { getCurrentUser } from './state.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';

function showForegroundToast(title, body) {
    const toast = document.getElementById('inAppToast');
    if (!toast) return;

    toast.textContent = `${title}: ${body}`;
    toast.classList.remove('hidden');
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hidden');
    }, 4000);
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
                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, {
                    fcmToken: token,
                    lastTokenUpdate: serverTimestamp(),
                    notificationsEnabled: true
                }, { merge: true });
                console.log('✅ Token guardado en Firestore');

                // Escuchar cambios de token para actualizarlo en Firestore
                if (messaging.onTokenRefresh) {
                    messaging.onTokenRefresh(async () => {
                        try {
                            const newToken = await getToken(messaging, {
                                vapidKey: 'BHOz-BX2_ZDpjjQEvZ03bfRVTWyMgBd6CcZ5HgpLAJnKre2UbZYd4vMmCTVVF1MY17nJJTEb7nPiAJ9M5xIXTeY',
                                serviceWorkerRegistration: registration
                            });
                            if (newToken) {
                                await setDoc(userRef, {
                                    fcmToken: newToken,
                                    lastTokenUpdate: serverTimestamp(),
                                    notificationsEnabled: true
                                }, { merge: true });
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

