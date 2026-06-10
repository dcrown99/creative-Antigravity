'use client';

import { useState, useMemo, memo } from 'react';
import { Transaction } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { deleteTransactionAction } from '@/lib/actions';
import { AddTransactionDialog } from './AddTransactionDialog';
import { EditTransactionDialog } from './EditTransactionDialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Card,
    Button,
    Badge,
    Input,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    Label,
    Checkbox
} from '@repo/ui';
import { Trash2, ArrowUpCircle, ArrowDownCircle, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';


interface TransactionListClientProps {
    initialTransactions: Transaction[];
}


// Helper to format date consistently
const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';

    // Handle YYYYMMDD format
    if (/^\d{8}$/.test(dateStr)) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${year}-${month}-${day}`;
    }

    // Handle already formatted dates or other formats
    return dateStr;
};

// Memoized transaction row component to prevent unnecessary re-renders
const TransactionRow = memo(({
    transaction,
    onDelete,
    isDeleting,
    isSelected,
    onToggleSelect
}: {
    transaction: Transaction;
    onDelete: (id: string) => void;
    isDeleting: boolean;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
}) => {
    return (
        <TableRow className={isSelected ? 'bg-muted/50' : ''}>
            <TableCell>
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(transaction.id)}
                />
            </TableCell>
            <TableCell className="font-mono">{formatDate(transaction.date)}</TableCell>
            <TableCell>
                <div className="flex items-center gap-2">
                    {transaction.type === 'income' ? (
                        <ArrowUpCircle className="w-4 h-4 text-green-500" />
                    ) : (
                        <ArrowDownCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                        {transaction.type === 'income' ? '収入' : '支出'}
                    </span>
                </div>
            </TableCell>
            <TableCell>
                <Badge variant="outline">{transaction.category}</Badge>
            </TableCell>
            <TableCell>{transaction.description || '-'}</TableCell>
            <TableCell className={`text-right font-medium ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                }`}>
                {transaction.type === 'income' ? '+' : '-'}
                {formatCurrency(transaction.amount)}
            </TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                    <EditTransactionDialog transaction={transaction} />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(transaction.id)}
                        disabled={isDeleting}
                    >
                        <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
});


TransactionRow.displayName = 'TransactionRow';

export function TransactionListClient({ initialTransactions }: TransactionListClientProps) {
    const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // フィルタリング用のState
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');

    // 日付範囲フィルタ用のState
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // カテゴリリストの動的生成
    const uniqueCategories = useMemo(() => {
        const categories = new Set(transactions.map(t => t.category));
        return Array.from(categories).sort();
    }, [transactions]);

    // 日付文字列を比較可能な形式(YYYY-MM-DD)に正規化
    const normalizeDate = (dateStr: string): string => {
        if (!dateStr) return '';
        // YYYYMMDD形式の場合
        if (/^\d{8}$/.test(dateStr)) {
            return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
        }
        return dateStr;
    };

    // フィルタリング済み取引リスト
    const filteredTransactions = useMemo(() => {
        return transactions.filter(transaction => {
            // 検索キーワードフィルタ
            const matchesSearch = searchTerm === '' ||
                transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                transaction.amount.toString().includes(searchTerm);

            // 種別フィルタ
            const matchesType = filterType === 'all' || transaction.type === filterType;

            // カテゴリフィルタ
            const matchesCategory = filterCategory === 'all' || transaction.category === filterCategory;

            // 日付範囲フィルタ
            let matchesDateRange = true;
            if (startDate || endDate) {
                const txDate = normalizeDate(transaction.date);
                if (startDate && txDate < startDate) matchesDateRange = false;
                if (endDate && txDate > endDate) matchesDateRange = false;
            }

            return matchesSearch && matchesType && matchesCategory && matchesDateRange;
        });
    }, [transactions, searchTerm, filterType, filterCategory, startDate, endDate]);


    // Calculate pagination (filteredTransactionsベース)
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    // Memoize paginated transactions to avoid recalculation on every render
    const paginatedTransactions = useMemo(
        () => filteredTransactions.slice(startIndex, endIndex),
        [filteredTransactions, startIndex, endIndex]
    );

    // 一括選択用のState
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // 選択状態のトグル
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    // 全選択/全解除（現在のページのみ）
    const toggleSelectAll = () => {
        const pageIds = paginatedTransactions.map(t => t.id);
        const allSelected = pageIds.every(id => selectedIds.has(id));

        if (allSelected) {
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                pageIds.forEach(id => newSet.delete(id));
                return newSet;
            });
        } else {
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                pageIds.forEach(id => newSet.add(id));
                return newSet;
            });
        }
    };

    // 一括削除ハンドラ
    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`選択した ${selectedIds.size} 件の取引を削除してもよろしいですか？`)) return;

        setIsDeleting('bulk');
        try {
            // 並列で削除実行
            await Promise.all(Array.from(selectedIds).map(id => deleteTransactionAction(id)));

            setTransactions(prev => {
                const newTransactions = prev.filter(t => !selectedIds.has(t.id));
                const newTotalPages = Math.ceil(newTransactions.length / itemsPerPage);
                if (currentPage > newTotalPages && newTotalPages > 0) {
                    setCurrentPage(newTotalPages);
                }
                return newTransactions;
            });
            setSelectedIds(new Set());
        } catch (error) {
            console.error('Failed to delete transactions:', error);
            alert('一部の削除に失敗しました');
        } finally {
            setIsDeleting(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('この取引を削除してもよろしいですか？')) return;

        setIsDeleting(id);
        try {
            await deleteTransactionAction(id);
            setTransactions(prev => {
                const newTransactions = prev.filter(t => t.id !== id);
                // Adjust current page if needed after deletion
                const newTotalPages = Math.ceil(newTransactions.length / itemsPerPage);
                if (currentPage > newTotalPages && newTotalPages > 0) {
                    setCurrentPage(newTotalPages);
                }
                return newTransactions;
            });
            // 選択リストからも削除
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        } catch (error) {
            console.error('Failed to delete transaction:', error);
            alert('削除に失敗しました');
        } finally {
            setIsDeleting(null);
        }
    };

    const goToPage = (page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    };


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">取引一覧</h2>
                <AddTransactionDialog />
            </div>

            <Card>
                {/* フィルタコントロールエリア */}
                <div className="p-4 border-b space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* 検索窓 */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">検索</Label>
                            <Input
                                type="text"
                                placeholder="内容や金額で検索..."
                                value={searchTerm}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* 種別フィルタ */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">種別</Label>
                            <Select value={filterType} onValueChange={(value: string) => setFilterType(value as 'all' | 'income' | 'expense')}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">すべて</SelectItem>
                                    <SelectItem value="income">収入</SelectItem>
                                    <SelectItem value="expense">支出</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* カテゴリフィルタ */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">カテゴリ</Label>
                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">すべて</SelectItem>
                                    {uniqueCategories.map(category => (
                                        <SelectItem key={category} value={category}>{category}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 開始日 */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                開始日
                            </Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                            />
                        </div>

                        {/* 終了日 */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                終了日
                            </Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>



                    {/* フィルタリセットボタン */}
                    {(searchTerm !== '' || filterType !== 'all' || filterCategory !== 'all' || startDate !== '' || endDate !== '') && (
                        <div className="flex justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterType('all');
                                    setFilterCategory('all');
                                    setStartDate('');
                                    setEndDate('');
                                    setCurrentPage(1);
                                }}
                            >
                                フィルタをリセット
                            </Button>
                        </div>
                    )}

                </div>

                {/* 一括削除ボタン */}
                {selectedIds.size > 0 && (
                    <div className="px-4 py-2 bg-destructive/10 border-b flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                            {selectedIds.size} 件を選択中
                        </span>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBulkDelete}
                            disabled={isDeleting === 'bulk'}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            選択した項目を削除
                        </Button>
                    </div>
                )}

                {/* テーブル横スクロール対応 */}
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">
                                    <Checkbox
                                        checked={paginatedTransactions.length > 0 && paginatedTransactions.every(t => selectedIds.has(t.id))}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </TableHead>
                                <TableHead>日付</TableHead>
                                <TableHead>タイプ</TableHead>
                                <TableHead>カテゴリ</TableHead>
                                <TableHead>内容</TableHead>
                                <TableHead className="text-right">金額</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {filteredTransactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        {transactions.length === 0
                                            ? '取引データがありません'
                                            : 'フィルタ条件に一致する取引が見つかりません'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedTransactions.map((transaction) => (
                                    <TransactionRow
                                        key={transaction.id}
                                        transaction={transaction}
                                        onDelete={handleDelete}
                                        isDeleting={isDeleting === transaction.id}
                                        isSelected={selectedIds.has(transaction.id)}
                                        onToggleSelect={toggleSelect}
                                    />
                                ))
                            )}
                        </TableBody>

                    </Table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                        <div className="text-sm text-muted-foreground">
                            {filteredTransactions.length} 件中 {startIndex + 1} - {Math.min(endIndex, filteredTransactions.length)} 件を表示
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => goToPage(currentPage - 1)}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="w-4 h-4 mr-1" />
                                前へ
                            </Button>
                            <span className="text-sm">
                                ページ {currentPage} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => goToPage(currentPage + 1)}
                                disabled={currentPage === totalPages}
                            >
                                次へ
                                <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
