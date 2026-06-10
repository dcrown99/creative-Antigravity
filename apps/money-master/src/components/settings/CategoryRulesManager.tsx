"use client";

import { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Button,
    Input,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Label,
} from "@repo/ui";
import { Plus, Trash2, Tag, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getCategoryRules, addCategoryRule, deleteCategoryRule, updateCategoryRule } from "@/lib/actions";
import { CategoryRule } from "@/lib/classifier";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface EditingRule {
    id: string;
    pattern: string;
    category: string;
}

export function CategoryRulesManager() {
    const [rules, setRules] = useState<CategoryRule[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newPattern, setNewPattern] = useState("");
    const [newCategory, setNewCategory] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    // Edit modal state
    const [editingRule, setEditingRule] = useState<EditingRule | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    const loadRules = async () => {
        setIsLoading(true);
        try {
            const data = await getCategoryRules();
            setRules(Array.isArray(data) ? (data as unknown as CategoryRule[]) : []);
        } catch (error) {
            console.error("Failed to load rules:", error);
            setRules([]);
            toast.error("ルールの取得に失敗しました");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadRules();
    }, []);

    const handleAddRule = async () => {
        if (!newPattern || !newCategory) {
            toast.error("キーワードとカテゴリを入力してください");
            return;
        }

        setIsAdding(true);
        try {
            const result = await addCategoryRule(newPattern, newCategory);
            if (result.success) {
                toast.success("ルールを追加しました");
                setNewPattern("");
                setNewCategory("");
                loadRules();
            } else {
                toast.error(result.error || "ルールの追加に失敗しました");
            }
        } catch {
            toast.error("ルールの追加に失敗しました");
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteRule = async (id: string) => {
        try {
            const result = await deleteCategoryRule(id);
            if (result.success) {
                toast.success("ルールを削除しました");
                loadRules();
            } else {
                toast.error(result.error || "ルールの削除に失敗しました");
            }
        } catch {
            toast.error("ルールの削除に失敗しました");
        }
    };

    const handleEditClick = (rule: CategoryRule) => {
        if (!rule.id) return;
        setEditingRule({
            id: rule.id,
            pattern: typeof rule.pattern === 'string' ? rule.pattern : rule.pattern.source,
            category: rule.category,
        });
    };

    const handleUpdateRule = async () => {
        if (!editingRule) return;
        if (!editingRule.pattern || !editingRule.category) {
            toast.error("キーワードとカテゴリを入力してください");
            return;
        }

        setIsUpdating(true);
        try {
            const result = await updateCategoryRule(
                editingRule.id,
                editingRule.pattern,
                editingRule.category
            );
            if (result.success) {
                toast.success("ルールを更新しました");
                setEditingRule(null);
                loadRules();
            } else {
                toast.error(result.error || "ルールの更新に失敗しました");
            }
        } catch {
            toast.error("ルールの更新に失敗しました");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Tag className="h-5 w-5" />
                        カテゴリ自動化ルール
                    </CardTitle>
                    <CardDescription>
                        取引明細のキーワードに基づいて、カテゴリを自動的に割り当てるルールを管理します。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* 追加フォーム */}
                    <div className="flex gap-4 items-end">
                        <div className="grid gap-2 flex-1">
                            <label className="text-sm font-medium">キーワード (部分一致)</label>
                            <Input
                                placeholder="例: セブンイレブン"
                                value={newPattern}
                                onChange={(e) => setNewPattern(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2 flex-1">
                            <label className="text-sm font-medium">カテゴリ</label>
                            <Input
                                placeholder="例: 食費"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleAddRule} disabled={isAdding}>
                            <Plus className="mr-2 h-4 w-4" />
                            追加
                        </Button>
                    </div>

                    {/* ルール一覧 */}
                    <div className="border rounded-lg max-h-80 overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="w-[200px]">キーワード</TableHead>
                                    <TableHead>カテゴリ</TableHead>
                                    <TableHead className="text-right w-[100px]">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rules.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                            {isLoading ? "読み込み中..." : "ルールが登録されていません"}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rules.map((rule) => {
                                        const patternText = typeof rule.pattern === 'string' ? rule.pattern : rule.pattern.source;
                                        return (
                                            <TableRow key={rule.id || rule.pattern.toString()}>
                                                <TableCell
                                                    className="font-mono text-sm max-w-[200px] truncate"
                                                    title={patternText}
                                                >
                                                    {patternText}
                                                </TableCell>
                                                <TableCell>{rule.category}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex gap-1 justify-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEditClick(rule)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <ConfirmDialog
                                                            trigger={
                                                                <Button variant="ghost" size="sm">
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            }
                                                            title="ルールを削除"
                                                            description={`キーワード「${patternText}」のルールを削除しますか？`}
                                                            confirmLabel="削除"
                                                            variant="destructive"
                                                            onConfirm={async () => { if (rule.id) await handleDeleteRule(rule.id); }}
                                                        />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* 編集モーダル */}
            <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>ルールを編集</DialogTitle>
                        <DialogDescription>
                            カテゴリルールのキーワードまたはカテゴリを変更します。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-pattern">キーワード</Label>
                            <Input
                                id="edit-pattern"
                                value={editingRule?.pattern || ""}
                                onChange={(e) => setEditingRule(prev =>
                                    prev ? { ...prev, pattern: e.target.value } : null
                                )}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-category">カテゴリ</Label>
                            <Input
                                id="edit-category"
                                value={editingRule?.category || ""}
                                onChange={(e) => setEditingRule(prev =>
                                    prev ? { ...prev, category: e.target.value } : null
                                )}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingRule(null)}>
                            キャンセル
                        </Button>
                        <Button onClick={handleUpdateRule} disabled={isUpdating}>
                            {isUpdating ? "更新中..." : "更新"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
