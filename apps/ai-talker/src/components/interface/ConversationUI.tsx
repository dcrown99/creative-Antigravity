"use client";

import { useEffect, useState } from "react";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { globalAudioManager } from "@/lib/audio/audio-manager";
import { chatWithGemini, analyzeGrammar } from "@/lib/ai/gemini-client";
import { useAvatarStore } from "@/stores/avatar-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useConversationStore } from "@/stores/conversation-store";
import { Mic, MicOff, Settings2, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { HoloButton, StatusIndicator } from "./ui-elements";
import { CyberChatLog } from "./CyberChatLog";
import { SettingsDialog } from "./SettingsDialog";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore, KeyboardManager } from "./KeyboardManager";

export function ConversationUI() {
    // Hooks & Stores
    const { isListening, transcript, startListening, stopListening, hasRecognitionSupport, volume, error: micError, interimTranscript } = useSpeechRecognition();
    const setEmotion = useAvatarStore(s => s.setEmotion);
    const { voiceId, getSystemPrompt } = useSettingsStore();
    const {
        messages, addMessage, updateMessageFeedback,
        isAiProcessing, setAiProcessing,
        isAiSpeaking, setAiSpeaking,
        setRecording
    } = useConversationStore();

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isBooted, setIsBooted] = useState(false); // 起動状態管理
    const isUIVisible = useUIStore(s => s.isVisible); // UI表示状態

    // 疑似的な起動シーケンス
    useEffect(() => {
        const timer = setTimeout(() => setIsBooted(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        setRecording(isListening);
    }, [isListening, setRecording]);

    const handleMicClick = () => {
        if (isListening) {
            stopListening();
            if (transcript.trim()) handleTurn(transcript);
        } else {
            globalAudioManager.unlock();
            startListening();
        }
    };

    const handleTurn = async (userText: string) => {
        if (!userText.trim()) return;

        const userMsgId = addMessage('user', userText);
        setAiProcessing(true);

        // Async Grammar Analysis (Now acts as Conversation Support)
        analyzeGrammar(userText).then((feedback) => {
            if (feedback && feedback.reason && feedback.reason.length > 0) {
                console.log("AI Thought:", feedback.reason);
            }
        });

        const historyForAi = messages.slice(-10).map(m => ({
            role: m.role as "user" | "model",
            parts: m.text
        }));

        try {
            const res = await chatWithGemini(userText, historyForAi, getSystemPrompt());

            setAiProcessing(false);
            setEmotion(res.emotion);
            addMessage('model', res.text);
            await speakText(res.text);
        } catch (e) {
            console.error(e);
            setAiProcessing(false);
            addMessage('system', "思考回路の接続が切れました。(Network Error)");
        }
    };

    const speakText = async (text: string) => {
        if (isAiSpeaking) return;
        setAiSpeaking(true);
        try {
            const res = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, speakerId: voiceId }),
            });
            if (!res.ok) throw new Error("TTS failed");
            const blob = await res.blob();
            await globalAudioManager.playBlob(blob);
        } catch (e) {
            console.error("TTS Error:", e);
        } finally {
            setAiSpeaking(false);
            setEmotion("neutral");
        }
    };

    const currentStatus = isListening ? 'listening' : isAiProcessing ? 'processing' : isAiSpeaking ? 'speaking' : 'idle';

    return (
        <>
            <KeyboardManager />
            <AnimatePresence>
                {!isBooted ? (
                    // Boot Sequence Overlay
                    <motion.div
                        key="boot"
                        exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                        transition={{ duration: 0.8 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black text-cyan-500 font-mono"
                    >
                        <div className="text-center space-y-4">
                            <Power className="w-16 h-16 mx-auto animate-pulse" />
                            <p className="tracking-[0.5em] text-xs animate-pulse">SYSTEM INITIALIZING...</p>
                        </div>
                    </motion.div>
                ) : (
                    // Main HUD
                    isUIVisible && (
                        <motion.div
                            key="hud"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }} // フェードアウト演出
                            transition={{ duration: 0.5 }}
                            className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 overflow-hidden"
                        >
                            {/* --- Top Bar (HUD Header) --- */}
                            <div className="flex justify-between items-start z-10">
                                <StatusIndicator status={currentStatus} />

                                <div className="flex gap-2 pointer-events-auto">
                                    <HoloButton variant="ghost" className="px-3" onClick={() => setIsSettingsOpen(true)}>
                                        <Settings2 className="w-5 h-5" />
                                    </HoloButton>
                                </div>
                            </div>

                            {/* --- Bottom Area (Controls & Chat) --- */}
                            <div className="flex flex-col-reverse md:flex-row items-end justify-between gap-6 z-10 mb-4 md:mb-0">

                                {/* Left: Audio Visualizer (Enhanced) */}
                                <div className="flex items-end gap-1 h-20 opacity-90">
                                    {Array.from({ length: 16 }).map((_, i) => {
                                        // 左右対称の波形を作るための計算
                                        const centerDist = Math.abs(i - 8);
                                        const heightMultiplier = 1 - (centerDist * 0.1);
                                        return (
                                            <div key={i}
                                                className={cn("w-1.5 transition-all duration-75 rounded-t-sm",
                                                    isListening ? "bg-cyan-400 shadow-[0_0_10px_cyan]" : "bg-cyan-900/40 h-1"
                                                )}
                                                style={{
                                                    height: isListening
                                                        ? `${Math.max(4, Math.random() * (volume * 150) * heightMultiplier)}px`
                                                        : '4px'
                                                }}
                                            />
                                        );
                                    })}
                                </div>

                                {/* Center: Mic Control */}
                                <div className="absolute left-1/2 bottom-8 -translate-x-1/2 pointer-events-auto">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleMicClick}
                                        className={cn(
                                            "relative group w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-md",
                                            isListening
                                                ? "bg-red-500/20 ring-2 ring-red-500 shadow-[0_0_50px_rgba(239,68,68,0.4)]"
                                                : "bg-cyan-950/40 border border-cyan-500/30 hover:bg-cyan-900/50 hover:border-cyan-400"
                                        )}
                                    >
                                        {/* Spinning Ring */}
                                        <div className={cn(
                                            "absolute inset-0 rounded-full border-t-2 border-l-2 border-transparent transition-all duration-[2000ms]",
                                            isAiProcessing ? "border-amber-400 animate-spin" :
                                                isListening ? "border-red-400 animate-spin-slow" : "border-cyan-400/30"
                                        )} />

                                        {isListening ? (
                                            <MicOff className="w-8 h-8 text-red-400" />
                                        ) : (
                                            <Mic className={cn("w-8 h-8 transition-colors", isAiProcessing ? "text-amber-400" : "text-cyan-400")} />
                                        )}
                                    </motion.button>
                                    <div className="text-center mt-3 flex flex-col items-center gap-2">
                                        <span className={cn("text-[10px] font-mono tracking-[0.2em] font-bold", isListening ? "text-red-400 animate-pulse" : "text-cyan-600/70")}>
                                            {isListening ? "LISTENING..." : "TAP TO TALK"}
                                        </span>

                                        {/* Transcript Display (In-situ) */}
                                        {(isListening || transcript) && (
                                            <div className="max-w-[300px] text-center">
                                                <p className="text-cyan-100 text-sm font-medium drop-shadow-md">{transcript}</p>
                                                {isListening && <p className="text-cyan-400/70 text-xs animate-pulse">{interimTranscript}</p>}
                                            </div>
                                        )}
                                        {/* Error Display */}
                                        {micError && (
                                            <div className="text-red-400 text-xs font-bold animate-pulse bg-red-950/50 px-2 py-1 rounded border border-red-500/50">
                                                ERROR: {micError}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Chat Log */}
                                <div className="w-full md:w-1/3 flex justify-end">
                                    <CyberChatLog messages={messages} />
                                </div>
                            </div>

                            <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
                        </motion.div>
                    )
                )}
            </AnimatePresence>

            {/* Cinematic Mode Hint (UIが消えている時だけ薄く表示) */}
            {
                !isUIVisible && isBooted && (
                    <div className="absolute bottom-4 right-4 text-white/10 text-[10px] font-mono pointer-events-none">
                        PRESS &apos;H&apos; TO TOGGLE HUD
                    </div>
                )
            }
        </>
    );
}
