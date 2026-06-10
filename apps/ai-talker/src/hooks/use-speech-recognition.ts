"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type RecognitionErrorType = 'no-speech' | 'audio-capture' | 'not-allowed' | 'network' | 'aborted' | 'service-not-allowed' | 'language-not-supported' | null;

interface SpeechRecognitionHook {
    isListening: boolean;
    transcript: string;
    interimTranscript: string;
    volume: number;
    error: RecognitionErrorType;
    startListening: () => void;
    stopListening: () => void;
    resetTranscript: () => void;
    hasRecognitionSupport: boolean;
}

export function useSpeechRecognition(): SpeechRecognitionHook {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [interimTranscript, setInterimTranscript] = useState("");
    const [volume, setVolume] = useState(0);
    const [error, setError] = useState<RecognitionErrorType>(null);
    const [hasRecognitionSupport, setHasSupport] = useState(false);

    const recognitionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const shouldKeepListening = useRef(false);

    useEffect(() => {
        if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
            setHasSupport(true);
            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
            const recognition = new SpeechRecognition();

            // CRITICAL CHANGE: continuous = false is often more reliable for "one turn" interactions
            // We will manually restart it if we want continuous listening, but for now let's try false
            // to ensure we get at least ONE result.
            // Actually, for a conversation app, we want continuous, but let's emulate it.
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = "ja-JP";
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                setError(null);
            };

            recognition.onresult = (event: any) => {
                let interim = "";
                let final = "";

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        final += event.results[i][0].transcript;
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }

                if (final) {
                    setTranscript(prev => {
                        const newTranscript = prev + " " + final;
                        return newTranscript;
                    });
                }
                setInterimTranscript(interim);
            };

            recognition.onerror = (event: any) => {
                console.warn("Speech Recognition Error:", event.error);
                setError(event.error);

                // If network error, we might want to stop completely
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    shouldKeepListening.current = false;
                    setIsListening(false);
                    stopAudioVisualizer();
                }
            };

            recognition.onnomatch = (event: any) => {
                setError('no-speech'); // Treat no match as no speech
            };

            recognition.onend = () => {
                // If we should be listening, restart!
                if (shouldKeepListening.current) {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.error("Failed to restart recognition", e);
                        setIsListening(false);
                        shouldKeepListening.current = false;
                    }
                } else {
                    setIsListening(false);
                    stopAudioVisualizer();
                }
            };

            recognitionRef.current = recognition;

            return () => {
                shouldKeepListening.current = false;
                if (recognitionRef.current) {
                    recognitionRef.current.abort();
                }
                stopAudioVisualizer();
            };
        }
    }, []);

    const startAudioVisualizer = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
            const audioContext = new AudioContextClass();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);

            source.connect(analyser);
            analyser.fftSize = 256;

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            sourceRef.current = source;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateVolume = () => {
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / bufferLength;
                setVolume(average / 128);
                animationFrameRef.current = requestAnimationFrame(updateVolume);
            };
            updateVolume();
        } catch (e) {
            console.error("Mic access denied for visualizer", e);
        }
    };

    const stopAudioVisualizer = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        audioContextRef.current?.close();
        audioContextRef.current = null;
    };

    const startListening = useCallback(() => {
        if (recognitionRef.current && !shouldKeepListening.current) {
            try {
                setTranscript("");
                setInterimTranscript("");
                setError(null);
                shouldKeepListening.current = true;
                recognitionRef.current.start();
                setIsListening(true);
                startAudioVisualizer();
            } catch (e) {
                console.error("Failed to start recognition", e);
                shouldKeepListening.current = false;
                setIsListening(false);
            }
        }
    }, []);

    const stopListening = useCallback(() => {
        shouldKeepListening.current = false;
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
        stopAudioVisualizer();
        setVolume(0);
    }, []);

    const resetTranscript = useCallback(() => setTranscript(""), []);

    return {
        isListening,
        transcript,
        interimTranscript,
        volume,
        error,
        startListening,
        stopListening,
        resetTranscript,
        hasRecognitionSupport,
    };
}
