import { create } from 'zustand';

type EmotionType = 'neutral' | 'joy' | 'angry' | 'sorrow' | 'fun';

interface AvatarState {
    emotion: EmotionType;
    lipSyncValue: number; // 0.0 ~ 1.0 (Audio volume drives this)
    setEmotion: (emotion: string) => void;
    setLipSyncValue: (val: number) => void;
}

export const useAvatarStore = create<AvatarState>((set) => ({
    emotion: 'neutral',
    lipSyncValue: 0,
    setEmotion: (emotion) => {
        // Validate emotion string to ensure it matches VRM types if needed
        const validEmotions: EmotionType[] = ['neutral', 'joy', 'angry', 'sorrow', 'fun'];
        const safeEmotion = validEmotions.includes(emotion as EmotionType)
            ? (emotion as EmotionType)
            : 'neutral';
        set({ emotion: safeEmotion });
    },
    setLipSyncValue: (val) => set({ lipSyncValue: val }),
}));
