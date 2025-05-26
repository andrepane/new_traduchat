const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendMessageNotification = functions.firestore
    .document('chats/{chatId}/messages/{messageId}')
    .onCreate(async (snap, context) => {
        try {
            const message = snap.data();
            const chatId = context.params.chatId;

            // Obtener información del chat
            const chatDoc = await admin.firestore().collection('chats').doc(chatId).get();
            const chatData = chatDoc.data();

            // Obtener los participantes del chat
            const participants = chatData.participants || [];
            
            // Excluir al remitente de las notificaciones
            const recipientIds = participants.filter(userId => userId !== message.senderId);

            // Obtener los tokens FCM de los destinatarios
            const userDocs = await Promise.all(
                recipientIds.map(userId => 
                    admin.firestore().collection('users').doc(userId).get()
                )
            );

            const tokens = userDocs
                .map(doc => doc.data()?.fcmToken)
                .filter(token => token);

            if (tokens.length === 0) return;

            // Obtener el nombre del remitente
            const senderDoc = await admin.firestore().collection('users').doc(message.senderId).get();
            const senderData = senderDoc.data();
            const senderName = senderData?.username || senderData?.email || 'Usuario';

            // Construir la notificación
            const notification = {
                title: `Nuevo mensaje de ${senderName}`,
                body: message.text || 'Nuevo mensaje',
                icon: '/images/icon-192x192.png'
            };

            // Enviar la notificación
            await admin.messaging().sendMulticast({
                tokens,
                notification,
                data: {
                    chatId,
                    messageId: context.params.messageId,
                    type: 'new_message'
                }
            });

        } catch (error) {
            console.error('Error al enviar notificación:', error);
        }
    }); 
