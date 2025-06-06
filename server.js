import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Servir archivos estáticos desde el directorio public
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar firebase-admin usando las variables de entorno
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            })
        });
    } catch (err) {
        console.error('Error al inicializar Firebase Admin:', err);
    }
}

// Endpoint para enviar notificación push FCM
// Esta ruta se expone como /api/send-notification en Vercel
app.post('/api/send-notification', async (req, res) => {
    const { token, title, body } = req.body;

    if (!token || !title || !body) {
        return res.status(400).json({ error: 'token, title y body son requeridos' });
    }

    try {
        const message = {
            token,
            notification: { title, body },
            webpush: {
                notification: {
                    icon: '/images/icon-192.png'
                }
            }
        };

        const result = await admin.messaging().send(message);
        res.json({ messageId: result });
    } catch (error) {
        console.error('Error al enviar notificación:', error);
        res.status(500).json({ error: error.message });
    }
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
