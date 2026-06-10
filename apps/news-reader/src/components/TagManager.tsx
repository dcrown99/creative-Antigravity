'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Button,
    Input,
    Badge,
} from '@repo/ui';
import { Plus, X, Tag, Loader2, Edit2, Check } from 'lucide-react';

interface TagData {
    id: string;
    name: string;
    color: string;
    articleCount: number;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

const PRESET_COLORS = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#6366f1', // indigo (default)
];

export function TagManager() {
    const { data, error, mutate } = useSWR<{ tags: TagData[] }>('/api/tags', fetcher);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#6366f1');
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    const handleAddTag = async () => {
        if (!newTagName.trim()) return;

        setIsAdding(true);
        try {
            await fetch('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newTagName, color: newTagColor }),
            });
            setNewTagName('');
            setNewTagColor('#6366f1');
            mutate();
        } catch (error) {
            console.error('Failed to add tag:', error);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteTag = async (id: string) => {
        try {
            await fetch(`/api/tags?id=${id}`, { method: 'DELETE' });
            mutate();
        } catch (error) {
            console.error('Failed to delete tag:', error);
        }
    };

    const handleUpdateTag = async (id: string, name: string) => {
        try {
            await fetch('/api/tags', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name }),
            });
            setEditingId(null);
            mutate();
        } catch (error) {
            console.error('Failed to update tag:', error);
        }
    };

    const startEditing = (tag: TagData) => {
        setEditingId(tag.id);
        setEditingName(tag.name);
    };

    if (error) {
        return (
            <Card className="w-full max-w-md">
                <CardContent className="py-4 text-red-500">
                    タグの読み込みに失敗しました
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    タグ管理
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Add new tag */}
                <div className="flex gap-2">
                    <Input
                        placeholder="新しいタグ名"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                        className="flex-1"
                    />
                    <div className="flex gap-1">
                        {PRESET_COLORS.slice(0, 5).map(color => (
                            <button
                                key={color}
                                onClick={() => setNewTagColor(color)}
                                className={`w-6 h-6 rounded-full border-2 ${newTagColor === color ? 'border-gray-800' : 'border-transparent'
                                    }`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                    <Button
                        onClick={handleAddTag}
                        disabled={isAdding || !newTagName.trim()}
                        size="icon"
                    >
                        {isAdding ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4" />
                        )}
                    </Button>
                </div>

                {/* Tag list */}
                <div className="space-y-2">
                    {!data ? (
                        <div className="flex items-center gap-2 text-gray-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            読み込み中...
                        </div>
                    ) : data.tags.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                            タグがありません
                        </p>
                    ) : (
                        data.tags.map(tag => (
                            <div
                                key={tag.id}
                                className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 group"
                            >
                                <span
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: tag.color }}
                                />

                                {editingId === tag.id ? (
                                    <>
                                        <Input
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            className="flex-1 h-7"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleUpdateTag(tag.id, editingName);
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                        />
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            onClick={() => handleUpdateTag(tag.id, editingName)}
                                        >
                                            <Check className="w-3 h-3" />
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex-1 text-sm">{tag.name}</span>
                                        <Badge variant="secondary" className="text-xs">
                                            {tag.articleCount}
                                        </Badge>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                            onClick={() => startEditing(tag)}
                                        >
                                            <Edit2 className="w-3 h-3" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600"
                                            onClick={() => handleDeleteTag(tag.id)}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
