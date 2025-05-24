const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Configuración de SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Almacén temporal de códigos (en producción usar una base de datos)
const verificationCodes = new Map();

// Generar código de verificación
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Ruta para enviar código por email
app.post('/api/send-code', async (req, res) => {
    try {
        const { email, phoneNumber } = req.body;
        const code = generateCode();
        
        // Guardar el código (en producción usar una base de datos)
        verificationCodes.set(email, {
            code,
            phoneNumber,
            timestamp: Date.now(),
            attempts: 0
        });

        // Enviar email usando SendGrid
        const msg = {
            to: email,
            from: process.env.SENDGRID_FROM_EMAIL, // email verificado en SendGrid
            subject: 'Código de verificación TraduChat',
            text: `Tu código de verificación para TraduChat es: ${code}`,
            html: `<h1>TraduChat</h1>
                   <p>Tu código de verificación es:</p>
                   <h2>${code}</h2>
                   <p>Este código expirará en 5 minutos.</p>`
        };

        await sgMail.send(msg);
        res.json({ success: true, message: 'Código enviado correctamente' });
    } catch (error) {
        console.error('Error al enviar email:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al enviar el código',
            error: error.message 
        });
    }
});

// Ruta para verificar código
app.post('/api/verify-code', (req, res) => {
    const { email, code } = req.body;
    const storedData = verificationCodes.get(email);

    if (!storedData) {
        return res.status(400).json({ 
            success: false, 
            message: 'No hay código pendiente para este email' 
        });
    }

    // Verificar si el código ha expirado (5 minutos)
    if (Date.now() - storedData.timestamp > 5 * 60 * 1000) {
        verificationCodes.delete(email);
        return res.status(400).json({ 
            success: false, 
            message: 'El código ha expirado' 
        });
    }

    // Verificar el código
    if (storedData.code === code) {
        const userData = {
            email,
            phoneNumber: storedData.phoneNumber,
            verified: true
        };
        verificationCodes.delete(email);
        res.json({ 
            success: true, 
            message: 'Código verificado correctamente',
            user: userData
        });
    } else {
        storedData.attempts++;
        if (storedData.attempts >= 3) {
            verificationCodes.delete(email);
            res.status(400).json({ 
                success: false, 
                message: 'Demasiados intentos fallidos' 
            });
        } else {
            res.status(400).json({ 
                success: false, 
                message: 'Código incorrecto' 
            });
        }
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
}); 