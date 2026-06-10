"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Message } from "@/stores/conversation-store";
import { ScrollArea } from "@repo/ui";

interface CyberChatLogProps {
    messages: Message[];
}

export function CyberChatLog({ messages }: CyberChatLogProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    return (
        <div className="h-full w-full flex flex-col justify-end pointer-events-auto">
            {/* Mask Image: 上部を透過させてアバターの顔に被らないようにする */}
            <ScrollArea className="h-[400px] w-full max-w-lg pr-4 [mask-image:linear-gradient(to_bottom,transparent_0%,black_30%)]">
                <div className="flex flex-col gap-4 p-2 pt-20"> {/* pt-20で上部に余白を持たせる */}
                    <AnimatePresence initial={false}>
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20, y: 10 }}
                                animate={{ opacity: 1, x: 0, y: 0 }}
                                className={cn(
                                    "flex flex-col w-full max-w-[90%]",
                                    msg.role === 'user' ? "self-end items-end" : "self-start items-start"
                                )}
                            >
                                {/* Role Label */}
                                <span className={cn(
                                    "text-[9px] font-mono tracking-wider mb-1 px-1 opacity-70",
                                    msg.role === 'user' ? "text-cyan-300" : "text-purple-300"
                                )}>
                                    {msg.role === 'user' ? 'USER' : 'AI_MODEL'}
                                </span>

                                {/* Message Bubble - より洗練されたGlassmorphism */}
                                <div className={cn(
                                    "relative px-5 py-3 rounded-lg border backdrop-blur-md shadow-lg",
                                    msg.role === 'user'
                                        ? "bg-cyan-950/40 border-cyan-500/20 text-cyan-50 rounded-tr-none"
                                        : "bg-purple-950/40 border-purple-500/20 text-purple-50 rounded-tl-none"
                                )}>
                                    <p className="text-sm font-medium leading-relaxed font-sans tracking-wide drop-shadow-md">
                                        {msg.text}
                                    </p>
                                </div>

                                {/* Sensei's Note (Feedback) */}
                                {msg.feedback && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="mt-1 ml-1 text-xs bg-red-950/50 border-l-2 border-red-500 p-2 rounded-r-md text-red-100 max-w-[85%] backdrop-blur-sm"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[9px] bg-red-500/80 text-white px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider">Fix</span>
                                        </div>
                                        <div className="font-bold text-red-200">&quot;{msg.feedback.corrected}&quot;</div>
                                    </motion.div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>
        </div>
    );
}
