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
            const chatType = chatData.type || 'individual';

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
                        token,
                        data: {
                            title: senderName,
                            body: message.text,
                            chatId,
                            messageId: context.params.messageId,
                            type: 'new_message',
                            chatType
                        },
                        webpush: {
                            fcmOptions: {
                                link: chatType === 'group' ? '/?view=groups' : '/'
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

exports.sendGroupCreationNotification = functions.firestore
    .document('chats/{chatId}')
    .onCreate(async (snap, context) => {
        try {
            console.log('🆕 Creación de chat detectada:', context.params.chatId);
            const chatData = snap.data();

            if (!chatData || (chatData.type !== 'group' && (!Array.isArray(chatData.participants) || chatData.participants.length <= 2))) {
                return null;
            }

            const chatId = context.params.chatId;
            const { participants = [], createdBy, name } = chatData;

            const recipientIds = participants.filter(uid => uid !== createdBy);

            if (recipientIds.length === 0) {
                console.log('⚠️ No hay destinatarios para notificar creación de grupo');
                return null;
            }

            const userDocs = await Promise.all(
                recipientIds.map(uid =>
                    admin.firestore().collection('users').doc(uid).get()
                )
            );

            const tokens = userDocs
                .map(doc => doc.exists ? doc.data()?.fcmToken : null)
                .filter(token => token);

            if (tokens.length === 0) {
                console.log('⚠️ No se encontraron tokens FCM para la creación de grupo');
                return null;
            }

            const creatorDoc = await admin.firestore().collection('users').doc(createdBy).get();
            const creatorData = creatorDoc.data();
            const creatorName = creatorData?.username || creatorData?.email?.split('@')[0] || 'Usuario';

            const results = await Promise.all(tokens.map(async (token) => {
                try {
                    const notificationMessage = {
                        token,
                        data: {
                            title: name,
                            body: `${creatorName} ha creado este grupo`,
                            chatId,
                            type: 'group_created',
                            chatType: 'group'
                        },
                        webpush: {
                            fcmOptions: {
                                link: '/?view=groups'
                            }
                        }
                    };

                    const result = await admin.messaging().send(notificationMessage);
                    console.log('✅ Notificación de creación de grupo enviada:', result);
                    return { success: true, messageId: result };
                } catch (error) {
                    console.error('❌ Error al enviar notificación de creación de grupo:', error);
                    return { success: false, error };
                }
            }));

            const successCount = results.filter(r => r.success).length;
            const failureCount = results.length - successCount;

            console.log('📊 Resumen de notificación de grupo:', {
                total: results.length,
                success: successCount,
                failure: failureCount
            });

            return { successCount, failureCount };

        } catch (error) {
            console.error('❌ Error general en notificación de creación de grupo:', error);
            return { error: error.message };
        }
    });

exports.ensureGroupType = functions.firestore
    .document('chats/{chatId}')
    .onCreate(async (snap, context) => {
        const data = snap.data();
        if (data && Array.isArray(data.participants) && data.participants.length > 2 && data.type !== 'group') {
            console.log('🔧 Corrigiendo tipo de chat a group para', context.params.chatId);
            await snap.ref.update({ type: 'group' });
        }
        return null;
    });
