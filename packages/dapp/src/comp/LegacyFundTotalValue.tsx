'use client'
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import type { Address as AddressType } from 'viem';
import { formatNumber } from '@/lib/util';
import { DepositEvent, queryTokenData } from '@/hook/useFundData';
import { useAggregateValue } from '@/hook/useTokenPrice';
import { ERC20_ABI } from '@/lib/erc20';

export function LegacyFundTotalValue({ 
  fundAddress,
  deposits, 
  payoutTokenDecimals,
  payoutTokenAddress
}: { 
  fundAddress: AddressType,
  deposits: DepositEvent[], 
  payoutTokenDecimals: number,
  payoutTokenAddress?: AddressType
}) {
  // 1. Identify unique tokens involved
  const uniqueTokens = useMemo(() => {
    const set = new Set<string>();
    deposits.forEach(d => set.add(d.token.toLowerCase()));
    // Also include payout token if not present (it might hold balance even if not deposited directly)
    if (payoutTokenAddress) set.add(payoutTokenAddress.toLowerCase());
    return Array.from(set) as AddressType[];
  }, [deposits, payoutTokenAddress]);

  // 2. Fetch token metadata (decimals)
  const tokenQueries = useQueries({
    queries: uniqueTokens.map(token => ({
      queryKey: ['token', token],
      queryFn: () => queryTokenData({ address: token }),
      staleTime: Infinity,
    }))
  });

  // 3. Fetch LIVE balances of the fund contract
  const { data: balanceData, isLoading: isBalanceLoading } = useReadContracts({
    contracts: uniqueTokens.map(token => ({
      address: token,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [fundAddress],
    })),
    query: {
      enabled: uniqueTokens.length > 0,
      refetchInterval: 300000, // Refresh every 5 minutes to reduce RPC calls
    }
  });

  const isLoading = tokenQueries.some(q => q.isLoading) || isBalanceLoading;
  
  // 4. Construct TokenBalance[] using LIVE balances
  const tokenBalances = useMemo(() => {
    if (isLoading || !balanceData) return [];
    
    return uniqueTokens.map((token, i) => {
      const meta = tokenQueries[i].data;
      const balanceResult = balanceData[i];
      
      if (!meta || !balanceResult || balanceResult.status === 'failure') return null;
      
      const balance = balanceResult.result as bigint;
      if (balance === 0n) return null; // Skip empty balances

      return {
        token: token,
        balance: balance,
        decimals: Number(meta.decimals)
      };
    }).filter(Boolean) as { token: AddressType, balance: bigint, decimals: number }[];
  }, [uniqueTokens, tokenQueries, balanceData, isLoading]);

  // 5. Calculate aggregate value
  const { totalFormatted, isLoading: priceLoading } = useAggregateValue(
    tokenBalances, 
    payoutTokenDecimals,
    payoutTokenAddress
  );

  if (isLoading || priceLoading) return <span>...</span>;

  return <span>{totalFormatted}</span>;
}
