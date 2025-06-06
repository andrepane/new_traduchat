# TraduChat-WA

Una aplicación de chat con traducción automática integrada. Los usuarios pueden comunicarse en diferentes idiomas, y los mensajes se traducen automáticamente al idioma preferido de cada usuario.

## Características

- Autenticación de usuarios mediante email y teléfono
- Chat en tiempo real
- Traducción automática de mensajes
- Sistema de caché para reutilizar traducciones y reducir llamadas a la API
- Interfaz multilingüe (Español, Inglés, Italiano)
- Diseño responsive inspirado en WhatsApp

### Sistema de caché

Las traducciones exitosas se almacenan en `localStorage` por 30 días. Antes de
realizar una petición de traducción se consulta esta caché para evitar llamadas
innecesarias a la API y así ahorrar tiempo y créditos.

## Tecnologías utilizadas

- HTML5, CSS3, JavaScript
- Firebase (Autenticación y Base de datos)
- API de traducción
- Node.js y Express (Backend)

## Instalación

1. Clona este repositorio
2. Instala las dependencias con `npm install`
3. Configura las variables de entorno necesarias. Para las notificaciones puedes
   usar la clave del servidor `FCM_SERVER_KEY` (API legacy) o, de preferencia,
   definir `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y
   `FIREBASE_PRIVATE_KEY` para emplear la API HTTP v1 de FCM.
4. Ejecuta el servidor con `npm start`. Asegúrate de que las variables de
   entorno estén cargadas previamente.

   Si al desplegar en Vercel obtienes un error con una página HTML en la
   respuesta de FCM, revisa que las variables de notificación estén correctamente
   definidas. Si usas la clave de servidor, comprueba `FCM_SERVER_KEY`. Si optas
   por la API HTTP v1, asegúrate de incluir `FIREBASE_PROJECT_ID`,
   `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`.

## Configuración

1. Crea un proyecto en Firebase
2. Configura las credenciales en `firebase-config.js`
3. Habilita la autenticación por email en Firebase
4. Configura las variables de entorno necesarias. En el archivo `.env` deberás incluir
   las claves de Firebase y los valores para enviar notificaciones. Puedes optar por
   la clave de servidor (**FCM_SERVER_KEY**) o definir **FIREBASE_PROJECT_ID**,
   **FIREBASE_CLIENT_EMAIL** y **FIREBASE_PRIVATE_KEY** para utilizar la API HTTP v1.

## Compatibilidad

Desde iOS 16.4, Safari y las PWA instaladas permiten recibir notificaciones push
mediante Service Workers. Asegúrate de que la aplicación esté instalada en la
pantalla de inicio para poder solicitar el permiso y recibirlas correctamente.

## Contribuir

Las contribuciones son bienvenidas. Por favor, abre un issue primero para discutir los cambios que te gustaría hacer.

### Cambios recientes

- Se eliminó la duplicación de notificaciones push y se mejoró el manejo del estado de escritura para evitar parpadeos en la lista de chats.
- Se ajustó el *service worker* para mostrar correctamente las notificaciones cuando la aplicación está en segundo plano.
