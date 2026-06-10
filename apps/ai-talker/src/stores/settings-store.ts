import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VOICE_PRESETS, ROLE_PRESETS } from '@/lib/constants';

export interface CustomAvatar {
    id: string;
    name: string;
    url: string;
}

interface SettingsState {
    voiceId: number;
    setVoiceId: (id: number) => void;
    roleId: string;
    setRoleId: (id: string) => void;
    avatarUrl: string;
    setAvatarUrl: (url: string) => void;

    // Custom Avatars
    customAvatars: CustomAvatar[];
    addCustomAvatar: (avatar: CustomAvatar) => void;
    removeCustomAvatar: (id: string) => void;

    getSystemPrompt: () => string;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            voiceId: 47, // Default: Nurse Robot
            setVoiceId: (id) => set({ voiceId: id }),
            roleId: "tutor", // Default Role
            setRoleId: (id) => set({ roleId: id }),
            avatarUrl: "/models/avatar.vrm", // Default Avatar
            setAvatarUrl: (url) => set({ avatarUrl: url }),

            customAvatars: [],
            addCustomAvatar: (avatar) => set((state) => ({
                customAvatars: [...state.customAvatars, avatar]
            })),
            removeCustomAvatar: (id) => set((state) => ({
                customAvatars: state.customAvatars.filter(a => a.id !== id),
                // If the current avatar is removed, fallback to default
                avatarUrl: state.avatarUrl === state.customAvatars.find(a => a.id === id)?.url
                    ? "/models/avatar.vrm"
                    : state.avatarUrl
            })),

            getSystemPrompt: () => {
                const role = ROLE_PRESETS.find((r) => r.id === get().roleId);
                return role ? role.prompt : ROLE_PRESETS[0].prompt;
            },
        }),
        {
            name: "ai-talker-settings",
            // customAvatars is automatically persisted
        }
    )
);
