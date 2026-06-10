"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui";
import { Download, RefreshCw, Trash2, Upload, Database, Settings, Save, HardDriveDownload, Tag, DollarSign, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { CategoryRulesManager } from "@/components/settings/CategoryRulesManager";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface BackupFile {
  name: string;
  size: number;
  date: string;
}

interface BackupSettings {
  enabled: boolean;
  scheduleHour: number;
  retentionDays: number;
}

interface SchedulerStatus {
  running: boolean;
  nextRun: string | null;
}

interface PriceSettings {
  enabled: boolean;
  scheduleHour: number;
  lastUpdatedAt?: string;
  lastError?: string;
}

export default function SettingsPage() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  // Backup settings state
  const [settings, setSettings] = useState<BackupSettings>({
    enabled: true,
    scheduleHour: 9,
    retentionDays: 30,
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialSettings, setInitialSettings] = useState<BackupSettings | null>(null);

  // Price update settings state
  const [priceSettings, setPriceSettings] = useState<PriceSettings>({
    enabled: true,
    scheduleHour: 19,
  });
  const [isLoadingPriceSettings, setIsLoadingPriceSettings] = useState(false);
  const [isSavingPriceSettings, setIsSavingPriceSettings] = useState(false);
  const [priceSchedulerStatus, setPriceSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

  const loadBackups = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/backup');
      const data = await res.json();
      if (data.success) {
        setBackups(data.backups);
      } else {
        toast.error('バックアップ一覧の取得に失敗しました');
      }
    } catch {
      toast.error('バックアップ一覧の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const res = await fetch('/api/backup-settings');
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setInitialSettings(data.settings);
        if (data.scheduler) {
          setSchedulerStatus(data.scheduler);
        }
      }
    } catch {
      console.error('Failed to load backup settings');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/backup-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('バックアップ設定を保存しました');
        setHasUnsavedChanges(false);
        setInitialSettings(settings);
        // Reload to get updated scheduler status
        await loadSettings();
      } else {
        toast.error(`設定の保存に失敗しました: ${data.error}`);
      }
    } catch {
      toast.error('設定の保存に失敗しました');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const loadPriceSettings = async () => {
    setIsLoadingPriceSettings(true);
    try {
      const res = await fetch('/api/price-settings');
      const data = await res.json();
      if (data.success) {
        setPriceSettings(data.settings);
        if (data.scheduler) {
          setPriceSchedulerStatus(data.scheduler);
        }
      }
    } catch {
      console.error('Failed to load price settings');
    } finally {
      setIsLoadingPriceSettings(false);
    }
  };

  const handleSavePriceSettings = async () => {
    setIsSavingPriceSettings(true);
    try {
      const res = await fetch('/api/price-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(priceSettings),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('価格更新設定を保存しました');
        await loadPriceSettings();
      } else {
        toast.error(`設定の保存に失敗しました: ${data.error}`);
      }
    } catch {
      toast.error('設定の保存に失敗しました');
    } finally {
      setIsSavingPriceSettings(false);
    }
  };

  const handleManualPriceUpdate = async () => {
    setIsUpdatingPrices(true);
    try {
      const res = await fetch('/api/price-settings', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('価格を更新しました');
        await loadPriceSettings();
      } else {
        toast.error(`価格更新に失敗しました: ${data.error}`);
      }
    } catch {
      toast.error('価格更新に失敗しました');
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  useEffect(() => {
    loadBackups();
    loadSettings();
    loadPriceSettings();
  }, []);

  // Warn user about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Track settings changes
  useEffect(() => {
    if (initialSettings) {
      const changed =
        settings.enabled !== initialSettings.enabled ||
        settings.scheduleHour !== initialSettings.scheduleHour ||
        settings.retentionDays !== initialSettings.retentionDays;
      setHasUnsavedChanges(changed);
    }
  }, [settings, initialSettings]);

  const handleCreateBackup = async () => {

    setIsCreatingBackup(true);
    try {
      const res = await fetch('/api/backup', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        toast.success('バックアップを作成しました');
        loadBackups();
      } else {
        toast.error('バックアップの作成に失敗しました');
      }
    } catch {
      toast.error('バックアップの作成に失敗しました');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleDeleteBackup = async (fileName: string) => {

    try {
      const res = await fetch(`/api/backup?file=${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        toast.success('バックアップを削除しました');
        loadBackups();
      } else {
        toast.error('バックアップの削除に失敗しました');
      }
    } catch {
      toast.error('バックアップの削除に失敗しました');
    }
  };

  const handleRestoreBackup = async (fileName: string) => {

    try {
      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('データベースを復元しました。ページをリロードしてください。');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error(`復元に失敗しました: ${data.error}`);
      }
    } catch {
      toast.error('復元に失敗しました');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">設定</h1>
      </div>

      <Tabs defaultValue="rules" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            カテゴリルール
          </TabsTrigger>
          <TabsTrigger value="price" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            価格更新
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            バックアップ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-6">
          <CategoryRulesManager />
        </TabsContent>

        <TabsContent value="price" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                自動価格更新
              </CardTitle>
              <CardDescription>
                毎日指定時刻にYahoo Financeから最新価格を自動取得します。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Manual Update Button */}
              <div className="flex gap-2">
                <Button onClick={handleManualPriceUpdate} disabled={isUpdatingPrices}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isUpdatingPrices ? 'animate-spin' : ''}`} />
                  {isUpdatingPrices ? '更新中...' : '今すぐ価格を更新'}
                </Button>
              </div>

              {/* Last Update Status */}
              {priceSettings.lastUpdatedAt && (
                <div className={`rounded-lg p-4 ${priceSettings.lastError ? 'bg-destructive/10' : 'bg-muted/50'}`}>
                  <div className="flex items-center gap-2">
                    {priceSettings.lastError ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    )}
                    <span className="text-sm">
                      最終更新: {new Date(priceSettings.lastUpdatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                    </span>
                  </div>
                  {priceSettings.lastError && (
                    <p className="text-sm text-destructive mt-2">{priceSettings.lastError}</p>
                  )}
                </div>
              )}

              {isLoadingPriceSettings ? (
                <div className="text-muted-foreground">設定を読み込み中...</div>
              ) : (
                <div className="space-y-6 border-t pt-6">
                  {/* Enable/Disable Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="price-enabled">自動価格更新を有効にする</Label>
                      <p className="text-sm text-muted-foreground">
                        毎日指定時刻に自動的に価格を更新します
                      </p>
                    </div>
                    <Switch
                      id="price-enabled"
                      checked={priceSettings.enabled}
                      onCheckedChange={(checked) =>
                        setPriceSettings({ ...priceSettings, enabled: checked })
                      }
                    />
                  </div>

                  {/* Schedule Hour */}
                  <div className="grid gap-2">
                    <Label htmlFor="price-schedule-hour">実行時刻</Label>
                    <Select
                      value={priceSettings.scheduleHour.toString()}
                      onValueChange={(value) =>
                        setPriceSettings({ ...priceSettings, scheduleHour: parseInt(value) })
                      }
                      disabled={!priceSettings.enabled}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="時刻を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i.toString().padStart(2, '0')}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      東京市場終了後（19:00以降）を推奨します
                    </p>
                  </div>

                  {/* Scheduler Status */}
                  {priceSchedulerStatus && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${priceSettings.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="text-sm font-medium">
                          {priceSettings.enabled ? 'スケジューラ有効' : 'スケジューラ無効'}
                        </span>
                      </div>
                      {priceSettings.enabled && priceSchedulerStatus.nextRun && (
                        <p className="text-sm text-muted-foreground">
                          次回実行: {new Date(priceSchedulerStatus.nextRun).toLocaleString('ja-JP', {
                            timeZone: 'Asia/Tokyo',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })} JST
                        </p>
                      )}
                    </div>
                  )}

                  {/* Save Button */}
                  <Button onClick={handleSavePriceSettings} disabled={isSavingPriceSettings}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSavingPriceSettings ? '保存中...' : '設定を保存'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                データベース バックアップ
              </CardTitle>
              <CardDescription>
                データベースをバックアップ・復元できます。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <ConfirmDialog
                  trigger={
                    <Button disabled={isCreatingBackup}>
                      <Download className="mr-2 h-4 w-4" />
                      {'バックアップを作成'}
                    </Button>
                  }
                  title="バックアップを作成"
                  description="データベースのバックアップを作成しますか？"
                  confirmLabel="作成"
                  onConfirm={handleCreateBackup}
                  disabled={isCreatingBackup}
                />
                <Button
                  variant="outline"
                  onClick={loadBackups}
                  disabled={isLoading}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  再読込
                </Button>
              </div>

              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="max-w-[200px]">ファイル名</TableHead>
                      <TableHead>サイズ</TableHead>
                      <TableHead>作成日時</TableHead>
                      <TableHead className="text-right w-[150px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          {isLoading ? '読み込み中...' : 'バックアップファイルがありません'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      backups.map((backup) => (
                        <TableRow key={backup.name}>
                          <TableCell className="font-mono text-sm">
                            {backup.name}
                          </TableCell>
                          <TableCell>{formatFileSize(backup.size)}</TableCell>
                          <TableCell>
                            {formatDistanceToNow(new Date(backup.date), {
                              addSuffix: true,
                              locale: ja,
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  window.location.href = `/api/backup/download?file=${encodeURIComponent(backup.name)}`;
                                }}
                              >
                                <HardDriveDownload className="h-4 w-4" />
                              </Button>
                              <ConfirmDialog
                                trigger={
                                  <Button variant="outline" size="sm">
                                    <Upload className="h-4 w-4 mr-1" />
                                    復元
                                  </Button>
                                }
                                title="バックアップから復元"
                                description={`バックアップ「${backup.name}」からデータベースを復元しますか？現在のデータベースは自動的にバックアップされます。`}
                                confirmLabel="復元"
                                onConfirm={() => handleRestoreBackup(backup.name)}
                              />
                              <ConfirmDialog
                                trigger={
                                  <Button variant="outline" size="sm">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                }
                                title="バックアップを削除"
                                description={`バックアップ「${backup.name}」を削除しますか？この操作は取り消せません。`}
                                confirmLabel="削除"
                                variant="destructive"
                                onConfirm={() => handleDeleteBackup(backup.name)}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Auto-backup settings */}
              <div className="border-t pt-6 mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">自動バックアップ設定</h3>
                </div>

                {isLoadingSettings ? (
                  <div className="text-muted-foreground">設定を読み込み中...</div>
                ) : (
                  <div className="space-y-6">
                    {/* Enable/Disable Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="backup-enabled">自動バックアップを有効にする</Label>
                        <p className="text-sm text-muted-foreground">
                          毎日指定時刻に自動的にバックアップを作成します
                        </p>
                      </div>
                      <Switch
                        id="backup-enabled"
                        checked={settings.enabled}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, enabled: checked })
                        }
                      />
                    </div>

                    {/* Schedule Hour */}
                    <div className="grid gap-2">
                      <Label htmlFor="schedule-hour">実行時刻</Label>
                      <Select
                        value={settings.scheduleHour.toString()}
                        onValueChange={(value) =>
                          setSettings({ ...settings, scheduleHour: parseInt(value) })
                        }
                        disabled={!settings.enabled}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="時刻を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i.toString().padStart(2, '0')}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Retention Days */}
                    <div className="grid gap-2">
                      <Label htmlFor="retention-days">保持期間（日数）</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="retention-days"
                          type="number"
                          min={1}
                          max={365}
                          value={settings.retentionDays}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              retentionDays: Math.max(1, Math.min(365, parseInt(e.target.value) || 1)),
                            })
                          }
                          className="w-24"
                          disabled={!settings.enabled}
                        />
                        <span className="text-muted-foreground">日</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        指定日数より古いバックアップは自動的に削除されます
                      </p>
                    </div>

                    {/* Scheduler Status */}
                    {schedulerStatus && (
                      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${settings.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <span className="text-sm font-medium">
                            {settings.enabled ? 'スケジューラ有効' : 'スケジューラ無効'}
                          </span>
                        </div>
                        {settings.enabled && schedulerStatus.nextRun && (
                          <p className="text-sm text-muted-foreground">
                            次回実行: {new Date(schedulerStatus.nextRun).toLocaleString('ja-JP', {
                              timeZone: 'Asia/Tokyo',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })} JST
                          </p>
                        )}
                      </div>
                    )}

                    {/* Save Button */}
                    <div className="flex items-center gap-4">
                      <Button
                        onClick={handleSaveSettings}
                        disabled={isSavingSettings || !hasUnsavedChanges}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {isSavingSettings ? '保存中...' : '設定を保存'}
                      </Button>
                      {hasUnsavedChanges && (
                        <span className="text-sm text-amber-500">未保存の変更があります</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="text-sm text-muted-foreground border-t pt-4 mt-4">
                <p>💡 ヒント:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>復元前に現在のデータベースは自動バックアップされます</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
