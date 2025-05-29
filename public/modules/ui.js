import { translateInterface } from './translations.js';
import { getUserLanguage } from './state.js';

export function updateUITranslations() {
    const lang = getUserLanguage();
    console.log("🌐 updateUITranslations ejecutado con idioma:", lang);
    translateInterface(lang);
}
