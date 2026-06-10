"use client";

import { Button } from "@repo/ui";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Activity, Mic, BrainCircuit, Volume2 } from "lucide-react";

export const HoloButton = motion(Button);

export function StatusIndicator({ status }: { status: 'idle' | 'listening' | 'processing' | 'speaking' }) {
    return (
        <div className="pointer-events-auto bg-black/40 backdrop-blur-xl text-white p-4 rounded-2xl border border-white/10 flex items-center gap-4 transition-all hover:bg-black/60 shadow-2xl hover:scale-105 duration-300">
            <div className={cn("h-3 w-3 rounded-full shadow-[0_0_15px_currentColor] transition-colors duration-500",
                status === 'processing' ? "bg-amber-400 text-amber-400 animate-pulse" :
                    status === 'speaking' ? "bg-cyan-400 text-cyan-400 animate-pulse" :
                        status === 'listening' ? "bg-red-400 text-red-400 animate-pulse" :
                            "bg-indigo-400 text-indigo-400"
            )} />
            <div className="flex flex-col">
                <span className="text-[10px] font-mono text-white/50 tracking-widest uppercase mb-0.5">
                    {status.toUpperCase()}
                </span>
                <span className="text-sm font-bold tracking-wide flex items-center gap-2 text-white/90">
                    GEMINI 2.5 <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
                </span>
            </div>
        </div>
    );
}
