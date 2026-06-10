import { prisma } from "@/lib/prisma";
import { Asset, Portfolio } from "@/types";
import { priceCache } from "@/lib/stock-price-cache";
import { getStockInfo } from "@/services/stock.service";
import { delay } from "@/lib/rate-limiter";
import { unstable_cache, revalidateTag } from "next/cache";
import { Calculator } from "@/lib/calculator";
import { inferDividendFrequency } from "@/services/dividend.service";

const CACHE_TAG_ASSETS = 'assets';
const CACHE_TAG_PORTFOLIO = 'portfolio';

const ASSET_SELECT = {
  id: true,
  ticker: true,
  name: true,
  type: true,
  account: true,
  quantity: true,
  avgCost: true,
  currency: true,
  currentPrice: true,
  dividendRate: true,
  dividendYield: true,
  nextDividendDate: true,
  dividendFrequency: true,
  sector: true,
  manualPrice: true,
  balance: true,
  createdAt: true,
  updatedAt: true,
  isArchived: true,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPrismaAssetToAsset(prismaAsset: any): Asset {
  return {
    ...prismaAsset,
    ticker: prismaAsset.ticker ?? undefined,
    account: prismaAsset.account ?? undefined,
    // Fix: Convert Decimal to number for UI compatibility using Calculator
    quantity: Calculator.toNumber(prismaAsset.quantity),
    avgCost: Calculator.toNumber(prismaAsset.avgCost),
    currentPrice: Calculator.toNumber(prismaAsset.currentPrice),
    dividendRate: Calculator.toNumber(prismaAsset.dividendRate),
    dividendYield: Calculator.toNumber(prismaAsset.dividendYield),
    nextDividendDate: prismaAsset.nextDividendDate ?? undefined,
    dividendFrequency: prismaAsset.dividendFrequency ?? undefined,
    sector: prismaAsset.sector ?? undefined,
    manualPrice: Calculator.toNumber(prismaAsset.manualPrice),
    balance: Calculator.toNumber(prismaAsset.balance),
    description: prismaAsset.description ?? undefined,
    createdAt: prismaAsset.createdAt ? new Date(prismaAsset.createdAt).getTime() : undefined,
    updatedAt: prismaAsset.updatedAt ? new Date(prismaAsset.updatedAt).getTime() : undefined,
  } as Asset;
}

export const getAssets = unstable_cache(
  async (): Promise<Asset[]> => {
    const assets = await prisma.asset.findMany({
      select: ASSET_SELECT,
      orderBy: { createdAt: "desc" },
    });
    return assets.map(mapPrismaAssetToAsset);
  },
  ['getAssets'],
  { tags: [CACHE_TAG_ASSETS] }
);

export const getPortfolio = unstable_cache(
  async (): Promise<Portfolio> => {
    const assets = await prisma.asset.findMany({
      where: { isArchived: false },
      select: ASSET_SELECT,
      orderBy: { createdAt: "desc" },
    });
    // Dividends are fetched separately or empty here as per original
    return { assets: assets.map(mapPrismaAssetToAsset), dividends: [] };
  },
  ['getPortfolio'],
  { tags: [CACHE_TAG_PORTFOLIO] }
);

export async function getAsset(id: string) {
  const asset = await prisma.asset.findUnique({
    where: { id },
  });
  return asset ? mapPrismaAssetToAsset(asset) : null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAssetToPrismaInput(assetData: Partial<Asset>): any {
  const { createdAt, updatedAt, ...rest } = assetData;
  return {
    ...rest,
    ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
    ...(updatedAt ? { updatedAt: new Date(updatedAt) } : {}),
  };
}

// Helper to safely revalidate tags without crashing in background jobs (e.g. cron)
function safeRevalidateTag(tag: string) {
  try {
    revalidateTag(tag);
  } catch (error) {
    // Check if error is due to missing static generation store (expected in cron)
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('static generation store missing')) {
      console.warn(`[AssetService] Skipped revalidation for tag '${tag}' (background context)`);
    } else {
      console.error(`[AssetService] Unexpected error revalidating tag '${tag}':`, error);
    }
  }
}

export async function addAsset(data: Omit<Asset, "id" | "createdAt" | "updatedAt">) {
  const result = await prisma.asset.create({ data: mapAssetToPrismaInput(data) });
  safeRevalidateTag(CACHE_TAG_ASSETS);
  safeRevalidateTag(CACHE_TAG_PORTFOLIO);
  return result;
}

export async function updateAsset(id: string, data: Partial<Asset>) {
  const result = await prisma.asset.update({
    where: { id },
    data: mapAssetToPrismaInput(data),
  });
  safeRevalidateTag(CACHE_TAG_ASSETS);
  safeRevalidateTag(CACHE_TAG_PORTFOLIO);
  return result;
}

export async function deleteAsset(id: string) {
  // Cascade delete related records to avoid FK constraint violations
  // 1. Delete all dividends referencing this asset
  await prisma.dividend.deleteMany({
    where: { assetId: id },
  });

  // 2. Nullify assetId in transactions (since it's nullable)
  await prisma.transaction.updateMany({
    where: { assetId: id },
    data: { assetId: null },
  });

  // 3. Now delete the asset itself
  const result = await prisma.asset.delete({
    where: { id },
  });
  safeRevalidateTag(CACHE_TAG_ASSETS);
  safeRevalidateTag(CACHE_TAG_PORTFOLIO);
  return result;
}

export async function unarchiveAsset(id: string) {
  const result = await prisma.asset.update({
    where: { id },
    data: { isArchived: false },
  });
  safeRevalidateTag(CACHE_TAG_ASSETS);
  safeRevalidateTag(CACHE_TAG_PORTFOLIO);
  return result;
}

export async function getStockName(ticker: string): Promise<string | null> {
  return ticker;
}

const CACHE_TAG_USDJPY = 'usdjpy';

export const getUsdJpyRate = unstable_cache(
  async (): Promise<number> => {
    try {
      const data = await getStockInfo('USDJPY=X');
      if (data.success && data.price > 0) {
        return data.price;
      }
      return 150.0;
    } catch (error) {
      console.error('Error fetching USD/JPY rate:', error);
      return 150.0;
    }
  },
  ['getUsdJpyRate'],
  {
    tags: [CACHE_TAG_USDJPY],
    revalidate: 3600
  }
);

export async function getPortfolioWithPrices(): Promise<{ portfolio: Portfolio, usdJpy: number }> {
  const portfolio = await getPortfolio();
  const usdJpy = await getUsdJpyRate();
  return { portfolio, usdJpy };
}

export async function overrideAllAssets(assets: Asset[]): Promise<void> {
  await prisma.asset.deleteMany({});
  // Prisma handles number -> Decimal conversion on create/createMany
  await prisma.asset.createMany({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    data: assets.map(({ id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...asset }) => asset),
  });
  safeRevalidateTag(CACHE_TAG_ASSETS);
  safeRevalidateTag(CACHE_TAG_PORTFOLIO);
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      // Add delay between requests to prevent Yahoo Finance rate limiting
      if (i > 0) await delay(500);
      try {
        const value = await tasks[i]();
        results[i] = { status: 'fulfilled', value };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Array(Math.min(concurrency, tasks.length)).fill(null).map(worker);
  await Promise.all(workers);
  return results;
}

async function updateSingleAssetPrice(asset: Asset): Promise<boolean> {
  if (!asset.ticker) return false;

  // 手動価格が設定されている場合は自動更新をスキップ
  if (asset.manualPrice && asset.manualPrice > 0) {
    return true;
  }

  try {
    // getStockInfo now handles caching internally
    const priceData = await getStockInfo(asset.ticker);

    if (priceData.success && priceData.price > 0) {
      // 配当頻度が未設定の場合、配当履歴から自動判定
      let inferredFrequency: string | undefined;
      if (!asset.dividendFrequency && asset.dividendRate) {
        const frequency = await inferDividendFrequency(asset.id);
        if (frequency) {
          inferredFrequency = frequency;
          console.log(`Inferred dividend frequency for ${asset.ticker}: ${frequency}`);
        }
      }

      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          currentPrice: priceData.price,
          dividendRate: priceData.dividendRate !== undefined && priceData.dividendRate !== null ? priceData.dividendRate : asset.dividendRate,
          dividendYield: priceData.dividendYield !== undefined && priceData.dividendYield !== null ? priceData.dividendYield : asset.dividendYield,
          nextDividendDate: priceData.nextDividendDate || asset.nextDividendDate,
          ...(inferredFrequency && { dividendFrequency: inferredFrequency }),
        },
      });
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error(`Error updating price for ${asset.ticker}:`, error);
    const expiredCache = priceCache.get(asset.ticker);
    if (expiredCache) {
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          currentPrice: expiredCache.price,
          dividendRate: expiredCache.dividendRate ?? asset.dividendRate,
          dividendYield: expiredCache.dividendYield ?? asset.dividendYield,
          nextDividendDate: expiredCache.nextDividendDate ?? asset.nextDividendDate,
        },
      });
      return true;
    }
    throw error;
  }
}

export async function updateAllAssetPrices(): Promise<{ updated: number; failed: number }> {
  const assets = await prisma.asset.findMany({
    where: {
      ticker: { not: null },
      isArchived: false,
    },
  });

  const tasks = assets.map((prismaAsset) => () => updateSingleAssetPrice(mapPrismaAssetToAsset(prismaAsset)));
  const CONCURRENCY_LIMIT = 5;
  const results = await runWithConcurrency(tasks, CONCURRENCY_LIMIT);

  let updated = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value) updated++;
      else failed++;
    } else {
      failed++;
    }
  }

  if (updated > 0) {
    safeRevalidateTag(CACHE_TAG_ASSETS);
    safeRevalidateTag(CACHE_TAG_PORTFOLIO);
  }

  return { updated, failed };
}
