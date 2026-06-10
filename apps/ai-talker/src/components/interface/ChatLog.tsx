"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@repo/ui";
import { cn } from "@/lib/utils";

interface Message {
    role: "user" | "model";
    text: string;
}

interface ChatLogProps {
    messages: Message[];
}

export function ChatLog({ messages }: ChatLogProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    if (messages.length === 0) return null;

    return (
        <div className="w-full max-w-2xl h-64 bg-white/40 backdrop-blur-sm rounded-xl border border-white/20 p-4 mb-4 overflow-hidden mask-linear-fade">
            <ScrollArea className="h-full pr-4">
                <div className="flex flex-col gap-3">
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={cn(
                                "p-3 rounded-lg text-sm max-w-[85%] animate-in fade-in slide-in-from-bottom-2",
                                msg.role === "user"
                                    ? "bg-indigo-600 text-white self-end rounded-br-none"
                                    : "bg-white text-gray-800 self-start rounded-bl-none shadow-sm"
                            )}
                        >
                            {msg.text}
                        </div>
                    ))}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>
        </div>
    );
}
