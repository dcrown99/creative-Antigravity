'use client';

import React from 'react';
import useSWR from 'swr';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Button,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    ScrollArea,
} from '@repo/ui';
import { Clock, Loader2, RefreshCw, Rss, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface FeedData {
    id: string;
    title: string;
    url: string;
    fetchFrequency?: number;
    lastFetchedAt?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

const FREQUENCY_OPTIONS = [
    { value: '5', label: '5分' },
    { value: '15', label: '15分' },
    { value: '30', label: '30分' },
    { value: '60', label: '1時間' },
    { value: '180', label: '3時間' },
    { value: '360', label: '6時間' },
    { value: '720', label: '12時間' },
    { value: '1440', label: '24時間' },
    { value: '0', label: '手動のみ' },
];

export function FeedSettings() {
    const { data, error, mutate } = useSWR<{ feeds: FeedData[] }>('/api/feeds', fetcher);

    const handleDelete = async (feedId: string) => {
        if (!confirm('このフィードを削除してもよろしいですか？')) return;

        try {
            const response = await fetch(`/api/feeds?id=${feedId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete feed');

            mutate();
            toast.success('フィードを削除しました');
        } catch (error) {
            console.error('Failed to delete feed:', error);
            toast.error('フィードの削除に失敗しました');
        }
    };

    const handleUpdateFrequency = async (feedId: string, frequency: number) => {
        try {
            const response = await fetch('/api/feeds', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: feedId, fetchFrequency: frequency }),
            });

            if (!response.ok) throw new Error('Failed to update feed');

            mutate();
            toast.success('更新頻度を変更しました');
        } catch (error) {
            console.error('Failed to update feed frequency:', error);
            toast.error('更新頻度の変更に失敗しました');
        }
    };

    const handleTriggerCron = async () => {
        console.log('Update All triggered');
        try {
            const response = await fetch('/api/cron', {
                method: 'GET',
                cache: 'no-store',
            });

            if (response.ok) {
                toast.success('全フィードの更新を開始しました');
            } else {
                toast.error('更新の開始に失敗しました');
            }
        } catch (error) {
            console.error('Failed to trigger cron:', error);
            toast.error('更新の開始に失敗しました');
        }
    };

    if (error) {
        return (
            <Card className="w-full">
                <CardContent className="py-4 text-red-500">
                    フィードの読み込みに失敗しました
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        フィード更新設定
                    </CardTitle>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleTriggerCron}
                    >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        今すぐ全更新
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {!data ? (
                    <div className="flex items-center gap-2 text-gray-500 justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        読み込み中...
                    </div>
                ) : data.feeds.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                        フィードがありません
                    </p>
                ) : (
                    <ScrollArea className="h-[300px]">
                        <div className="space-y-3">
                            {data.feeds.map(feed => (
                                <div
                                    key={feed.id}
                                    className="flex items-center justify-between p-2 rounded-lg border bg-gray-50 dark:bg-gray-800"
                                >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <Rss className="w-4 h-4 text-orange-500 shrink-0" />
                                        <span className="text-sm truncate">{feed.title}</span>
                                    </div>
                                    <Select
                                        value={String(feed.fetchFrequency || 15)}
                                        onValueChange={(v) => handleUpdateFrequency(feed.id, parseInt(v))}
                                    >
                                        <SelectTrigger className="w-28 shrink-0">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FREQUENCY_OPTIONS.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        onClick={() => handleDelete(feed.id)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
