// modules/state.js
export const state = {
    currentUser: null,
    currentChat: null,
    verificationCode: null,
    timerInterval: null,
    unsubscribeMessages: null,
    unsubscribeChats: null,
    typingTimeouts: {},
    lastSender: null,
    selectedUsers: new Set(),
    isGroupCreationMode: false,
    recognition: null,
    isRecording: false,
    MESSAGES_PER_BATCH: 20,
    isLoadingMore: false,
    allMessagesLoaded: false,
    lastVisibleMessage: null,
    userLanguage: localStorage.getItem('userLanguage') || 'es'
  };
  
