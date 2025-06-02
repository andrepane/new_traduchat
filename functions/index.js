const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicializar Firebase Admin
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
            const senderName = senderData?.username || senderData?.email || 'Usuario';

            console.log('👤 Remitente:', senderName);

            // Construir la notificación
            const notification = {
                title: `Nuevo mensaje de ${senderName}`,
                body: message.text,
                icon: '/images/icon-192.png'
            };

            const payload = {
                notification,
                data: {
                    chatId,
                    messageId: context.params.messageId,
                    type: 'new_message',
                    click_action: 'FLUTTER_NOTIFICATION_CLICK'
                }
            };

            console.log('📬 Enviando notificación:', payload);

            // Enviar la notificación
            try {
                const response = await admin.messaging().sendMulticast({
                    tokens,
                    ...payload
                });

                console.log('✅ Resultado del envío:', {
                    success: response.successCount,
                    failure: response.failureCount,
                    responses: response.responses
                });

                // Manejar tokens inválidos
                const invalidTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        console.error('❌ Error al enviar a token:', {
                            token: tokens[idx],
                            error: resp.error
                        });
                        if (resp.error.code === 'messaging/invalid-registration-token' ||
                            resp.error.code === 'messaging/registration-token-not-registered') {
                            invalidTokens.push(tokens[idx]);
                        }
                    }
                });

                // Eliminar tokens inválidos
                if (invalidTokens.length > 0) {
                    console.log('🗑️ Eliminando tokens inválidos:', invalidTokens);
                    const batch = admin.firestore().batch();
                    
                    const tokenQuerySnapshots = await Promise.all(
                        invalidTokens.map(token =>
                            admin.firestore()
                                .collection('users')
                                .where('fcmToken', '==', token)
                                .get()
                        )
                    );

                    tokenQuerySnapshots.forEach(querySnapshot => {
                        querySnapshot.docs.forEach(doc => {
                            batch.update(doc.ref, {
                                fcmToken: admin.firestore.FieldValue.delete()
                            });
                        });
                    });

                    await batch.commit();
                    console.log('✅ Tokens inválidos eliminados');
                }

                return {
                    success: response.successCount,
                    failure: response.failureCount
                };

            } catch (sendError) {
                console.error('❌ Error al enviar notificación:', {
                    error: sendError.message,
                    code: sendError.code,
                    details: sendError.details
                });
                throw sendError;
            }

        } catch (error) {
            console.error('❌ Error general en la función:', {
                error: error.message,
                code: error.code,
                stack: error.stack
            });
            throw error;
        }
    }); 
