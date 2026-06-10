import { Asset, AnalysisLog } from "@/types";
import * as AssetService from "./asset.service";
import { prisma } from "@/lib/prisma";
import { Calculator } from "@/lib/calculator";
import { Decimal } from "@prisma/client/runtime/library";

export async function getLatestAnalysis(): Promise<AnalysisLog | null> {
    try {
        const log = await prisma.analysisLog.findFirst({
            orderBy: { date: 'desc' },
        });

        if (!log) return null;

        let parsedSources = [];
        if (typeof log.sources === 'string') {
            try {
                parsedSources = JSON.parse(log.sources);
            } catch (e) {
                console.warn("Failed to parse analysis sources", e);
                parsedSources = [];
            }
        } else {
            parsedSources = log.sources ?? [];
        }

        return {
            ...log,
            sources: parsedSources
        } as AnalysisLog;
    } catch (error) {
        console.error("Failed to fetch analysis log:", error);
        return null;
    }
}

export interface HistoryEntry {
    date: string;
    totalValue: number;
    totalCost?: number;
    totalPL?: number;
    data?: {
        byType: Record<string, number>;
    };
}

export interface AllocationItem {
    name: string;
    value: number;
    percentage: number;
}

export interface AllocationData {
    byType: AllocationItem[];
    byCurrency: AllocationItem[];
    byAccount: AllocationItem[];
}

export async function recordDailyHistory(force: boolean = false): Promise<void> {
    try {
        const today = new Date().toISOString().split('T')[0];

        if (!force) {
            const existingEntry = await prisma.historyEntry.findUnique({
                where: { date: today },
            });

            if (existingEntry) {
                console.log(`History for ${today} already exists. Skipping recordDailyHistory.`);
                return;
            }
        }

        const { portfolio, usdJpy } = await AssetService.getPortfolioWithPrices();
        // Calculate utilizing Decimal precision internally
        const { totalValue, totalCost } = calculatePortfolioMetrics(portfolio.assets, usdJpy);
        const totalPL = totalValue - totalCost;

        const byType = groupAndSum(portfolio.assets, 'type', usdJpy, totalValue);
        const byTypeMap = byType.reduce((acc, item) => {
            acc[item.name] = item.value;
            return acc;
        }, {} as Record<string, number>);

        const data = JSON.stringify({ byType: byTypeMap });

        await prisma.historyEntry.upsert({
            where: { date: today },
            update: {
                totalValue,
                totalCost,
                totalPL,
                data,
            },
            create: {
                date: today,
                totalValue,
                totalCost,
                totalPL,
                data,
            },
        });

        console.log(`Recorded history for ${today}: Value=${totalValue}, Cost=${totalCost}`);
    } catch (error) {
        console.error("Failed to record daily history:", error);
    }
}

export async function getAssetHistory(days: number = 30): Promise<HistoryEntry[]> {
    try {
        // Calculate the start date based on the requested days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];

        const history = await prisma.historyEntry.findMany({
            where: {
                date: {
                    gte: startDateStr,
                },
            },
            orderBy: { date: 'asc' },
        });

        if (history.length === 0) {
            await recordDailyHistory();
            const newHistory = await prisma.historyEntry.findMany({
                where: {
                    date: {
                        gte: startDateStr,
                    },
                },
                orderBy: { date: 'asc' },
            });
            return parseHistoryEntries(newHistory);
        }

        return parseHistoryEntries(history);

    } catch (error) {
        console.error("Failed to get asset history:", error);
        return [];
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseHistoryEntries(entries: any[]): HistoryEntry[] {
    return entries.map(entry => {
        let data = undefined;
        if (entry.data) {
            try {
                data = JSON.parse(entry.data);
            } catch (e) {
                console.warn(`Failed to parse history data for ${entry.date}`, e);
            }
        }
        return {
            date: entry.date,
            // Decimal to number
            totalValue: Calculator.toNumber(entry.totalValue),
            totalCost: Calculator.toNumber(entry.totalCost),
            totalPL: Calculator.toNumber(entry.totalPL),
            data
        };
    });
}

export async function getAssetAllocation(): Promise<AllocationData> {
    const { portfolio, usdJpy } = await AssetService.getPortfolioWithPrices();
    const assets = portfolio.assets;
    const { totalValue } = calculatePortfolioMetrics(assets, usdJpy);

    if (totalValue === 0) {
        return { byType: [], byCurrency: [], byAccount: [] };
    }

    const byType = groupAndSum(assets, 'type', usdJpy, totalValue);
    const byCurrency = groupAndSum(assets, 'currency', usdJpy, totalValue);
    const byAccount = groupAndSum(assets, 'account', usdJpy, totalValue);

    return { byType, byCurrency, byAccount };
}

// Critical: Logic updated to use Calculator (Decimal) for precision
function calculatePortfolioMetrics(assets: Asset[], usdJpy: number): { totalValue: number, totalCost: number } {
    // Accumulators as Decimals
    let accValue = new Decimal(0);
    let accCost = new Decimal(0);

    for (const asset of assets) {
        // Safe conversion to Decimal from possible number/null
        const price = Calculator.toDecimal(asset.currentPrice || asset.manualPrice || asset.avgCost || 0);
        const quantity = Calculator.toDecimal(asset.quantity || 0);
        const avgCost = Calculator.toDecimal(asset.avgCost || 0);

        let value: Decimal;

        if (asset.type === 'bank' || asset.type === 'cash') {
            value = Calculator.toDecimal(asset.balance || 0);
        } else if (asset.type === 'TRUST') {
            // value = (price * quantity) / 10000
            value = price.times(quantity).div(10000);
        } else {
            // value = price * quantity
            value = price.times(quantity);
        }

        let cost = new Decimal(0);
        if (asset.type !== 'bank' && asset.type !== 'cash' && !avgCost.isZero()) {
            // actualQuantity = type === 'TRUST' ? quantity / 10000 : quantity
            const actualQuantity = asset.type === 'TRUST' ? quantity.div(10000) : quantity;
            cost = avgCost.times(actualQuantity);
        } else if (asset.type === 'bank' || asset.type === 'cash') {
            cost = value;
        }

        // Currency conversion
        if (asset.currency === 'USD') {
            const rate = Calculator.toDecimal(usdJpy);
            value = value.times(rate);
            cost = cost.times(rate);
        }

        accValue = accValue.plus(value);
        accCost = accCost.plus(cost);
    }

    return {
        totalValue: Calculator.toNumber(accValue),
        totalCost: Calculator.toNumber(accCost)
    };
}

function groupAndSum(
    assets: Asset[],
    key: keyof Asset,
    usdJpy: number,
    totalValue: number
): AllocationItem[] {
    const groups: Record<string, Decimal> = {};

    assets.forEach(asset => {
        let groupKey = String(asset[key] || 'Unknown');

        if (key === 'account' && (groupKey === 'Unknown' || groupKey === 'null') && (asset.type === 'cash' || asset.type === 'bank')) {
            groupKey = 'bank';
        }

        // Calculation logic duplicated here must also use Decimal
        const price = Calculator.toDecimal(asset.currentPrice || asset.manualPrice || 0);
        const quantity = Calculator.toDecimal(asset.quantity || 0);
        let value = price.times(quantity);

        if ((asset.type === 'bank' || asset.type === 'cash') && asset.balance) {
            value = Calculator.toDecimal(asset.balance);
        }

        if (asset.type === 'TRUST') {
            value = value.div(10000);
        }

        if (asset.currency === 'USD') {
            value = value.times(usdJpy);
        }

        if (!groups[groupKey]) {
            groups[groupKey] = new Decimal(0);
        }
        groups[groupKey] = groups[groupKey].plus(value);
    });

    return Object.entries(groups)
        .map(([name, decimalValue]) => {
            const value = Calculator.toNumber(decimalValue);
            return {
                name,
                value: Math.round(value),
                percentage: totalValue === 0 ? 0 : parseFloat(((value / totalValue) * 100).toFixed(1)),
            };
        })
        .sort((a, b) => b.value - a.value);
}
