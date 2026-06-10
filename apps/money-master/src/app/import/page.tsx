'use client';

import { useState, useTransition } from 'react';
import { CSVUploader } from '@/components/import/CSVUploader';
import { ImportPreview } from '@/components/import/ImportPreview';
import { detectFormat, parseCSV } from '@/lib/csv-parsers';
import { saveTransactionsToServer } from '@/lib/actions';
import { Transaction } from '@/types';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { CheckCircle2 } from 'lucide-react';
import { Button } from "@repo/ui";

export default function ImportPage() {
  const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload');
  const [parsedTransactions, setParsedTransactions] = useState<Partial<Transaction>[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleFileLoaded = (content: string) => {
    try {
      const format = detectFormat(content);
      if (format === 'unknown') {
        toast.error('未対応のCSVフォーマットです');
        return;
      }

      const transactions = parseCSV(content, format);
      if (transactions.length === 0) {
        toast.error('有効な取引データが見つかりませんでした');
        return;
      }

      setParsedTransactions(transactions);
      setStep('preview');
      toast.success(`${transactions.length}件のデータを読み込みました`);
    } catch (error) {
      console.error(error);
      toast.error('CSVの解析に失敗しました');
    }
  };

  const handleSave = (updatedTransactions: Partial<Transaction>[]) => {
    startTransition(async () => {
      try {
        // Ensure all required fields are present
        const validTransactions = updatedTransactions.filter(t =>
          t.date && t.amount !== undefined && t.type && t.category
        ) as Transaction[];

        if (validTransactions.length !== updatedTransactions.length) {
          toast.warning('一部のデータが無効なためスキップされました');
        }

        await saveTransactionsToServer(validTransactions);
        setStep('success');
        toast.success('インポートが完了しました');
      } catch (error) {
        console.error(error);
        toast.error('保存に失敗しました');
      }
    });
  };

  const handleCancel = () => {
    setParsedTransactions([]);
    setStep('upload');
  };

  const handleReset = () => {
    setParsedTransactions([]);
    setStep('upload');
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">データ取込</h1>
      </div>

      {step === 'upload' && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="col-span-2">
            <CSVUploader onFileLoaded={handleFileLoaded} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>対応フォーマット</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                <li>楽天証券 (取引履歴CSV)</li>
                <li>SBI証券 (取引履歴CSV)</li>
                <li>※ その他のフォーマットは順次対応予定</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'preview' && (
        <ImportPreview
          transactions={parsedTransactions}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={isPending}
        />
      )}

      {step === 'success' && (
        <Card className="text-center py-12">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">インポート完了</h2>
            <p className="text-muted-foreground">
              データの取り込みが正常に完了しました。
            </p>
            <Button onClick={handleReset}>続けてインポートする</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
