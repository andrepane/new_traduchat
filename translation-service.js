// Cache de traducciones
const translationCache = JSON.parse(localStorage.getItem("translationCache") || "{}");

function saveCache() {
    localStorage.setItem("translationCache", JSON.stringify(translationCache));
}

export async function translateText(text, targetLang) {
    if (!text || !targetLang) return "[Sin traducción]";
    const cacheKey = `${text}__${targetLang}`;
    
    // Verificar caché
    if (translationCache[cacheKey]) {
        return translationCache[cacheKey];
    }

    // 1. Intentar con MagicLoops
    try {
        const encoded = encodeURIComponent(text);
        const url = `https://magicloops.dev/api/loop/1f32ffbd-1eb5-4e1c-ab57-f0a322e5a1c3/run?text=${encoded}&targetLanguage=${targetLang}`;
        const res = await fetch(url);
        
        if (res.ok) {
            const data = await res.json();
            if (data.translatedText) {
                translationCache[cacheKey] = data.translatedText;
                saveCache();
                return data.translatedText;
            }
        }
        throw new Error("MagicLoops no devolvió traducción");
    } catch (err) {
        console.warn("Error con MagicLoops, intentando LibreTranslate:", err);
        
        // 2. Fallback: LibreTranslate
        try {
            const res2 = await fetch("https://libretranslate.de/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    q: text,
                    source: "auto",
                    target: targetLang,
                    format: "text"
                })
            });
            
            const data2 = await res2.json();
            if (data2.translatedText) {
                translationCache[cacheKey] = data2.translatedText;
                saveCache();
                return data2.translatedText;
            }
            throw new Error("LibreTranslate no devolvió traducción");
        } catch (err2) {
            console.error("Error de traducción en ambos servicios:", err, err2);
            return "[Error de traducción]";
        }
    }
}

export function getFlagEmoji(lang) {
    const flags = {
        es: "🇪🇸",
        en: "🇬🇧",
        it: "🇮🇹"
    };
    return flags[lang] || "🏳️";
}

export const AVAILABLE_LANGUAGES = ["es", "it", "en"]; 