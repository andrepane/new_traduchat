// Cache de traducciones con tiempo de expiración (30 días)
const CACHE_EXPIRY_DAYS = 30;
const CACHE_MAX_SIZE = 1000; // Número máximo de traducciones en caché

// Cargar caché con información de tiempo
const translationCache = loadCache();

function loadCache() {
    const savedCache = localStorage.getItem("translationCache");
    if (!savedCache) return {};
    
    try {
        const cache = JSON.parse(savedCache);
        const now = new Date().getTime();
        
        // Limpiar entradas expiradas
        Object.keys(cache).forEach(key => {
            if (cache[key].timestamp && (now - cache[key].timestamp) > (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)) {
                delete cache[key];
            }
        });
        
        return cache;
    } catch (error) {
        console.error('Error al cargar caché:', error);
        return {};
    }
}

function saveCache() {
    try {
        const cacheEntries = Object.keys(translationCache);
        
        // Si excede el tamaño máximo, eliminar las entradas más antiguas
        if (cacheEntries.length > CACHE_MAX_SIZE) {
            const sortedEntries = cacheEntries
                .map(key => ({
                    key,
                    timestamp: translationCache[key].timestamp
                }))
                .sort((a, b) => a.timestamp - b.timestamp);
            
            // Eliminar el exceso de entradas más antiguas
            const entriesToRemove = sortedEntries.slice(0, cacheEntries.length - CACHE_MAX_SIZE);
            entriesToRemove.forEach(entry => {
                delete translationCache[entry.key];
            });
        }
        
        localStorage.setItem("translationCache", JSON.stringify(translationCache));
    } catch (error) {
        console.error('Error al guardar caché:', error);
    }
}

// Función para traducir texto
export async function translateText(text, targetLanguage, sourceLanguage = 'auto') {
    console.log(`🔄 Traduciendo texto de ${sourceLanguage} a ${targetLanguage}:`, text);

    const cacheKey = `${text}|${sourceLanguage}|${targetLanguage}`;
    const cached = translationCache[cacheKey];
    if (cached) {
        console.log('🗄️ Traducción obtenida del caché:', cached.translatedText);
        cached.timestamp = new Date().getTime();
        saveCache();
        return cached.translatedText;
    }

    try {
        const response = await fetch(`https://magicloops.dev/api/loop/1f32ffbd-1eb5-4e1c-ab57-f0a322e5a1c3/run?text=${encodeURIComponent(text)}&targetLanguage=${targetLanguage}&sourceLanguage=${sourceLanguage}`);

        if (!response.ok) {
            if (response.status === 429) {
                console.warn('⚠️ Límite de traducción excedido');
                return 'LIMIT_EXCEEDED';
            }
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Traducción completada:', data);
        const result = data.translatedText || text;

        translationCache[cacheKey] = {
            translatedText: result,
            timestamp: new Date().getTime()
        };
        saveCache();

        return result;
    } catch (error) {
        console.error('❌ Error en la traducción:', error);
        return text;
    }
}

// Función para obtener el emoji de la bandera según el idioma
export function getFlagEmoji(language) {
    const flags = {
        'es': '🇪🇸',
        'en': '🇬🇧',
        'it': '🇮🇹',
        'fr': '🇫🇷',
        'de': '🇩🇪',
        'pt': '🇵🇹'
    };
    return flags[language] || '🌐';
}

// Idiomas disponibles
export const AVAILABLE_LANGUAGES = ['es', 'en', 'it', 'fr', 'de', 'pt'];

// Función para limpiar manualmente el caché si es necesario
export function clearTranslationCache() {
    localStorage.removeItem("translationCache");
    Object.keys(translationCache).forEach(key => delete translationCache[key]);
}

// Función para obtener estadísticas del caché
export function getCacheStats() {
    const entries = Object.keys(translationCache).length;
    const size = new Blob([JSON.stringify(translationCache)]).size;
    let oldestEntry = null;
    let newestEntry = null;

    if (entries > 0) {
        const timestamps = Object.values(translationCache).map(v => v.timestamp);
        oldestEntry = Math.min(...timestamps);
        newestEntry = Math.max(...timestamps);
    }

    return {
        entries,
        sizeKB: (size / 1024).toFixed(2),
        oldestEntry,
        newestEntry
    };
}
