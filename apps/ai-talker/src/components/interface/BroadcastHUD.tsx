"use client";

import { useEffect, useRef, useState } from "react";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { globalAudioManager } from "@/lib/audio/audio-manager";
import { chatWithGemini, analyzeGrammar } from "@/lib/ai/gemini-client";
import { useAvatarStore } from "@/stores/avatar-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useConversationStore } from "@/stores/conversation-store";
import { Button } from "@repo/ui";
import { Mic, MicOff, Settings2, Sparkles, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { SettingsDialog } from "./SettingsDialog";

export function BroadcastHUD() {
    // Hooks & Stores
    const { isListening, transcript, startListening, stopListening, hasRecognitionSupport, volume } = useSpeechRecognition();
    const setEmotion = useAvatarStore(s => s.setEmotion);
    const { voiceId, getSystemPrompt } = useSettingsStore();
    const {
        messages, addMessage, updateMessageFeedback,
        isAiProcessing, setAiProcessing,
        isAiSpeaking, setAiSpeaking,
        setRecording
    } = useConversationStore();

    const [showSettings, setShowSettings] = useState(false);

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

        // Async Grammar Analysis
        analyzeGrammar(userText).then((feedback) => {
            if (feedback && feedback.hasError) {
                updateMessageFeedback(userMsgId, {
                    corrected: feedback.corrected,
                    reason: feedback.reason
                });
            }
        });

        const historyForAi = messages.slice(-10).map(m => ({
            role: m.role as "user" | "model",
            parts: m.text
        }));

        const currentSystemPrompt = getSystemPrompt();

        try {
            const res = await chatWithGemini(userText, historyForAi, currentSystemPrompt);

            setAiProcessing(false);
            setEmotion(res.emotion);
            addMessage('model', res.text);

            await speakText(res.text);
        } catch (e) {
            console.error(e);
            setAiProcessing(false);
            addMessage('system', "Connection error. Please check your API key.");
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

    // Get the latest message to display as subtitle
    const latestMessage = messages[messages.length - 1];

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 overflow-hidden z-20">

            {/* Top Right: Settings */}
            <div className="absolute top-6 right-6 pointer-events-auto">
                <Button variant="ghost" size="icon" className="text-white/50 hover:text-white hover:bg-white/10 rounded-full" onClick={() => setShowSettings(true)}>
                    <Settings2 className="w-6 h-6" />
                </Button>
                {showSettings && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowSettings(false)}>
                        <div className="bg-slate-900 p-6 rounded-2xl border border-white/10 w-full max-w-md" onClick={e => e.stopPropagation()}>
                            <SettingsDialog />
                            <Button className="mt-4 w-full" onClick={() => setShowSettings(false)}>Close</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Subtitles Area */}
            <div className="flex-1 flex flex-col justify-end items-center pb-32 px-4 md:px-20">
                <AnimatePresence mode="wait">
                    {latestMessage && (
                        <motion.div
                            key={latestMessage.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={cn(
                                "max-w-4xl text-center p-4 rounded-2xl backdrop-blur-md shadow-2xl border",
                                latestMessage.role === 'user'
                                    ? "bg-black/40 border-white/10 text-white"
                                    : "bg-indigo-900/40 border-indigo-500/30 text-indigo-100"
                            )}
                        >
                            <p className="text-xl md:text-2xl font-medium leading-relaxed drop-shadow-md font-sans">
                                {latestMessage.text}
                            </p>
                            {latestMessage.feedback && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mt-2 text-sm text-emerald-300 bg-emerald-900/30 p-2 rounded-lg border border-emerald-500/20 inline-block"
                                >
                                    <span className="font-bold mr-2">✓ Correction:</span>
                                    {latestMessage.feedback.corrected}
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Control Bar */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-8 pointer-events-auto">
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleMicClick}
                    disabled={isAiProcessing || isAiSpeaking}
                    className={cn(
                        "relative h-20 w-20 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.3)] backdrop-blur-xl border transition-all duration-300",
                        isListening
                            ? "bg-red-500/80 border-red-400 text-white shadow-[0_0_30px_rgba(239,68,68,0.6)]"
                            : isAiProcessing
                                ? "bg-amber-500/80 border-amber-400 text-white animate-pulse"
                                : isAiSpeaking
                                    ? "bg-cyan-500/80 border-cyan-400 text-white shadow-[0_0_30px_rgba(6,182,212,0.6)]"
                                    : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                    )}
                >
                    {isListening ? (
                        <MicOff className="w-8 h-8" />
                    ) : isAiProcessing ? (
                        <Sparkles className="w-8 h-8 animate-spin" />
                    ) : isAiSpeaking ? (
                        <Volume2 className="w-8 h-8 animate-bounce" />
                    ) : (
                        <Mic className="w-8 h-8" />
                    )}

                    {/* Ripple Effect when listening */}
                    {isListening && (
                        <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-75" />
                    )}
                </motion.button>
            </div>
        </div>
    );
}
