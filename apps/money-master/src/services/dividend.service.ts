import { prisma } from "@/lib/prisma";
import { Dividend } from "@/types";
import { Calculator } from "@/lib/calculator";

export async function getDividends(): Promise<(Dividend & { asset: { name: string; ticker: string | null } })[]> {
    const dividends = await prisma.dividend.findMany({
        orderBy: { date: 'desc' },
        include: {
            asset: {
                select: {
                    name: true,
                    ticker: true,
                }
            }
        }
    });

    return dividends.map(d => ({
        ...d,
        // Fix: Convert Decimal to number for UI compatibility
        amount: Calculator.toNumber(d.amount),
        currency: d.currency as 'JPY' | 'USD',
    }));
}

export async function addDividend(dividend: Omit<Dividend, 'id'>) {
    return await prisma.dividend.create({
        data: {
            assetId: dividend.assetId,
            date: dividend.date,
            amount: dividend.amount,
            currency: dividend.currency,
        },
    });
}

export async function deleteDividend(id: string) {
    return await prisma.dividend.delete({
        where: { id },
    });
}

export async function updateDividend(id: string, data: Partial<Dividend>) {
    return await prisma.dividend.update({
        where: { id },
        data: {
            date: data.date,
            amount: data.amount,
        },
    });
}

export async function addDividendsBulk(dividends: Omit<Dividend, 'id'>[]) {
    const results = await prisma.dividend.createMany({
        data: dividends.map(d => ({
            assetId: d.assetId,
            date: d.date,
            amount: d.amount,
            currency: d.currency,
        })),
    });
    return results;
}

/**
 * 配当履歴から配当頻度を推定する
 * @param assetId 資産ID
 * @returns 推定された配当頻度（monthly, quarterly, semiannual, annual）またはnull
 */
export async function inferDividendFrequency(
    assetId: string
): Promise<'monthly' | 'quarterly' | 'semiannual' | 'annual' | null> {
    // 過去2年分の配当履歴を取得
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const cutoffDate = twoYearsAgo.toISOString().split('T')[0];

    const dividends = await prisma.dividend.findMany({
        where: {
            assetId,
            date: { gte: cutoffDate },
        },
        orderBy: { date: 'asc' },
        select: { date: true },
    });

    if (dividends.length < 2) {
        // 配当履歴が2件未満なら判定できない
        return null;
    }

    // 配当月を抽出（重複を除去）
    const months = new Set<string>();
    for (const d of dividends) {
        const month = d.date.substring(0, 7); // YYYY-MM
        months.add(month);
    }

    const uniqueMonths = Array.from(months).sort();
    if (uniqueMonths.length < 2) {
        return null;
    }

    // 配当月間の間隔を計算
    const intervals: number[] = [];
    for (let i = 1; i < uniqueMonths.length; i++) {
        const [y1, m1] = uniqueMonths[i - 1].split('-').map(Number);
        const [y2, m2] = uniqueMonths[i].split('-').map(Number);
        const monthDiff = (y2 - y1) * 12 + (m2 - m1);
        intervals.push(monthDiff);
    }

    // 平均間隔を計算
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // 頻度を推定
    if (avgInterval <= 1.5) {
        return 'monthly';
    } else if (avgInterval <= 4.5) {
        return 'quarterly';
    } else if (avgInterval <= 9) {
        return 'semiannual';
    } else {
        return 'annual';
    }
}

