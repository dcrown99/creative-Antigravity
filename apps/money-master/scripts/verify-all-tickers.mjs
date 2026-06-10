import { PrismaClient } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const prisma = new PrismaClient();

async function main() {
    const assets = await prisma.asset.findMany({
        where: {
            isArchived: false,
            ticker: { not: null }
        },
        select: { id: true, name: true, ticker: true, type: true, currentPrice: true }
    });

    console.log('=== 全銘柄ティッカー検証 ===\n');

    const errors = [];
    const warnings = [];

    for (const asset of assets) {
        if (!asset.ticker) continue;

        // Skip investment trusts (they use different ticker format)
        if (asset.type === 'TRUST') {
            console.log(`⏭️ ${asset.name} (${asset.ticker}) - 投資信託、スキップ`);
            continue;
        }

        try {
            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));

            const quote = await yahooFinance.quote(asset.ticker);
            const yahooName = quote.shortName || quote.longName || 'Unknown';

            // Check if names roughly match
            const dbName = asset.name.toLowerCase();
            const yName = yahooName.toLowerCase();

            // Simple check: if first word matches or ticker is in name
            const firstWordMatch = dbName.split(/[\s・]/)[0] === yName.split(/[\s・]/)[0];
            const tickerInName = dbName.includes(asset.ticker.replace('.T', '').toLowerCase());
            const namePartialMatch = yName.includes(dbName.split(/[\s・]/)[0]) || dbName.includes(yName.split(/[\s・]/)[0]);

            if (firstWordMatch || tickerInName || namePartialMatch) {
                console.log(`✅ ${asset.ticker} → ${asset.name}`);
                console.log(`   Yahoo: ${yahooName}, Price: ¥${quote.regularMarketPrice}`);
            } else {
                console.log(`⚠️ ${asset.ticker} → ${asset.name}`);
                console.log(`   Yahoo: ${yahooName}, Price: ¥${quote.regularMarketPrice}`);
                warnings.push({
                    ticker: asset.ticker,
                    dbName: asset.name,
                    yahooName: yahooName,
                    price: quote.regularMarketPrice
                });
            }
        } catch (error) {
            console.log(`❌ ${asset.ticker} → ${asset.name}`);
            console.log(`   Error: ${error.message}`);
            errors.push({
                ticker: asset.ticker,
                name: asset.name,
                error: error.message
            });
        }
        console.log('');
    }

    console.log('\n=== サマリー ===');
    console.log(`検証済み: ${assets.filter(a => a.type !== 'TRUST').length}件`);
    console.log(`警告 (名前不一致): ${warnings.length}件`);
    console.log(`エラー: ${errors.length}件`);

    if (warnings.length > 0) {
        console.log('\n=== 名前不一致の警告 ===');
        warnings.forEach(w => {
            console.log(`${w.ticker}:`);
            console.log(`  DB名: ${w.dbName}`);
            console.log(`  Yahoo名: ${w.yahooName}`);
        });
    }

    if (errors.length > 0) {
        console.log('\n=== エラー ===');
        errors.forEach(e => {
            console.log(`${e.ticker}: ${e.name} - ${e.error}`);
        });
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
