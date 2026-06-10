"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Input } from "@repo/ui";
import { Settings, User, Mic2, Sparkles, Trash2, Link } from "lucide-react"; // GraduationCap -> Sparkles
import { useSettingsStore } from "@/stores/settings-store";
import { VOICE_PRESETS, ROLE_PRESETS, AVATAR_PRESETS } from "@/lib/constants";

interface SettingsDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    const {
        voiceId, setVoiceId,
        roleId, setRoleId,
        avatarUrl, setAvatarUrl,
        customAvatars, addCustomAvatar, removeCustomAvatar
    } = useSettingsStore();

    const [manualUrl, setManualUrl] = useState("");
    const [manualName, setManualName] = useState("");

    const handleUrlChange = (url: string) => {
        setManualUrl(url);
        if (url && !manualName) {
            const filename = url.split('/').pop()?.replace(/\.(vrm|glb)$/i, '') || '';
            setManualName(filename);
        }
    };

    const handleManualAdd = () => {
        if (!manualUrl) return;
        let finalUrl = manualUrl;
        try {
            const urlObj = new URL(manualUrl);
            if (urlObj.protocol === 'https:' || urlObj.protocol === 'http:') {
                if (!urlObj.hostname.includes('localhost') && !urlObj.hostname.includes('127.0.0.1')) {
                    finalUrl = `/api/vrm-proxy?url=${encodeURIComponent(manualUrl)}`;
                }
            }
        } catch (e) {
            console.log('Using URL as-is:', manualUrl);
        }

        const newAvatar = {
            id: `custom-${Date.now()}`,
            name: manualName || `My Avatar ${customAvatars.length + 1}`,
            url: finalUrl
        };
        addCustomAvatar(newAvatar);
        setTimeout(() => setAvatarUrl(finalUrl), 100);
        setManualUrl("");
        setManualName("");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {!open && !onOpenChange && (
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="bg-white/5 backdrop-blur-xl text-white hover:bg-white/10 rounded-full border border-white/10 shadow-lg">
                        <Settings className="h-5 w-5" />
                    </Button>
                </DialogTrigger>
            )}

            <DialogContent className="sm:max-w-[400px] bg-black/80 backdrop-blur-2xl border-white/10 shadow-2xl rounded-[32px] p-6 text-white font-sans">
                <DialogHeader className="mb-4">
                    <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
                        <span className="bg-cyan-500/20 p-2.5 rounded-xl text-cyan-400 border border-cyan-500/20">
                            <Settings className="w-5 h-5" />
                        </span>
                        システム設定
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-6">

                    {/* Role Section (Moved to Top) */}
                    <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                        <Label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                            <Sparkles className="w-3 h-3" /> 性格・モード設定
                        </Label>
                        <Select value={roleId} onValueChange={setRoleId}>
                            <SelectTrigger className="h-11 rounded-xl border-white/10 bg-black/20 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 text-sm">
                                <SelectValue placeholder="Select Style" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl bg-black/90 border-white/10 text-white backdrop-blur-xl">
                                {ROLE_PRESETS.map((role) => (
                                    <SelectItem key={role.id} value={role.id} className="rounded-lg mx-1 my-0.5 cursor-pointer focus:bg-cyan-500/20 focus:text-cyan-300 text-sm">
                                        {role.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="mt-2 p-3 bg-cyan-500/5 rounded-lg border border-cyan-500/10">
                            <p className="text-[10px] text-cyan-300/70 leading-relaxed">
                                {ROLE_PRESETS.find(r => r.id === roleId)?.prompt.split('\n')[0]}...
                            </p>
                        </div>
                    </div>

                    {/* Voice Section */}
                    <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                        <Label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                            <Mic2 className="w-3 h-3" /> 音声モデル (Voicevox)
                        </Label>
                        <Select value={voiceId.toString()} onValueChange={(val) => setVoiceId(Number(val))}>
                            <SelectTrigger className="h-11 rounded-xl border-white/10 bg-black/20 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 text-sm">
                                <SelectValue placeholder="Select Voice" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl max-h-[300px] bg-black/90 border-white/10 text-white backdrop-blur-xl">
                                {VOICE_PRESETS.map((voice) => (
                                    <SelectItem key={voice.id} value={voice.id.toString()} className="rounded-lg mx-1 my-0.5 cursor-pointer focus:bg-cyan-500/20 focus:text-cyan-300 text-sm">
                                        {voice.name} ({voice.style})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Avatar Section */}
                    <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                        <Label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                            <User className="w-3 h-3" /> 3Dアバターモデル
                        </Label>

                        <div className="flex gap-2 items-center">
                            <Select value={avatarUrl} onValueChange={setAvatarUrl}>
                                <SelectTrigger className="h-11 rounded-xl border-white/10 bg-black/20 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 flex-1 transition-all text-sm">
                                    <SelectValue placeholder="Select Avatar" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl max-h-[300px] bg-black/90 border-white/10 text-white backdrop-blur-xl">
                                    {customAvatars.length > 0 && (
                                        <>
                                            <div className="px-3 py-2 text-[10px] font-bold text-white/30 bg-white/5 uppercase tracking-wider">My Avatars</div>
                                            {customAvatars.map((avatar) => (
                                                <SelectItem key={avatar.id} value={avatar.url} className="rounded-lg mx-1 my-0.5 cursor-pointer focus:bg-cyan-500/20 focus:text-cyan-300 text-sm">
                                                    {avatar.name}
                                                </SelectItem>
                                            ))}
                                            <Separator className="my-1 bg-white/10" />
                                        </>
                                    )}
                                    <div className="px-3 py-2 text-[10px] font-bold text-white/30 bg-white/5 uppercase tracking-wider">Presets</div>
                                    {AVATAR_PRESETS.map((avatar) => (
                                        <SelectItem key={avatar.id} value={avatar.url} className="rounded-lg mx-1 my-0.5 cursor-pointer focus:bg-cyan-500/20 focus:text-cyan-300 text-sm">
                                            {avatar.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
}
