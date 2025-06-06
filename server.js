import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
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

// Endpoint para enviar notificación push FCM
// Esta ruta se expone como /api/send-notification en Vercel
app.post('/api/send-notification', async (req, res) => {
    const { token, title, body } = req.body;

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
            }
        })
    });

    const result = await response.json();
    res.json(result);
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
