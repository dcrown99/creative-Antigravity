'use client';

import { useState, useRef, useCallback } from 'react';
import { AssetHistoryChart, PeriodOption } from './AssetHistoryChart';
import { getAssetHistory } from '@/lib/actions';
import { HistoryEntry } from '@/services/analytics.service';

interface AnalyticsHistoryClientProps {
    initialData: HistoryEntry[];
    currentTotalValue: number;
    initialPeriod?: PeriodOption;
}

export function AnalyticsHistoryClient({
    initialData,
    currentTotalValue,
    initialPeriod = 30
}: AnalyticsHistoryClientProps) {
    const [period, setPeriod] = useState<PeriodOption>(initialPeriod);
    const [historyData, setHistoryData] = useState<HistoryEntry[]>(initialData);
    const [isLoading, setIsLoading] = useState(false);

    // useRef to track current period without stale closure issues
    const periodRef = useRef<PeriodOption>(initialPeriod);

    // 期間変更時にデータを再取得
    const handlePeriodChange = useCallback(async (newPeriod: PeriodOption) => {
        // Use ref to check current value (avoids stale closure)
        if (newPeriod === periodRef.current) return;

        // Update both ref and state
        periodRef.current = newPeriod;
        setPeriod(newPeriod);
        setIsLoading(true);

        try {
            const data = await getAssetHistory(newPeriod);
            // Only update if this is still the current period
            if (periodRef.current === newPeriod) {
                setHistoryData(data);
            }
        } catch (error) {
            console.error('Failed to fetch history:', error);
        } finally {
            if (periodRef.current === newPeriod) {
                setIsLoading(false);
            }
        }
    }, []);

    return (
        <div className="relative">
            {isLoading && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            )}
            <AssetHistoryChart
                data={historyData}
                currentTotalValue={currentTotalValue}
                period={period}
                onPeriodChange={handlePeriodChange}
            />
        </div>
    );
}
