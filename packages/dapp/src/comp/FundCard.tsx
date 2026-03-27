'use client'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation';
import { formatUnits } from 'viem'
import { Address } from './Address';
import { Card } from './Card';
import { formatNumber } from "@/lib/util";
import { StatusBadge } from './StatusBadge';
import { useFundStaticData, useTokenData, useTermsData, useFundEvents } from "@/hook/useFundData";
import { FundStaticData, FundFullData, TermsData, TokenData, FundRole } from "@/type";
import { LegacyFundTotalValue } from './LegacyFundTotalValue';

interface FundCardProps {
  address: `0x${string}`;
  worker: `0x${string}`;
  oracle: `0x${string}`;
  fundsAvailable: bigint;
  status: FundStatus;
  title?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  payoutToken?: `0x${string}`;
}

export function FundCard({
  address,
  worker,
  oracle,
  fundsAvailable,
  status,
  title = 'Untitled',
  tokenSymbol = 'USDC',
  tokenDecimals = 0,
  payoutToken,
}: FundCardProps) {
  const router = useRouter();
  const { data: events } = useFundEvents(address);

  // Detect legacy fund issue: contract reports 0 but there are deposits
  const deposits = events?.deposits || [];
  const hasDeposits = deposits.length > 0;
  const hasMultipleTokenDeposits = hasDeposits && new Set(deposits.map(d => d.token.toLowerCase())).size > 1;
  const isLegacyFundWithBalance = (fundsAvailable === 0n && hasDeposits) || hasMultipleTokenDeposits;

  return (
    <Card onClick={() => router.push(`/browser/${address}`)}>
      <div className="space-y-3">
        <div className="flex justify-between items-center pb-2 border-b border-gray-200">
          <h3 className="text-sm text-gray-500">{title}</h3>
          <StatusBadge status={status} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm text-gray-500">Address</h4>
            <Address address={address} />
          </div>
          <div>
            <h4 className="text-sm text-gray-500">Funds</h4>
            <div className="text-lg">
              {isLegacyFundWithBalance ? (
                <>
                  <LegacyFundTotalValue 
                    deposits={deposits} 
                    payoutTokenDecimals={tokenDecimals}
                    payoutTokenAddress={payoutToken}
                  /> {tokenSymbol}
                </>
              ) : (
                <>{formatNumber(formatUnits(fundsAvailable, tokenDecimals), tokenDecimals)} {tokenSymbol}</>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-sm text-gray-500">Worker</h4>
            <Address address={worker} />
          </div>
          <div>
            <h4 className="text-sm text-gray-500">Oracle</h4>
            <Address address={oracle} />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function FundCard2({
  address,
}: {
  address: `0x${string}`;
}) {
  const { data: fundData, isLoading: isFundLoading, isPending: isFundPending } = useFundStaticData(address);
  const { data: termsData, isLoading: isTermsLoading, isPending: isTermsPending } = useTermsData(fundData?.terms);
  const { data: tokenData , isLoading: isTokenLoading, isPending: isTokenPending } = useTokenData(fundData?.payoutToken);

  const isLoading: boolean = useMemo(() => (
    [isFundLoading, isFundPending, isTermsLoading, isTermsPending, isTokenLoading, isTokenPending].some(v => v)
  ), [isFundLoading, isFundPending, isTermsLoading, isTermsPending, isTokenLoading, isTokenPending]);

  return isLoading ? (
    <Card>
      <h4>Loading...</h4>
    </Card>
  ) : (
    <FundCard
      address={address}
      title={termsData?.title ?? "Untitled"}
      tokenSymbol={tokenData?.symbol ?? "???"}
      tokenDecimals={Number(tokenData?.decimals ?? 18)}
      {...fundData}
    />
  );
}

export function FundCard3(props: FundFullData) {
  return (
    <FundCard
      title={props.termsData?.title ?? "Untitled"}
      tokenSymbol={props.tokenData?.symbol ?? "???"}
      tokenDecimals={Number(props.tokenData?.decimals ?? 18)}
      {...props}
    />
  );
}
