// modules/ui.js
import { getTranslation } from '../translations.js';
import { getUserLanguage } from './state.js';

function showError(errorKey) {
    const lang = getUserLanguage();
    alert(getTranslation(errorKey, lang));
}

function updateTheme(lang) {
    document.body.classList.remove('theme-es', 'theme-en', 'theme-it');
    document.body.classList.add(`theme-${lang}`);
}

function showLoadingScreen() {
    document.querySelector('.loading-screen').style.display = 'flex';
}

function hideLoadingScreen() {
    document.querySelector('.loading-screen').style.display = 'none';
}

function adjustMobileLayout() {
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
        viewportMeta = document.createElement('meta');
        viewportMeta.name = 'viewport';
        document.head.appendChild(viewportMeta);
    }
    viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

    if (window.innerWidth <= 768) {
        const messagesList = document.querySelector('.messages-list');
        if (messagesList) {
            setTimeout(() => {
                messagesList.scrollTop = messagesList.scrollHeight;
            }, 100);
        }
    }
}

window.addEventListener('resize', () => {
    if (window.innerWidth <= 768) {
        const messagesList = document.querySelector('.messages-list');
        if (messagesList) {
            setTimeout(() => {
                messagesList.scrollTop = messagesList.scrollHeight;
            }, 100);
        }
    }
});

document.addEventListener('gesturestart', function(e) {
    e.preventDefault();
});

function updateThemeAndLanguage(theme, lang) {
    document.body.classList.forEach(cls => {
        if (cls.startsWith('theme-set-') || cls.startsWith('theme-')) {
            document.body.classList.remove(cls);
        }
    });
    document.body.classList.add(`theme-set-${theme}`);
    document.body.classList.add(`theme-${lang}`);
    localStorage.setItem('selectedTheme', theme);
    const themeSelect = document.getElementById('themeSelect');
    const themeSelectMain = document.getElementById('themeSelectMain');
    if (themeSelect) themeSelect.value = theme;
    if (themeSelectMain) themeSelectMain.value = theme;
    const languageSelect = document.getElementById('languageSelect');
    const languageSelectMain = document.getElementById('languageSelectMain');
    if (languageSelect) languageSelect.value = lang;
    if (languageSelectMain) languageSelectMain.value = lang;
}

function showAuthScreen() {
    document.getElementById('mainScreen').classList.remove('active');
    document.getElementById('authScreen').classList.add('active');
    document.body.classList.remove('in-chat');
}

function showMainScreen() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('mainScreen').classList.add('active');
    toggleChatList(true);

    const themeSelectMain = document.getElementById('themeSelectMain');
    if (themeSelectMain) {
        const savedTheme = localStorage.getItem('selectedTheme') || 'banderas';
        const currentLang = getUserLanguage();
        updateThemeAndLanguage(savedTheme, currentLang);
        themeSelectMain.addEventListener('change', () => {
            const selectedTheme = themeSelectMain.value;
            const lang = document.getElementById('languageSelectMain').value || 'es';
            localStorage.setItem('selectedTheme', selectedTheme);
            updateThemeAndLanguage(selectedTheme, lang);
        });
    }
}

function toggleChatList(show) {
    const sidebar = document.querySelector('.sidebar');
    const chatContainer = document.querySelector('.chat-container');
    const backButton = document.getElementById('backToChats');
    const addBtn = document.getElementById('addMembersBtn');

    if (show) {
        if (sidebar) {
            sidebar.classList.remove('hidden');
            sidebar.style.display = 'block';
        }
        if (chatContainer) {
            chatContainer.classList.add('hidden');
            chatContainer.style.display = 'none';
        }
        if (addBtn) {
            addBtn.classList.add('hidden');
        }
    } else {
        if (sidebar) {
            sidebar.classList.add('hidden');
            sidebar.style.display = 'none';
        }
        if (chatContainer) {
            chatContainer.classList.remove('hidden');
            chatContainer.style.display = 'block';
        }
    }

    if (backButton) {
        backButton.style.display = window.innerWidth <= 768 && !show ? 'block' : 'none';
    }

    if (addBtn && show) {
        addBtn.classList.add('hidden');
    }

    adjustMobileLayout();
}

window.addEventListener('resize', () => {
    const backButton = document.getElementById('backToChats');
    if (backButton) {
        if (window.innerWidth <= 768 && document.querySelector('.chat-container')?.style.display !== 'none') {
            backButton.style.display = 'block';
        } else {
            backButton.style.display = 'none';
        }
    }
});

export {
    showError,
    updateTheme,
    showLoadingScreen,
    hideLoadingScreen,
    adjustMobileLayout,
    updateThemeAndLanguage,
    showAuthScreen,
    showMainScreen,
    toggleChatList
};
