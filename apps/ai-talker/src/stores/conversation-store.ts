import { create } from 'zustand';

export type ConversationMode = 'free_talk' | 'role_play' | 'assessment';

export interface Message {
    id: string;
    role: 'user' | 'model' | 'system';
    text: string;
    timestamp: number;
    feedback?: {
        corrected: string;
        reason: string;
    };
}

interface ConversationState {
    messages: Message[];
    isRecording: boolean;
    isAiProcessing: boolean;
    isAiSpeaking: boolean;
    currentMode: ConversationMode;

    // Actions
    addMessage: (role: Message['role'], text: string) => string; // Returns ID
    updateMessageFeedback: (id: string, feedback: Message['feedback']) => void;
    setRecording: (status: boolean) => void;
    setAiProcessing: (status: boolean) => void;
    setAiSpeaking: (status: boolean) => void;
    setMode: (mode: ConversationMode) => void;
    clearConversation: () => void;
}

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const useConversationStore = create<ConversationState>((set) => ({
    messages: [],
    isRecording: false,
    isAiProcessing: false,
    isAiSpeaking: false,
    currentMode: 'free_talk',

    addMessage: (role, text) => {
        const id = generateId();
        set((state) => ({
            messages: [
                ...state.messages,
                {
                    id,
                    role,
                    text,
                    timestamp: Date.now()
                }
            ]
        }));
        return id;
    },

    updateMessageFeedback: (id, feedback) => set((state) => ({
        messages: state.messages.map(msg =>
            msg.id === id ? { ...msg, feedback } : msg
        )
    })),

    setRecording: (status) => set({ isRecording: status }),
    setAiProcessing: (status) => set({ isAiProcessing: status }),
    setAiSpeaking: (status) => set({ isAiSpeaking: status }),
    setMode: (mode) => set({ currentMode: mode }),
    clearConversation: () => set({ messages: [] }),
}));
