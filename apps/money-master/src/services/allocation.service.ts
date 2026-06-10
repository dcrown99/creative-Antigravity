import { prisma } from '@/lib/prisma';

// デフォルトの目標配分（DBにデータがない場合のフォールバック）
const DEFAULT_TARGETS: Record<string, number> = {
    'JP_STOCK': 20,
    'US_STOCK': 20,
    'TRUST': 30,
    'ETF': 15,
    'BANK': 10,
    'CASH': 5,
};

/**
 * 全目標配分を取得
 * DBにデータがない場合はデフォルト値を返す
 */
export async function getAllocationTargets(): Promise<Record<string, number>> {
    const targets = await prisma.allocationTarget.findMany();

    if (targets.length === 0) {
        return { ...DEFAULT_TARGETS };
    }

    return Object.fromEntries(
        targets.map((t: { assetType: string; targetPercent: number }) => [t.assetType, t.targetPercent])
    );
}

/**
 * 目標配分を一括保存（upsert）
 */
export async function saveAllocationTargets(targets: Record<string, number>): Promise<void> {
    // トランザクションで一括更新
    await prisma.$transaction(
        Object.entries(targets).map(([assetType, targetPercent]) =>
            prisma.allocationTarget.upsert({
                where: { assetType },
                update: { targetPercent },
                create: { assetType, targetPercent },
            })
        )
    );
}

/**
 * デフォルト目標配分を取得
 */
export function getDefaultTargets(): Record<string, number> {
    return { ...DEFAULT_TARGETS };
}
