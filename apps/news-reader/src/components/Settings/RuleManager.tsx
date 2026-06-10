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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@repo/ui';
import { Plus, X, Zap, Loader2, Trash2, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';

interface RuleCondition {
    field: 'title' | 'content' | 'author' | 'feedUrl';
    operator: 'contains' | 'notContains' | 'equals' | 'startsWith';
    value: string;
}

interface RuleAction {
    type: 'markRead' | 'star' | 'addTag';
    value?: string;
}

interface RuleData {
    id: string;
    name: string;
    conditions: RuleCondition[];
    actions: RuleAction[];
    isActive: boolean;
    createdAt: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

const FIELD_OPTIONS = [
    { value: 'title', label: 'タイトル' },
    { value: 'content', label: '本文' },
    { value: 'author', label: '著者' },
    { value: 'feedUrl', label: 'フィードURL' },
];

const OPERATOR_OPTIONS = [
    { value: 'contains', label: 'を含む' },
    { value: 'notContains', label: 'を含まない' },
    { value: 'equals', label: 'と一致' },
    { value: 'startsWith', label: 'で始まる' },
];

const ACTION_OPTIONS = [
    { value: 'markRead', label: '既読にする' },
    { value: 'star', label: 'スターを付ける' },
    { value: 'addTag', label: 'タグを付ける' },
];

export function RuleManager() {
    const { data, error, mutate } = useSWR<{ rules: RuleData[] }>('/api/rules', fetcher);
    const [isAdding, setIsAdding] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // New rule form state
    const [newRuleName, setNewRuleName] = useState('');
    const [newCondition, setNewCondition] = useState<RuleCondition>({
        field: 'title',
        operator: 'contains',
        value: '',
    });
    const [newAction, setNewAction] = useState<RuleAction>({
        type: 'markRead',
    });

    const handleAddRule = async () => {
        if (!newRuleName.trim() || !newCondition.value.trim()) {
            toast.error('ルール名と条件値を入力してください');
            return;
        }

        setIsAdding(true);
        try {
            const response = await fetch('/api/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newRuleName,
                    conditions: [newCondition],
                    actions: [newAction],
                }),
            });

            if (!response.ok) throw new Error('Failed to create rule');

            toast.success('ルールを作成しました');
            setNewRuleName('');
            setNewCondition({ field: 'title', operator: 'contains', value: '' });
            setNewAction({ type: 'markRead' });
            setShowForm(false);
            mutate();
        } catch (error) {
            console.error('Failed to add rule:', error);
            toast.error('ルールの作成に失敗しました');
        } finally {
            setIsAdding(false);
        }
    };

    const handleToggleRule = async (id: string, isActive: boolean) => {
        try {
            await fetch('/api/rules', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isActive: !isActive }),
            });
            mutate();
            toast.success(isActive ? 'ルールを無効化しました' : 'ルールを有効化しました');
        } catch (error) {
            console.error('Failed to toggle rule:', error);
            toast.error('ルールの更新に失敗しました');
        }
    };

    const handleDeleteRule = async (id: string) => {
        try {
            await fetch(`/api/rules?id=${id}`, { method: 'DELETE' });
            mutate();
            toast.success('ルールを削除しました');
        } catch (error) {
            console.error('Failed to delete rule:', error);
            toast.error('ルールの削除に失敗しました');
        }
    };

    if (error) {
        return (
            <Card className="w-full">
                <CardContent className="py-4 text-red-500">
                    ルールの読み込みに失敗しました
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Zap className="w-5 h-5" />
                        自動化ルール
                    </CardTitle>
                    <Button
                        size="sm"
                        onClick={() => setShowForm(!showForm)}
                        variant={showForm ? 'outline' : 'default'}
                    >
                        {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4 mr-1" />}
                        {showForm ? '' : '新規'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Add new rule form */}
                {showForm && (
                    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 space-y-3">
                        <Input
                            placeholder="ルール名"
                            value={newRuleName}
                            onChange={(e) => setNewRuleName(e.target.value)}
                        />

                        <div className="text-xs text-gray-500 mt-2">条件</div>
                        <div className="flex gap-2 flex-wrap">
                            <Select
                                value={newCondition.field}
                                onValueChange={(v) => setNewCondition({ ...newCondition, field: v as RuleCondition['field'] })}
                            >
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {FIELD_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={newCondition.operator}
                                onValueChange={(v) => setNewCondition({ ...newCondition, operator: v as RuleCondition['operator'] })}
                            >
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {OPERATOR_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                placeholder="値"
                                value={newCondition.value}
                                onChange={(e) => setNewCondition({ ...newCondition, value: e.target.value })}
                                className="flex-1 min-w-[120px]"
                            />
                        </div>

                        <div className="text-xs text-gray-500 mt-2">アクション</div>
                        <Select
                            value={newAction.type}
                            onValueChange={(v) => setNewAction({ type: v as RuleAction['type'] })}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ACTION_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button
                            onClick={handleAddRule}
                            disabled={isAdding}
                            className="w-full"
                        >
                            {isAdding ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            ルールを作成
                        </Button>
                    </div>
                )}

                {/* Rule list */}
                <div className="space-y-2">
                    {!data ? (
                        <div className="flex items-center gap-2 text-gray-500 justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            読み込み中...
                        </div>
                    ) : data.rules.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                            ルールがありません
                        </p>
                    ) : (
                        data.rules.map(rule => (
                            <div
                                key={rule.id}
                                className={`p-3 rounded-lg border ${rule.isActive ? 'bg-white dark:bg-gray-900' : 'bg-gray-100 dark:bg-gray-800 opacity-60'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{rule.name}</span>
                                        <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                                            {rule.isActive ? '有効' : '無効'}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            onClick={() => handleToggleRule(rule.id, rule.isActive)}
                                            title={rule.isActive ? '無効にする' : '有効にする'}
                                        >
                                            {rule.isActive ? (
                                                <PowerOff className="w-3 h-3" />
                                            ) : (
                                                <Power className="w-3 h-3" />
                                            )}
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-red-500 hover:text-red-600"
                                            onClick={() => handleDeleteRule(rule.id)}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {rule.conditions.map((c, i) => (
                                        <span key={i}>
                                            {FIELD_OPTIONS.find(f => f.value === c.field)?.label}が
                                            「{c.value}」
                                            {OPERATOR_OPTIONS.find(o => o.value === c.operator)?.label}
                                        </span>
                                    ))}
                                    {' → '}
                                    {rule.actions.map((a, i) => (
                                        <span key={i}>
                                            {ACTION_OPTIONS.find(o => o.value === a.type)?.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
