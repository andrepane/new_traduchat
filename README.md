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
3. Configura las variables de entorno necesarias (incluye `FCM_SERVER_KEY` para
   las notificaciones FCM)
4. Ejecuta el servidor con `npm start`. Asegúrate de que las variables de
   entorno estén cargadas previamente.

## Configuración

1. Crea un proyecto en Firebase
2. Configura las credenciales en `firebase-config.js`
3. Habilita la autenticación por email en Firebase
4. Configura las variables de entorno necesarias. En el archivo `.env` deberás incluir
   todas las claves de Firebase y **FCM_SERVER_KEY** para poder enviar notificaciones
   push mediante FCM.

## Compatibilidad

Desde iOS 16.4, Safari y las PWA instaladas permiten recibir notificaciones push
mediante Service Workers. Asegúrate de que la aplicación esté instalada en la
pantalla de inicio para poder solicitar el permiso y recibirlas correctamente.

## Contribuir

Las contribuciones son bienvenidas. Por favor, abre un issue primero para discutir los cambios que te gustaría hacer. 
