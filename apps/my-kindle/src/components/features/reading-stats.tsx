import { LibraryItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { TrendingUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@repo/ui';
import { Button } from '@repo/ui';

interface ReadingStatsProps {
    books: LibraryItem[];
}

export function ReadingStats({ books }: ReadingStatsProps) {
    const totalBooks = books.length;
    const finishedBooks = books.filter(b => b.progress === 100).length;
    const inProgressBooks = books.filter(b => b.progress > 0 && b.progress < 100).length;
    const unreadBooks = books.filter(b => b.progress === 0).length;

    // Calculate completion rate
    const completionRate = totalBooks > 0 ? Math.round((finishedBooks / totalBooks) * 100) : 0;

    // Calculate total pages read (estimated)
    // Note: pageCurrent is 0-indexed, so +1. But if progress is 0, it's 0.
    const totalPagesRead = books.reduce((acc, b) => {
        if (b.progress === 0) return acc;
        return acc + (b.pageCurrent + 1);
    }, 0);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="読書データ">
                    <TrendingUp className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-400" />
                        読書データ
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 mt-4">
                    <Card className="bg-zinc-800/50 border-zinc-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400">総冊数</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">{totalBooks}</div>
                            <p className="text-xs text-zinc-500 mt-1">冊</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-800/50 border-zinc-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400">読了率</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-400">{completionRate}%</div>
                            <p className="text-xs text-zinc-500 mt-1">{finishedBooks} 冊 読了</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-800/50 border-zinc-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400">読書中</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-400">{inProgressBooks}</div>
                            <p className="text-xs text-zinc-500 mt-1">冊</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-800/50 border-zinc-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400">総ページ数 (概算)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-purple-400">{totalPagesRead.toLocaleString()}</div>
                            <p className="text-xs text-zinc-500 mt-1">ページ</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="mt-6">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">読書状況</h3>
                    <div className="h-4 bg-zinc-800 rounded-full overflow-hidden flex">
                        <div
                            className="h-full bg-green-500"
                            style={{ width: `${(finishedBooks / totalBooks) * 100}%` }}
                            title={`読了: ${finishedBooks}`}
                        />
                        <div
                            className="h-full bg-blue-500"
                            style={{ width: `${(inProgressBooks / totalBooks) * 100}%` }}
                            title={`読書中: ${inProgressBooks}`}
                        />
                        <div
                            className="h-full bg-zinc-600"
                            style={{ width: `${(unreadBooks / totalBooks) * 100}%` }}
                            title={`未読: ${unreadBooks}`}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500 mt-2">
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span>読了 ({finishedBooks})</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>読書中 ({inProgressBooks})</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-zinc-600" />
                            <span>未読 ({unreadBooks})</span>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
