const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.sendMessageNotification = functions.firestore
    .document('chats/{chatId}/messages/{messageId}')
    .onCreate(async (snap, context) => {
        try {
            console.log('🔔 Nueva notificación iniciada');
            const message = snap.data();
            const chatId = context.params.chatId;

            console.log('📝 Datos del mensaje:', {
                chatId,
                messageId: context.params.messageId,
                senderId: message.senderId,
                text: message.text
            });

            // Obtener información del chat
            const chatDoc = await admin.firestore().collection('chats').doc(chatId).get();
            const chatData = chatDoc.data();

            // Obtener los participantes del chat
            const participants = chatData.participants || [];
            console.log('👥 Participantes del chat:', participants);
            
            // Excluir al remitente de las notificaciones
            const recipientIds = participants.filter(userId => userId !== message.senderId);
            console.log('📫 Destinatarios:', recipientIds);

            // Obtener los tokens FCM de los destinatarios
            const userDocs = await Promise.all(
                recipientIds.map(userId => 
                    admin.firestore().collection('users').doc(userId).get()
                )
            );

            const tokens = userDocs
                .map(doc => doc.data()?.fcmToken)
                .filter(token => token);

            console.log('🔑 Tokens FCM encontrados:', tokens.length);

            if (tokens.length === 0) {
                console.log('⚠️ No se encontraron tokens FCM para enviar notificaciones');
                return;
            }

            // Obtener el nombre del remitente
            const senderDoc = await admin.firestore().collection('users').doc(message.senderId).get();
            const senderData = senderDoc.data();
            const senderName = senderData?.username || senderData?.email || 'Usuario';

            console.log('👤 Remitente:', senderName);

            // Construir la notificación
            const notification = {
                title: `Nuevo mensaje de ${senderName}`,
                body: message.text || 'Nuevo mensaje',
                icon: '/images/icon-192.png'
            };

            console.log('📬 Enviando notificación:', notification);

            // Enviar la notificación
            try {
                const response = await admin.messaging().sendMulticast({
                    tokens,
                    notification,
                    data: {
                        chatId,
                        messageId: context.params.messageId,
                        type: 'new_message'
                    }
                });

                console.log('✅ Resultado del envío:', {
                    success: response.successCount,
                    failure: response.failureCount,
                    responses: response.responses
                });

                // Si hay tokens inválidos, los eliminamos
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
                    for (const token of invalidTokens) {
                        const userQuery = await admin.firestore()
                            .collection('users')
                            .where('fcmToken', '==', token)
                            .get();
                        
                        userQuery.docs.forEach(doc => {
                            batch.update(doc.ref, {
                                fcmToken: admin.firestore.FieldValue.delete()
                            });
                        });
                    }
                    await batch.commit();
                }

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
