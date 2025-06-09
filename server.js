import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { GoogleAuth } from 'google-auth-library';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Servir archivos estáticos desde el directorio public
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint para enviar notificación push FCM
// Maneja tanto /api/send-notification como /send-notification en producción
app.post(['/api/send-notification', '/send-notification'], async (req, res) => {
    const { token, title, body, data: extraData } = req.body;

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const serverKey = process.env.FCM_SERVER_KEY?.trim();

    if (!(projectId && clientEmail && privateKey) && !serverKey) {
        return res.status(500).json({ error: 'FCM credentials not configured' });
    }

    try {
        let response;

        if (projectId && clientEmail && privateKey) {
            // Preferir la API HTTP v1 con la cuenta de servicio
            const auth = new GoogleAuth({
                credentials: {
                    project_id: projectId,
                    client_email: clientEmail,
                    private_key: privateKey
                },
                scopes: ['https://www.googleapis.com/auth/firebase.messaging']
            });

            const client = await auth.getClient();
            const { token: accessToken } = await client.getAccessToken();

            response = await fetch(
                `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: {
                            token,
                            data: {
                                title,
                                body,
                                ...extraData
                            },
                            webpush: {
                                fcmOptions: {
                                    link: extraData?.chatId ? `/?chatId=${extraData.chatId}` : '/'
                                }
                            }
                        }
                    })
                }
            );
        } else {
            // Uso de la API legacy con la clave del servidor
            response = await fetch('https://fcm.googleapis.com/fcm/send', {
                method: 'POST',
                headers: {
                    Authorization: `key=${serverKey}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify({
                    to: token,
                    data: {
                        title,
                        body,
                        ...extraData
                    }
                })
            });
        }

        const text = await response.text();
        let responseData;
        try {
            responseData = JSON.parse(text);
        } catch (err) {
            responseData = { raw: text };
        }

        if (!response.ok) {
            console.error('FCM request failed', response.status, responseData);
            return res.status(response.status).json(responseData);
        }

        res.json(responseData);
    } catch (err) {
        console.error('Error sending notification', err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoints simulados para el envío y verificación de códigos SMS
app.post('/api/send-code', (req, res) => {
    res.json({ success: true });
});

app.post('/api/verify-code', (req, res) => {
    res.json({ success: true });
});

// Servir index.html para todas las rutas
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Solo escuchar en el puerto si no estamos en Vercel
if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Servidor corriendo en http://localhost:${port}`);
    });
}

// Exportar la app para Vercel
export default app;
