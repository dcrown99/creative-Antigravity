'use client';
import { useMutation } from '@tanstack/react-query';
import { renderVideo, createDigest, API_BASE_URL } from '@/lib/api';
import { Progress, Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@repo/ui";
import ClipSelector from './ClipSelector';
import { useJobStream } from '@/hooks/use-job-stream';
import { Download, ExternalLink, RefreshCw, CheckCircle } from "lucide-react";

interface JobStatusProps {
    jobId: string;
    onComplete?: () => void;
}

export default function JobStatus({ jobId }: JobStatusProps) {
    const { data: job, error, isConnected } = useJobStream(jobId);

    const renderMutation = useMutation({
        mutationFn: (params: {
            start: number,
            end: number,
            options: {
                vertical_mode: boolean;
                subtitles: boolean;
                use_narration: boolean;
                use_thumbnail: boolean;
                narration_script?: string;
                thumbnail_title?: string;
            }
        }) =>
            renderVideo(
                jobId,
                params.start,
                params.end,
                params.options.vertical_mode,
                params.options.subtitles,
                params.options.use_narration,
                params.options.use_thumbnail,
                params.options.narration_script,
                params.options.thumbnail_title
            ),
        onSuccess: () => {
            // SSE will handle updates
        }
    });

    const digestMutation = useMutation({
        mutationFn: () => createDigest(jobId, 5),
        onSuccess: () => {
            // SSE will handle updates
        }
    });

    const handleCreateDigest = () => {
        digestMutation.mutate();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleRender = (options: any) => {
        renderMutation.mutate({
            start: options.start,
            end: options.end,
            options
        });
    };

    if (error) return <div>ジョブステータスの読み込みに失敗しました</div>;
    if (!job) return (
        <div className="flex flex-col items-center justify-center p-4">
            <div>Connecting to updates...</div>
            <div className="text-xs text-gray-400 mt-2">
                {isConnected ? '● Connected' : '○ Connecting...'}
            </div>
        </div>
    );

    const getProgress = (status: string) => {
        switch (status) {
            case 'pending': return 10;
            case 'downloading': return 30;
            case 'transcribing': return 50;
            case 'analyzing': return 70;
            case 'waiting_for_selection': return 80;
            case 'editing': return 90;
            case 'planning_digest': return 85;
            case 'editing_digest': return 95;
            case 'completed': return 100;
            case 'failed': return 100;
            default: return 0;
        }
    };

    // Rich Result View
    if (job.status === 'completed' && job.result_path) {
        const videoUrl = `${API_BASE_URL}${job.result_path}`;
        const thumbUrl = job.thumbnail_url ? `${API_BASE_URL}${job.thumbnail_url}` : null;

        return (
            <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="overflow-hidden border-green-500/20 shadow-2xl shadow-green-500/10">
                    <div className="grid md:grid-cols-2 gap-0">
                        {/* Left: Video Player */}
                        <div className="relative flex items-center justify-center aspect-[9/16] md:aspect-auto min-h-[400px] overflow-hidden bg-black">
                            {/* Blurred Background */}
                            {thumbUrl && (
                                <div
                                    className="absolute inset-0 bg-cover bg-center blur-xl opacity-50 scale-110"
                                    style={{ backgroundImage: `url(${thumbUrl})` }}
                                />
                            )}

                            <video
                                src={videoUrl}
                                controls
                                className="relative z-10 max-h-[500px] w-full object-contain shadow-2xl"
                                poster={thumbUrl || undefined}
                            />
                        </div>

                        {/* Right: Info & Actions */}
                        <div className="p-8 flex flex-col justify-center bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
                            <div className="mb-6">
                                <div className="flex items-center gap-2 text-green-600 mb-2 font-bold">
                                    <CheckCircle className="w-5 h-5" />
                                    <span>生成完了</span>
                                </div>
                                <h2 className="text-2xl font-bold mb-2">{job.title || "Untitled Clip"}</h2>
                                <p className="text-muted-foreground">
                                    AIによる編集、字幕付け、音声解説の付与が完了しました。
                                </p>
                            </div>

                            <div className="space-y-4">
                                <Button className="w-full h-12 text-lg" asChild>
                                    <a href={videoUrl} download>
                                        <Download className="mr-2 h-5 w-5" /> 動画をダウンロード
                                    </a>
                                </Button>

                                {thumbUrl && (
                                    <Button variant="outline" className="w-full" asChild>
                                        <a href={thumbUrl} download>
                                            <ExternalLink className="mr-2 h-4 w-4" /> サムネイルを保存
                                        </a>
                                    </Button>
                                )}

                                <div className="pt-6 mt-6 border-t">
                                    <Button variant="ghost" className="w-full text-muted-foreground hover:text-primary" onClick={() => window.location.reload()}>
                                        <RefreshCw className="mr-2 h-4 w-4" /> 新しい動画を作成する
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    // Default Progress View
    return (
        <div className="w-full flex flex-col items-center">
            <Card className="w-full max-w-md mx-auto mt-4">
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        処理状況
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} title={isConnected ? "Live Updates" : "Disconnected"} />
                            <Badge variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'}>
                                {job.status}
                            </Badge>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Progress value={getProgress(job.status)} />

                    {/* Pro-Tip #4: 詳細なステータス表示 */}
                    {job.status === 'planning_digest' && (
                        <div className="mt-4 text-center text-purple-600 animate-pulse">
                            📝 AI が脚本を執筆中...
                        </div>
                    )}
                    {job.status === 'editing_digest' && (
                        <div className="mt-4 text-center text-purple-600 animate-pulse">
                            ✂️ 動画を結合中...
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Digestボタン - waiting_for_selection または completed 時に表示 */}
            {(job.status === 'waiting_for_selection' || job.status === 'completed') && (
                <div className="mt-4 w-full max-w-md">
                    <Button
                        onClick={handleCreateDigest}
                        disabled={digestMutation.isPending}
                        variant="outline"
                        className="w-full py-6 border-2 border-purple-500 text-purple-700 hover:bg-purple-50 text-lg font-medium"
                    >
                        🎬 総集編を作成 (5分)
                    </Button>
                </div>
            )}

            {job.status === 'waiting_for_selection' && job.candidates && (
                <div className="w-full mt-8">
                    <ClipSelector
                        job={job}
                        onSelect={handleRender}
                    />
                </div>
            )}
        </div>
    );
}
