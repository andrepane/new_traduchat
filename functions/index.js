const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicializar admin con credenciales por defecto
admin.initializeApp();

exports.sendMessageNotification = functions.firestore
    .document('chats/{chatId}/messages/{messageId}')
    .onCreate(async (snap, context) => {
        try {
            console.log('🔔 Nueva notificación iniciada');
            const message = snap.data();
            const chatId = context.params.chatId;

            // Verificar que el mensaje tenga los datos necesarios
            if (!message || !message.senderId || !message.text) {
                console.error('❌ Mensaje inválido:', message);
                return null;
            }

            console.log('📝 Datos del mensaje:', {
                chatId,
                messageId: context.params.messageId,
                senderId: message.senderId,
                text: message.text
            });

            // Obtener información del chat
            const chatDoc = await admin.firestore().collection('chats').doc(chatId).get();
            if (!chatDoc.exists) {
                console.error('❌ Chat no encontrado:', chatId);
                return null;
            }

            const chatData = chatDoc.data();
            console.log('💬 Datos del chat:', chatData);

            // Obtener los participantes del chat
            const participants = chatData.participants || [];
            console.log('👥 Participantes del chat:', participants);
            
            // Excluir al remitente de las notificaciones
            const recipientIds = participants.filter(userId => userId !== message.senderId);
            console.log('📫 Destinatarios:', recipientIds);

            if (recipientIds.length === 0) {
                console.log('⚠️ No hay destinatarios para notificar');
                return null;
            }

            // Obtener los tokens FCM de los destinatarios
            const userDocs = await Promise.all(
                recipientIds.map(userId => 
                    admin.firestore().collection('users').doc(userId).get()
                )
            );

            const tokens = userDocs
                .map(doc => doc.exists ? doc.data()?.fcmToken : null)
                .filter(token => token);

            console.log('🔑 Tokens FCM encontrados:', tokens);

            if (tokens.length === 0) {
                console.log('⚠️ No se encontraron tokens FCM para enviar notificaciones');
                return null;
            }

            // Obtener el nombre del remitente
            const senderDoc = await admin.firestore().collection('users').doc(message.senderId).get();
            const senderData = senderDoc.data();
            const senderName = senderData?.username || senderData?.email?.split('@')[0] || 'Usuario';

            console.log('👤 Remitente:', senderName);

            // Enviar notificaciones una por una
            const results = await Promise.all(tokens.map(async (token) => {
                try {
                    const notificationMessage = {
                        token: token,
                        notification: {
                            title: `Nuevo mensaje de ${senderName}`,
                            body: message.text
                        },
                        data: {
                            chatId: chatId,
                            messageId: context.params.messageId,
                            type: 'new_message'
                        },
                        android: {
                            priority: 'high',
                            notification: {
                                clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                                priority: 'high',
                                sound: 'default'
                            }
                        },
                        webpush: {
                            headers: {
                                Urgency: 'high'
                            },
                            notification: {
                                icon: '/images/icon-192.png',
                                badge: '/images/icon-72.png',
                                vibrate: [200, 100, 200],
                                requireInteraction: true
                            },
                            fcmOptions: {
                                link: `/?chatId=${chatId}`
                            }
                        }
                    };

                    const result = await admin.messaging().send(notificationMessage);
                    console.log('✅ Notificación enviada exitosamente:', result);
                    return { success: true, messageId: result };
                } catch (error) {
                    console.error('❌ Error al enviar notificación:', {
                        token,
                        error: error.message,
                        errorCode: error.code
                    });
                    return { success: false, error };
                }
            }));

            const successCount = results.filter(r => r.success).length;
            const failureCount = results.length - successCount;

            console.log('📊 Resumen de envío:', {
                total: results.length,
                success: successCount,
                failure: failureCount
            });

            return { successCount, failureCount };

        } catch (error) {
            console.error('❌ Error general al enviar notificaciones:', error);
            return { error: error.message };
        }
    }); 
