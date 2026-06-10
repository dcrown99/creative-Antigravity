'use client';

import { useState, useEffect } from 'react';
import { Transaction } from '@/types';
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Label,
    Checkbox
} from "@repo/ui";
import { Loader2, Brain, Plus } from 'lucide-react';
import { getCategoryRules, addCategoryRule, getUniqueCategories } from '@/lib/actions';
import { classifyTransaction, CategoryRule } from '@/lib/classifier';
import { toast } from 'sonner';

interface ImportPreviewProps {
    transactions: Partial<Transaction>[];
    onSave: (transactions: Partial<Transaction>[]) => void;
    onCancel: () => void;
    isSaving: boolean;
}

// 一般的なカテゴリリスト（初期値/フォールバック用）
const DEFAULT_CATEGORIES = [
    '食費', '日用品', '交通費', '住居費', '水道光熱費', '通信費',
    '給与', '配当・分配金', '投資信託', '趣味・娯楽', '交際費',
    '衣服・美容', '健康・医療', '教育・教養', '保険', 'その他', '未分類'
];

export function ImportPreview({ transactions: initialTransactions, onSave, onCancel, isSaving }: ImportPreviewProps) {
    const [transactions, setTransactions] = useState<Partial<Transaction>[]>(initialTransactions);
    const [rules, setRules] = useState<CategoryRule[]>([]);
    const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

    // Category Creation State
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [isCreateRuleChecked, setIsCreateRuleChecked] = useState(true);
    const [targetTransactionIndex, setTargetTransactionIndex] = useState<number | null>(null);

    // Learning Rule State
    const [isLearnDialogOpen, setIsLearnDialogOpen] = useState(false);
    const [learnKeyword, setLearnKeyword] = useState("");
    const [learnCategory, setLearnCategory] = useState("");

    // ルールとカテゴリのロード
    useEffect(() => {
        const loadData = async () => {
            try {
                const [rulesData, categoriesData] = await Promise.all([
                    getCategoryRules(),
                    getUniqueCategories()
                ]);
                setRules(rulesData as unknown as CategoryRule[]);

                // マージして重複排除
                const mergedCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...categoriesData]));
                setCategories(mergedCategories);
            } catch (error) {
                console.error("Failed to load data", error);
            }
        };
        loadData();
    }, []);

    // ルールがロードされたら、または初期データが変更されたら再分類
    useEffect(() => {
        if (rules.length > 0) {
            applyRules(rules);
        }
    }, [rules]); // initialTransactionsを含めるとループする可能性があるので注意。本来は初期ロード時のみで良いかも。

    const applyRules = (currentRules: CategoryRule[]) => {
        setTransactions(prev => prev.map(t => {
            // 既にユーザーが手動変更したものを上書きしないロジックを入れると複雑になるため、
            // ここではシンプルに全件再評価する（インポート直後のプレビューなので問題ない想定）
            // ただし、手動変更後にルール追加した場合は、手動変更が維持されるべきか、ルールに従うべきか。
            // ユーザー体験としては「ルール追加＝それに従わせたい」なので再評価で良い。
            const newCategory = classifyTransaction(t.description || '', currentRules);
            return { ...t, category: newCategory };
        }));
    };

    const handleCategoryChange = (index: number, value: string) => {
        if (value === "___CREATE_NEW___") {
            setTargetTransactionIndex(index);
            setNewCategoryName("");
            setIsCreateDialogOpen(true);
            return;
        }

        setTransactions(prev => {
            const next = [...prev];
            next[index] = { ...next[index], category: value };
            return next;
        });
    };

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) return;

        const newCat = newCategoryName.trim();

        // カテゴリリストに追加
        if (!categories.includes(newCat)) {
            setCategories(prev => [...prev, newCat]);
        }

        // 対象のトランザクションに適用
        let targetDesc = "";
        if (targetTransactionIndex !== null) {
            setTransactions(prev => {
                const next = [...prev];
                targetDesc = next[targetTransactionIndex].description || "";
                next[targetTransactionIndex] = { ...next[targetTransactionIndex], category: newCat };
                return next;
            });
        }

        // ルールも作成する場合
        if (isCreateRuleChecked && targetDesc) {
            try {
                // デフォルトでdescriptionをキーワードにするが、長すぎる場合は調整が必要かも
                // ここではシンプルにdescriptionそのままを使う
                const result = await addCategoryRule(targetDesc, newCat);
                if (result.success) {
                    toast.success(`ルールも保存しました: "${targetDesc}" -> ${newCat}`);
                    setRules(prev => [...prev, { pattern: targetDesc, category: newCat } as CategoryRule]);
                }
            } catch (e) {
                console.error("Failed to add rule", e);
            }
        }

        setIsCreateDialogOpen(false);
        setTargetTransactionIndex(null);
        setNewCategoryName("");
        toast.success(`カテゴリ「${newCat}」を追加しました`);
    };

    const openLearnDialog = (transaction: Partial<Transaction>) => {
        if (!transaction.description || !transaction.category) {
            toast.error("摘要またはカテゴリが不足しています");
            return;
        }
        setLearnKeyword(transaction.description);
        setLearnCategory(transaction.category);
        setIsLearnDialogOpen(true);
    };

    const handleLearnConfirm = async () => {
        if (!learnKeyword || !learnCategory) return;

        try {
            const result = await addCategoryRule(learnKeyword, learnCategory);
            if (result.success) {
                toast.success(`ルールを保存しました: "${learnKeyword}" -> ${learnCategory}`);

                // 新しいルールをリストに追加
                const newRule: CategoryRule = { pattern: learnKeyword, category: learnCategory };
                setRules(prev => [...prev, newRule]);

                // 必要なら再適用（今回は手動学習なので、他の行への影響はユーザー次第だが、一応適用しておくと親切）
                // applyRules([...rules, newRule]); 
            } else {
                toast.error("ルールの保存に失敗しました");
            }
        } catch {
            toast.error("エラーが発生しました");
        } finally {
            setIsLearnDialogOpen(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>インポートプレビュー ({transactions.length}件)</CardTitle>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={onCancel} disabled={isSaving}>
                        キャンセル
                    </Button>
                    <Button onClick={() => onSave(transactions)} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        保存する
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border max-h-[500px] overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>日付</TableHead>
                                <TableHead>種類</TableHead>
                                <TableHead>カテゴリ</TableHead>
                                <TableHead>内容</TableHead>
                                <TableHead className="text-right">金額</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map((t, i) => (
                                <TableRow key={i}>
                                    <TableCell className="whitespace-nowrap">{t.date}</TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${t.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {t.type === 'income' ? '収入' : '支出'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="min-w-[150px]">
                                        <Select
                                            value={t.category}
                                            onValueChange={(val) => handleCategoryChange(i, val)}
                                        >
                                            <SelectTrigger className="h-8">
                                                <SelectValue placeholder="カテゴリ選択" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="___CREATE_NEW___" className="text-primary font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Plus className="h-4 w-4" />
                                                        新しいカテゴリを作成
                                                    </div>
                                                </SelectItem>
                                                {categories.map(cat => (
                                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="max-w-[300px] truncate" title={t.description}>
                                        {t.description}
                                    </TableCell>
                                    <TableCell className="text-right font-medium whitespace-nowrap">
                                        ¥{t.amount?.toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                            onClick={() => openLearnDialog(t)}
                                            title="この分類を学習する"
                                        >
                                            <Brain className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>新しいカテゴリを作成</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                カテゴリ名
                            </Label>
                            <Input
                                id="name"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="col-span-3"
                                placeholder="例: 副業収入"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCreateCategory();
                                    }
                                }}
                            />
                        </div>
                        <div className="flex items-center space-x-2 ml-[25%]">
                            <Checkbox
                                id="createRule"
                                checked={isCreateRuleChecked}
                                onCheckedChange={(c) => setIsCreateRuleChecked(!!c)}
                            />
                            <Label htmlFor="createRule" className="text-sm text-muted-foreground">
                                この明細の摘要で自動分類ルールも作成する
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>キャンセル</Button>
                        <Button onClick={handleCreateCategory}>作成</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isLearnDialogOpen} onOpenChange={setIsLearnDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>自動分類ルールを作成</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="keyword" className="text-right">
                                キーワード
                            </Label>
                            <Input
                                id="keyword"
                                value={learnKeyword}
                                onChange={(e) => setLearnKeyword(e.target.value)}
                                className="col-span-3"
                                placeholder="摘要に含まれるキーワード"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="category" className="text-right">
                                カテゴリ
                            </Label>
                            <Input
                                id="category"
                                value={learnCategory}
                                disabled
                                className="col-span-3 bg-muted"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsLearnDialogOpen(false)}>キャンセル</Button>
                        <Button onClick={handleLearnConfirm}>ルールを保存</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card >
    );
}
