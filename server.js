import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
// import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { GoogleAuth } from 'google-auth-library';

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
// Esta ruta se expone como /api/send-notification en Vercel
app.post('/api/send-notification', async (req, res) => {
    const { token, title, body, data: extraData } = req.body;

    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FCM_PROJECT_ID;
    const serverKey = process.env.FCM_SERVER_KEY;

    if (!serviceAccount && !serverKey) {
        return res.status(500).json({ error: 'FCM credentials not configured' });
    }

    try {
        let response;

        if (serviceAccount && projectId) {
            // Preferir la API HTTP v1 si se proporciona una cuenta de servicio
            const credentials = JSON.parse(serviceAccount);
            const auth = new GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/firebase.messaging']
            });
            const client = await auth.getClient();
            const accessToken = await client.getAccessToken();

            response = await fetch(
                `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken.token || accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: {
                            token,
                            notification: {
                                title,
                                body,
                                icon: '/images/icon-192.png'
                            },
                            data: extraData
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
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: token,
                    notification: {
                        title,
                        body,
                        icon: '/images/icon-192.png'
                    },
                    data: extraData
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
