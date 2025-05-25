// Import the functions you need from the SDKs you need
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, RecaptchaVerifier } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBPurWNRib5yjg-jEe3x2hBewL_Cvy132E",
    authDomain: "traduchat-2.firebaseapp.com",
    projectId: "traduchat-2",
    storageBucket: "traduchat-2.appspot.com",
    messagingSenderId: "304746474467",
    appId: "1:304746474467:web:a0496a8d1d891cec170ed6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = getAuth(app);

// Función para inicializar reCAPTCHA
function initializeRecaptcha() {
    try {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'normal',
                'callback': (response) => {
                    console.log("reCAPTCHA verified");
                },
                'expired-callback': () => {
                    console.log("reCAPTCHA expired");
                }
            });
            
            // Renderizar explícitamente el reCAPTCHA
            window.recaptchaVerifier.render().then(function(widgetId) {
                window.recaptchaWidgetId = widgetId;
            });
        }
    } catch (error) {
        console.error("Error al inicializar reCAPTCHA:", error);
    }
}

export { auth, initializeRecaptcha }; 
