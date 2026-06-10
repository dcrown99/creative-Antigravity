'use client';

import React, { useState, useRef } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@repo/ui';
import { Upload, Download, Loader2, Check, AlertCircle } from 'lucide-react';

export function ImportExport() {
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [importResult, setImportResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const response = await fetch('/api/opml');
            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'news-reader-export.opml';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export error:', error);
            setImportResult({
                success: false,
                message: 'エクスポートに失敗しました',
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setImportResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/opml', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                setImportResult({
                    success: true,
                    message: result.message,
                });
                // Refresh feeds
                window.location.reload();
            } else {
                setImportResult({
                    success: false,
                    message: result.error || 'インポートに失敗しました',
                });
            }
        } catch (error) {
            console.error('Import error:', error);
            setImportResult({
                success: false,
                message: 'インポートに失敗しました',
            });
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="text-lg">インポート / エクスポート</CardTitle>
                <CardDescription>
                    OPMLファイルでフィードを移行できます
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Export */}
                <Button
                    onClick={handleExport}
                    disabled={isExporting}
                    variant="outline"
                    className="w-full flex items-center gap-2"
                >
                    {isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Download className="w-4 h-4" />
                    )}
                    OPMLエクスポート
                </Button>

                {/* Import */}
                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".opml,.xml"
                        onChange={handleImport}
                        className="hidden"
                        id="opml-import"
                    />
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        variant="outline"
                        className="w-full flex items-center gap-2"
                    >
                        {isImporting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Upload className="w-4 h-4" />
                        )}
                        OPMLインポート
                    </Button>
                </div>

                {/* Result message */}
                {importResult && (
                    <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${importResult.success
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                        {importResult.success ? (
                            <Check className="w-4 h-4" />
                        ) : (
                            <AlertCircle className="w-4 h-4" />
                        )}
                        {importResult.message}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
