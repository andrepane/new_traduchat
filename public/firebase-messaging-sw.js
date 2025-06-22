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

console.log('🔧 Service Worker inicializándose...');

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();
console.log('✅ Firebase Messaging inicializado en Service Worker');

const shownMessages = new Set();

async function showNotification(payload) {
  const notificationTitle = payload.data?.title ||
    payload.notification?.title ||
    'TraduChat';
  const notificationOptions = {
    body: payload.data?.body || payload.notification?.body || '',
    icon: '/images/icon-192.png',
    badge: '/images/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: payload.data?.messageId || 'new-message',
    data: payload.data || {},
  };

  const msgId = notificationOptions.tag;

  // Evitar duplicados solo si FCM ya incluyó la notificación
  if (payload.notification) {
    if (shownMessages.has(msgId)) {
      return;
    }
    shownMessages.add(msgId);
  }

  const existing = await self.registration.getNotifications({ tag: msgId });
  if (existing.length === 0) {
    await self.registration.showNotification(
      notificationTitle,
      notificationOptions
    );
  }
}

// Manejar mensajes en segundo plano
messaging.onBackgroundMessage(async (payload) => {
  console.log('📬 Recibido mensaje en background:', payload);
  await showNotification(payload);
});


// Manejar clic en la notificación
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Clic en notificación:', event);

  event.notification.close();

  const data = event.notification.data || {};
  let urlPath = '/';
    if (data.chatType === 'group') {
    urlPath = '/?view=groups';
  }

  const urlToOpen = new URL(urlPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Si ya hay una ventana abierta, enfócala
        for (let client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no hay ventana abierta, abre una nueva
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

