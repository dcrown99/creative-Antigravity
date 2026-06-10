import yahooFinance from "yahoo-finance2";
import { withRetry } from "@/lib/rate-limiter";
import { getCachedPrice, setCachedPrice } from "@/lib/stock-price-cache";

export interface StockInfo {
    symbol: string;
    name: string;
    price: number;
    currency: string;
    dividendRate?: number;
    dividendYield?: number;
    nextDividendDate?: string | null;
    success: boolean;
    error?: string;
}

export async function getStockInfo(symbol: string): Promise<StockInfo> {
    if (!symbol) {
        return { symbol: "", name: "", price: 0, currency: "JPY", success: false, error: "Symbol is required" };
    }

    // Check cache first to reduce API calls
    const cached = getCachedPrice(symbol);
    if (cached) {
        return {
            symbol,
            name: symbol,
            price: cached.price,
            currency: cached.currency,
            dividendRate: cached.dividendRate,
            dividendYield: cached.dividendYield,
            nextDividendDate: cached.nextDividendDate,
            success: true
        };
    }

    try {
        // Special mapping for known problematic funds
        const symbolMapping: Record<string, string> = {
            '97311233': '4731B233', // Old: PayPay US Stock Index -> New: AM One Index Open US Stock
        };

        const fetchSymbol = symbolMapping[symbol] || symbol;

        // Check if it's a Japanese Investment Trust (Mutual Fund)
        const isInvestmentTrust = /^[0-9A-Z]{8}$/.test(fetchSymbol);

        if (isInvestmentTrust) {
            // 1. Try Minkabu first
            const minkabuUrl = `https://itf.minkabu.jp/fund/${fetchSymbol}`;
            const resMinkabu = await fetch(minkabuUrl);

            if (resMinkabu.ok) {
                const html = await resMinkabu.text();
                let match = html.match(/>([0-9]{1,3}(,[0-9]{3})+)円?<\/span>/);
                if (!match) {
                    match = html.match(/<span class="text-4xl font-bold">([0-9,]+)<\/span>/);
                }

                if (match) {
                    const price = parseFloat(match[1].replace(/,/g, ''));
                    setCachedPrice(symbol, { price, currency: 'JPY' });
                    return { symbol, name: symbol, price, currency: 'JPY', success: true };
                }
            }

            // 2. Fallback to Yahoo Finance JP
            console.warn(`Minkabu failed for ${symbol}, trying Yahoo Finance JP...`);
            const yahooUrl = `https://finance.yahoo.co.jp/quote/${symbol}`;
            const resYahoo = await fetch(yahooUrl);

            if (!resYahoo.ok) {
                throw new Error(`Failed to fetch from both Minkabu (${resMinkabu.status}) and Yahoo (${resYahoo.status})`);
            }

            const html = await resYahoo.text();
            const labelIndex = html.indexOf('基準価額');
            let price = 0;

            if (labelIndex !== -1) {
                const snippet = html.substring(labelIndex, labelIndex + 3000);
                const match = snippet.match(/>([0-9]{1,3}(,[0-9]{3})*(\.[0-9]+)?)(\s*円)?</);
                if (match) {
                    price = parseFloat(match[1].replace(/,/g, ''));
                }
            }

            if (!price) {
                const fallbackMatch = html.match(/<span class="_3rXWJKZF">([0-9,]+)<\/span>/);
                if (fallbackMatch) {
                    price = parseFloat(fallbackMatch[1].replace(/,/g, ''));
                }
            }

            if (!price) {
                throw new Error("Could not parse price from HTML (Minkabu & Yahoo)");
            }

            setCachedPrice(symbol, { price, currency: 'JPY' });
            return {
                symbol,
                name: symbol,
                price,
                currency: 'JPY',
                success: true
            };
        }

        // For other symbols, use yahoo-finance2
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const yf = typeof yahooFinance === 'function' ? new (yahooFinance as any)() : yahooFinance;

        // Auto-append .T suffix for Japanese stock codes (4-digit numbers without suffix)
        let querySymbol = fetchSymbol;
        if (/^\d{4}$/.test(fetchSymbol)) {
            querySymbol = fetchSymbol + '.T';
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await withRetry(() => yf.quoteSummary(querySymbol, {
            modules: ['price', 'summaryDetail', 'calendarEvents']
        })) as any;

        const price = result?.price;
        const summaryDetail = result?.summaryDetail;
        const calendarEvents = result?.calendarEvents;

        if (!price) {
            throw new Error("No price data returned");
        }

        const dividendData = {
            dividendRate: summaryDetail?.trailingAnnualDividendRate || summaryDetail?.dividendRate || null,
            dividendYield: summaryDetail?.trailingAnnualDividendYield || summaryDetail?.dividendYield || null,
            exDividendDate: calendarEvents?.exDividendDate || summaryDetail?.exDividendDate || null,
        };

        const stockResult = {
            symbol: price.symbol || symbol,
            name: price.longName || price.shortName || symbol,
            price: price.regularMarketPrice || 0,
            currency: price.currency || 'JPY',
            dividendRate: dividendData.dividendRate,
            dividendYield: dividendData.dividendYield,
            nextDividendDate: dividendData.exDividendDate ? new Date(dividendData.exDividendDate).toISOString().split('T')[0] : null,
            success: true
        };

        // Cache the result for future requests
        setCachedPrice(symbol, {
            price: stockResult.price,
            currency: stockResult.currency,
            dividendRate: stockResult.dividendRate,
            dividendYield: stockResult.dividendYield,
            nextDividendDate: stockResult.nextDividendDate ?? undefined,
        });

        return stockResult;

    } catch (error) {
        console.error(`Stock price fetch error for ${symbol}:`, error);
        return {
            symbol,
            name: symbol,
            price: 0,
            currency: 'JPY',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
