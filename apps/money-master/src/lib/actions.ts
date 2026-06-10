'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import * as AssetService from '@/services/asset.service';
import * as TransactionService from '@/services/transaction.service';
import * as SystemService from '@/services/system.service';
import * as DividendService from '@/services/dividend.service';
import * as AnalyticsService from '@/services/analytics.service';
import { Asset, Transaction, AnalysisLog } from '@/types';
import { TransactionSchema, DividendSchema, parseTransactionFormData, parseDividendFormData } from '@/lib/validation';


// ==========================================
// Asset Management Actions
// ==========================================

export async function updateAssetJson(id: string, data: Partial<Asset>) {
    try {
        await AssetService.updateAsset(id, data);
        revalidatePath('/assets');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to update asset:', error);
        return { success: false, error: 'Failed to update asset' };
    }
}

export async function deleteAssetAction(id: string) {
    try {
        await AssetService.deleteAsset(id);
        revalidatePath('/assets');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete asset:', error);
        return { success: false, error: 'Failed to delete asset' };
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addAssetAction(data: Record<string, unknown>) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await AssetService.addAsset(data as any);
        revalidatePath('/assets');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to add asset:', error);
        return { success: false, error: 'Failed to add asset' };
    }
}

// ==========================================
// Transaction Management Actions
// ==========================================

export async function getTransactions() {
    try {
        return await TransactionService.getTransactions();
    } catch (error) {
        console.error('Failed to fetch transactions:', error);
        return [];
    }
}

export async function getRecentTransactions(limit: number = 5) {
    try {
        return await TransactionService.getRecentTransactions(limit);
    } catch (error) {
        console.error('Failed to fetch recent transactions:', error);
        return [];
    }
}


export async function addTransactionAction(formData: FormData) {
    try {
        const rawData = parseTransactionFormData(formData);

        // Validate with Zod schema
        const result = TransactionSchema.safeParse(rawData);
        if (!result.success) {
            const errorMessage = result.error.issues.map(i => i.message).join(', ');
            return { success: false, error: errorMessage };
        }

        await TransactionService.createTransaction(result.data);

        revalidatePath('/transactions');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to add transaction:', error);
        return { success: false, error: 'Failed to add transaction' };
    }
}

export async function updateTransactionAction(id: string, formData: FormData) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: Record<string, unknown> = {};
        if (formData.has('date')) data.date = formData.get('date') as string;
        if (formData.has('amount')) data.amount = Number(formData.get('amount'));
        if (formData.has('type')) data.type = formData.get('type') as string;
        if (formData.has('category')) data.category = formData.get('category') as string;
        if (formData.has('description')) data.description = formData.get('description') as string;
        if (formData.has('assetId')) data.assetId = formData.get('assetId') as string;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await TransactionService.updateTransaction(id, data as any);

        revalidatePath('/transactions');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to update transaction:', error);
        return { success: false, error: 'Failed to update transaction' };
    }
}

export async function deleteTransactionAction(id: string) {
    try {
        await TransactionService.deleteTransaction(id);
        revalidatePath('/transactions');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete transaction:', error);
        return { success: false, error: 'Failed to delete transaction' };
    }
}

export async function getMonthlyTransactionSummary(year: number, month: number) {
    try {
        return await TransactionService.getMonthlyTransactionSummary(year, month);
    } catch (error) {
        console.error('Failed to get monthly summary:', error);
        return { income: 0, expense: 0, balance: 0 };
    }
}

export async function saveTransactionsToServer(transactions: Transaction[]): Promise<void> {
    for (const t of transactions) {
        await TransactionService.createTransaction({
            date: t.date,
            amount: t.amount,
            type: t.type,
            category: t.category,
            description: t.description,
            assetId: t.assetId,
        });
    }
    revalidatePath('/transactions');
}

// ==========================================
// Legacy Exports for Backward Compatibility
// ==========================================

export async function getAsset(id: string) {
    return await AssetService.getAsset(id);
}

export async function updateAsset(formData: FormData) {
    const id = formData.get('id') as string;
    if (!id) throw new Error('Asset ID is required');

    const data: Partial<Asset> = {};
    if (formData.has('name')) data.name = formData.get('name') as string;
    if (formData.has('ticker')) {
        let ticker = formData.get('ticker') as string;
        // Auto-append .T suffix for Japanese stock codes (4-digit numbers)
        if (/^\d{4}$/.test(ticker)) {
            ticker = ticker + '.T';
        }
        data.ticker = ticker;
    }
    if (formData.has('quantity')) data.quantity = Number(formData.get('quantity'));
    if (formData.has('avgCost')) data.avgCost = Number(formData.get('avgCost'));

    await AssetService.updateAsset(id, data);
    revalidatePath('/assets');
    revalidatePath('/');
    redirect('/assets');
}

export async function deleteAsset(id: string) {
    await AssetService.deleteAsset(id);
    revalidatePath('/assets');
    revalidatePath('/');
}

export async function getStockName(ticker: string) {
    return await AssetService.getStockName(ticker);
}

export async function getPortfolio() {
    return await AssetService.getPortfolio();
}

export async function updateAllAssetPrices() {
    const result = await AssetService.updateAllAssetPrices();
    revalidatePath('/');
    revalidatePath('/assets');
    return result;
}

export async function getPortfolioWithPrices() {
    return await AssetService.getPortfolioWithPrices();
}

export async function getHistory() {
    return await SystemService.getHistory();
}

export async function detectMissingDividends() {
    return await TransactionService.detectMissingDividends();
}

export async function registerDividends(dividends: Transaction[]) {
    await TransactionService.registerDividends(dividends);
    revalidatePath('/');
    revalidatePath('/dividends');
    revalidatePath('/transactions');
}



export async function resetAllData() {
    await SystemService.resetAllData();
    revalidatePath('/');
    revalidatePath('/assets');
    revalidatePath('/transactions');
    revalidatePath('/dividends');
    revalidatePath('/history');
    revalidatePath('/settings');
}

export async function getDividends() {
    return await DividendService.getDividends();
}

export async function addDividend(formData: FormData) {
    try {
        const rawData = parseDividendFormData(formData);

        // Validate with Zod schema
        const result = DividendSchema.safeParse(rawData);
        if (!result.success) {
            const errorMessage = result.error.issues.map(i => i.message).join(', ');
            return { success: false, error: errorMessage };
        }

        await DividendService.addDividend(result.data);
        revalidatePath('/dividends');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to add dividend:', error);
        return { success: false, error: 'Failed to add dividend' };
    }
}

export async function updateDividend(id: string, formData: FormData) {
    try {
        const date = formData.get('date') as string;
        const amount = Number(formData.get('amount'));

        // Currently only date and amount are editable for existing dividends
        // Currency is fixed to JPY for now based on recent changes, but we keep the logic flexible if needed

        await DividendService.updateDividend(id, {
            date,
            amount,
        });
        revalidatePath('/dividends');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to update dividend:', error);
        return { success: false, error: 'Failed to update dividend' };
    }
}

export async function deleteDividend(id: string) {
    try {
        await DividendService.deleteDividend(id);
        revalidatePath('/dividends');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete dividend:', error);
        return { success: false, error: 'Failed to delete dividend' };
    }
}

export async function addDividendsBulk(dividends: Array<{
    assetId: string;
    date: string;
    amount: number;
    currency: 'JPY' | 'USD';
}>) {
    try {
        await DividendService.addDividendsBulk(dividends);
        revalidatePath('/dividends');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Failed to add dividends:', error);
        return { success: false, error: 'Failed to add dividends' };
    }
}

export async function getAnalysisLogs() {
    return await SystemService.getAnalysisLogs();
}

export async function saveAnalysisLog(log: Omit<AnalysisLog, 'id'>) {
    const newLog = await SystemService.saveAnalysisLog(log);
    revalidatePath('/');
    return newLog;
}

export async function getAssetHistory(days: number = 30) {
    return await AnalyticsService.getAssetHistory(days);
}

export async function getAssetAllocation() {
    return await AnalyticsService.getAssetAllocation();
}

export async function getLatestAnalysis() {
    return await AnalyticsService.getLatestAnalysis();
}

export async function recordDailyHistory(force: boolean = false) {
    try {
        await AnalyticsService.recordDailyHistory(force);
        // revalidatePath('/') is not allowed during render
        return { success: true };
    } catch (error) {
        console.error('Failed to record daily history:', error);
        return { success: false, error: 'Failed to record daily history' };
    }
}

// --- Category Rules ---

export async function getCategoryRules() {
    try {
        return await prisma.categoryRule.findMany({
            orderBy: { pattern: 'asc' }
        });
    } catch (error) {
        console.error("Failed to fetch category rules:", error);
        return [];
    }
}

export async function addCategoryRule(pattern: string, category: string) {
    try {
        // 重複チェックは upsert で対応
        const rule = await prisma.categoryRule.upsert({
            where: { pattern },
            update: { category },
            create: { pattern, category },
        });
        revalidatePath('/settings'); // 設定画面などで使用する場合を想定
        return { success: true, data: rule };
    } catch (error) {
        console.error("Failed to add rule:", error);
        return { success: false, error: "ルールの追加に失敗しました" };
    }
}

export async function deleteCategoryRule(id: string) {
    try {
        await prisma.categoryRule.delete({ where: { id } });
        revalidatePath('/settings');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete rule:", error);
        return { success: false, error: "ルールの削除に失敗しました" };
    }
}

export async function updateCategoryRule(id: string, pattern: string, category: string) {
    try {
        const rule = await prisma.categoryRule.update({
            where: { id },
            data: { pattern, category },
        });
        revalidatePath('/settings');
        return { success: true, data: rule };
    } catch (error) {
        console.error("Failed to update rule:", error);
        return { success: false, error: "ルールの更新に失敗しました" };
    }
}

export async function getUniqueCategories() {
    try {
        const categories = await prisma.transaction.groupBy({
            by: ['category'],
            orderBy: {
                category: 'asc',
            },
        });
        return categories.map(c => c.category).filter(Boolean);
    } catch (error) {
        console.error("Failed to fetch unique categories:", error);
        return [];
    }
}

import fs from 'fs/promises';
import _path from 'path';

export async function fetchLatestAnalysisAction() {
    return await AnalyticsService.getLatestAnalysis();
}

export async function triggerAnalysisAction() {
    try {
        // 1. Get current portfolio
        const { portfolio } = await AssetService.getPortfolioWithPrices();

        // 2. Save to JSON file for market-watcher
        // Docker volume mount path: /app/apps/money-master/data/portfolio.json
        const dataDir = _path.join(process.cwd(), 'data');
        const filePath = _path.join(dataDir, 'portfolio.json');

        // Ensure directory exists
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
        }

        await fs.writeFile(filePath, JSON.stringify(portfolio, null, 2), 'utf-8');

        // 3. Call market-watcher API
        // Service name in docker-compose is 'market-watcher', internal port 8000
        const response = await fetch('http://market-watcher:8000/analyze/daily', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Market Watcher API failed: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        console.log("DEBUG: Market Watcher Response:", JSON.stringify(result, null, 2));

        // 4. Save result to DB (market-watcher might not save it to DB directly? 
        // Based on previous code, market-watcher returns the result. 
        // We should save it if market-watcher doesn't. 
        // But wait, market-watcher likely saves it or money-master should.
        // Let's check analytics.service.ts or system.service.ts if there is a save function.
        // actions.ts has saveAnalysisLog.

        if (result && !result.error) {
            await SystemService.saveAnalysisLog({
                date: new Date().toISOString(),
                title: result.title || "Market Analysis",
                summary: result.summary || "",
                script: result.script || "",
                sources: result.sources || []
            });
        }

        revalidatePath('/');
        return { success: true, data: result };
    } catch (error) {
        console.error('Failed to trigger analysis:', error);
        return { success: false, error: String(error) };
    }
}
