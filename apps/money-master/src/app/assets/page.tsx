import { getPortfolioWithPrices } from '@/lib/actions';
import { AssetListClient } from '@/components/assets/AssetListClient';

export const dynamic = 'force-dynamic';

export default async function AssetsPage() {
  const { usdJpy } = await getPortfolioWithPrices();

  return (
    <AssetListClient
      initialUsdJpy={usdJpy}
    />
  );
}
