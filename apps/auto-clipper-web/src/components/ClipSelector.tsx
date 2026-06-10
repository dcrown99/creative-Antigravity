import React, { useState, useRef, useEffect, useCallback } from 'react';
import WavesurferPlayer from '@wavesurfer/react';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Switch, Label, Badge, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@repo/ui";
import { Play, Pause, Scissors, Sparkles, MonitorSmartphone, AlignVerticalDistributeStart, Music, UploadCloud } from "lucide-react";
import { API_BASE_URL } from '@/lib/api';

interface Candidate {
  start: number;
  end: number;
  narration_script?: string;
  thumbnail_title?: string;
  reason?: string;
}

interface Job {
  video_path: string;
  candidates: Candidate[];
}

interface ClipSelectorProps {
  job: Job;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSelect: (options: any) => void;
}

export default function ClipSelector({ job, onSelect }: ClipSelectorProps) {
  const [selectedId, setSelectedId] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [wavesurfer, setWavesurfer] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [regions, setRegions] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const [vertical, setVertical] = useState(true);
  const [subtitles, setSubtitles] = useState(true);
  const [subtitlePosition, setSubtitlePosition] = useState<"bottom" | "top">("bottom");
  const [narration, setNarration] = useState(false);
  const [thumbnail, setThumbnail] = useState(true);
  const [bgmFiles, setBgmFiles] = useState<string[]>([]);
  const [selectedBgm, setSelectedBgm] = useState<string>("none");
  const [uploadYoutube, setUploadYoutube] = useState(false);
  const [privacy, setPrivacy] = useState("private");

  const videoUrl = job.video_path ? `${API_BASE_URL}${job.video_path}` : null;
  const candidates = job.candidates || [];
  const activeCandidate = candidates[selectedId];

  useEffect(() => {
    fetch(`${API_BASE_URL}/assets/bgm`)
      .then(res => res.json())
      .then(data => setBgmFiles(data.files || []))
      .catch(err => console.error("Failed to fetch BGM list", err));
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onReady = (ws: any) => {
    setWavesurfer(ws);
    setIsPlaying(false);
    ws.setVolume(0);
    const regionsPlugin = ws.registerPlugin(RegionsPlugin.create());
    setRegions(regionsPlugin);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    regionsPlugin.on('region-clicked', (region: any, e: any) => {
      e.stopPropagation(); region.play();
      if (videoRef.current) { videoRef.current.currentTime = region.start; videoRef.current.play(); }
    });
    ws.on('interaction', (newTime: number) => {
      if (videoRef.current) { videoRef.current.currentTime = newTime; }
    });
  };

  const onVideoTimeUpdate = () => {
    if (videoRef.current && wavesurfer) {
      const videoTime = videoRef.current.currentTime;
      const wsTime = wavesurfer.getCurrentTime();
      if (Math.abs(videoTime - wsTime) > 0.1) { wavesurfer.setTime(videoTime); }
    }
  };

  const onVideoPlay = () => { if (wavesurfer) wavesurfer.play(); setIsPlaying(true); };
  const onVideoPause = () => { if (wavesurfer) wavesurfer.pause(); setIsPlaying(false); };
  const onPlayPause = useCallback(() => {
    if (videoRef.current) { if (videoRef.current.paused) videoRef.current.play(); else videoRef.current.pause(); }
  }, [videoRef]);

  useEffect(() => {
    if (regions && activeCandidate) {
      regions.clearRegions();
      regions.addRegion({
        start: activeCandidate.start, end: activeCandidate.end,
        content: 'Clip', color: 'rgba(37, 99, 235, 0.3)', drag: true, resize: true
      });
      if (wavesurfer) wavesurfer.setTime(activeCandidate.start);
      if (videoRef.current) videoRef.current.currentTime = activeCandidate.start;
    }
  }, [selectedId, regions, activeCandidate, wavesurfer]);

  const handleCreate = () => {
    if (!activeCandidate) return;
    let start = activeCandidate.start;
    let end = activeCandidate.end;
    if (regions) {
      const regionList = regions.getRegions();
      if (regionList.length > 0) { start = regionList[0].start; end = regionList[0].end; }
    }
    onSelect({
      start, end,
      vertical_mode: vertical, subtitles, subtitle_position: subtitlePosition,
      use_narration: narration, use_thumbnail: thumbnail,
      narration_script: activeCandidate.narration_script,
      thumbnail_title: activeCandidate.thumbnail_title,
      bgm_file: selectedBgm === "none" ? null : selectedBgm,
      upload_to_youtube: uploadYoutube, youtube_privacy: privacy
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      <Card className="lg:col-span-2 flex flex-col overflow-hidden border-2 border-primary/20">
        <CardHeader className="bg-slate-50 dark:bg-slate-900 pb-2">
          <div className="flex justify-between items-center">
            <div><CardTitle className="flex items-center gap-2"><Scissors className="w-5 h-5 text-primary" />Clip Editor</CardTitle><CardDescription>波形を見ながら切り抜き範囲を微調整できます</CardDescription></div>
            <Button variant="outline" size="icon" onClick={onPlayPause} className="w-12 h-12 rounded-full border-2">{isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}</Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 bg-slate-900 relative min-h-[300px] flex flex-col p-0">
          <div className="relative flex-1 bg-black flex items-center justify-center">
            {videoUrl ? (
              <div className="w-full h-full flex flex-col">
                <div className="flex-1 relative">
                  <video ref={videoRef} src={videoUrl} className="w-full h-full object-contain max-h-[400px]" onTimeUpdate={onVideoTimeUpdate} onPlay={onVideoPlay} onPause={onVideoPause} onError={(e) => console.error("Video Error:", e)} />
                </div>
                <div className="h-32 w-full bg-slate-900/90 border-t border-slate-800">
                  <WavesurferPlayer height={128} waveColor="#475569" progressColor="#3b82f6" url={videoUrl} onReady={onReady} interact={true} />
                </div>
              </div>
            ) : <div className="text-center text-slate-400">Video URL not available.</div>}
          </div>
        </CardContent>
        <div className="p-6 bg-white dark:bg-slate-950 border-t">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            <div className="flex items-center space-x-2"><Switch id="vertical" checked={vertical} onCheckedChange={setVertical} /><Label htmlFor="vertical" className="flex items-center gap-1 cursor-pointer"><MonitorSmartphone className="w-4 h-4" /> 縦型</Label></div>
            <div className="flex items-center space-x-2"><Switch id="subs" checked={subtitles} onCheckedChange={setSubtitles} /><Label htmlFor="subs" className="cursor-pointer">字幕</Label></div>
            <div className="flex items-center space-x-2"><Switch id="sub-pos" checked={subtitlePosition === "top"} onCheckedChange={(c) => setSubtitlePosition(c ? "top" : "bottom")} disabled={!subtitles} /><Label htmlFor="sub-pos" className="flex items-center gap-1 cursor-pointer"><AlignVerticalDistributeStart className="w-4 h-4" /> {subtitlePosition === "top" ? "上" : "下"}</Label></div>
            <div className="flex items-center space-x-2"><Switch id="narr" checked={narration} onCheckedChange={setNarration} /><Label htmlFor="narr" className="cursor-pointer">AI解説</Label></div>
            <div className="flex items-center space-x-2"><Switch id="thumb" checked={thumbnail} onCheckedChange={setThumbnail} /><Label htmlFor="thumb" className="cursor-pointer">サムネ</Label></div>
            <div className="flex flex-col space-y-1 col-span-2 md:col-span-1 lg:col-span-1">
              <Label htmlFor="bgm" className="text-xs flex items-center gap-1"><Music className="w-3 h-3" /> BGM</Label>
              <Select value={selectedBgm} onValueChange={setSelectedBgm}><SelectTrigger id="bgm" className="h-8"><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value="none">なし</SelectItem>{bgmFiles.map(f => (<SelectItem key={f} value={f}>{f}</SelectItem>))}</SelectContent></Select>
            </div>
          </div>
          <div className="border-t pt-4 flex flex-col md:flex-row gap-4 items-center bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border-red-100 dark:border-red-900/50">
            <div className="flex items-center space-x-2">
              <Switch id="yt-upload" checked={uploadYoutube} onCheckedChange={setUploadYoutube} className="data-[state=checked]:bg-red-600" />
              <Label htmlFor="yt-upload" className="flex items-center gap-1 cursor-pointer font-semibold text-red-700 dark:text-red-400"><UploadCloud className="w-4 h-4" /> YouTubeへ自動投稿</Label>
            </div>
            {uploadYoutube && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-5">
                <Label htmlFor="privacy" className="text-xs">公開設定:</Label>
                <Select value={privacy} onValueChange={setPrivacy}><SelectTrigger id="privacy" className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="private">非公開</SelectItem><SelectItem value="unlisted">限定公開</SelectItem><SelectItem value="public">公開</SelectItem></SelectContent></Select>
                <span className="text-xs text-muted-foreground ml-2">※タイトル・タグ・サムネはAIが自動生成します</span>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t bg-slate-50 dark:bg-slate-900 flex justify-end">
          <Button size="lg" onClick={handleCreate} className="w-full md:w-auto font-bold text-lg shadow-lg shadow-primary/20"><Sparkles className="w-5 h-5 mr-2" />クリップを作成する</Button>
        </div>
      </Card>
      <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
        <h3 className="font-semibold text-muted-foreground ml-1">AI推奨クリップ ({candidates.length})</h3>
        {candidates.map((c: Candidate, i: number) => (
          <Card key={i} className={`cursor-pointer transition-all hover:shadow-md ${selectedId === i ? 'border-primary ring-1 ring-primary shadow-md bg-primary/5' : 'hover:border-primary/50'}`} onClick={() => setSelectedId(i)}>
            <CardHeader className="p-4 pb-2">
              <div className="flex justify-between items-start"><Badge variant={selectedId === i ? "default" : "secondary"}>#{i + 1}</Badge><span className="text-xs text-muted-foreground font-mono">{c.start.toFixed(0)}-{c.end.toFixed(0)}s</span></div>
              <CardTitle className="text-base mt-2 leading-tight">{c.thumbnail_title || c.reason}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2"><p className="text-sm text-muted-foreground line-clamp-3">{c.narration_script || c.reason}</p></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
