import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

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

    if (!process.env.FCM_SERVER_KEY) {
        return res.status(500).json({ error: 'FCM_SERVER_KEY not configured' });
    }

    try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                'Authorization': `key=${process.env.FCM_SERVER_KEY}`,
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
