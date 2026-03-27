/**
 * useTokenPrice - Unified price hook for tokens
 * 
 * - Localhost: Returns mock prices
 * - On-chain: Queries PriceFeedRegistry (Sepolia) or Chainlink directly (Mainnet)
 * - Test tokens: Use price from corresponding network token
 */

import { useReadContract, useReadContracts } from 'wagmi';
import { useChainId } from '@/hook/wallet';
import { 
  CHAIN_IDS, 
  SEPOLIA_DEFI, 
  SEPOLIA_TOKENS,
  MAINNET_TOKENS,
  TEST_TOKEN_PRICE_SOURCE,
  MOCK_PRICES,
} from '@/cfg/tokens';

// PriceFeedRegistry ABI (minimal)
const PRICE_REGISTRY_ABI = [
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'latestRoundData',
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'isSupported',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Chainlink AggregatorV3 ABI (minimal)
const CHAINLINK_ABI = [
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface TokenPriceResult {
  price: bigint | null;        // Price in 8 decimals (Chainlink standard)
  priceUsd: number | null;     // Price as floating point USD
  isLoading: boolean;
  isError: boolean;
  source: 'registry' | 'chainlink' | 'mock';
}

/**
 * Get the token address to use for pricing
 * Test tokens map to their network equivalents
 */
function getPriceSourceToken(tokenAddress: string, chainId: number): {
  address: `0x${string}`;
  symbol: string;
} {
  const lowerAddress = tokenAddress.toLowerCase();
  
  // Check if this is a test token
  const sourceSymbol = TEST_TOKEN_PRICE_SOURCE[lowerAddress];
  
  if (sourceSymbol) {
    // It's a test token - get the network token address
    if (chainId === CHAIN_IDS.SEPOLIA) {
      const networkToken = SEPOLIA_TOKENS[sourceSymbol];
      if (networkToken) {
        return { address: networkToken.address, symbol: sourceSymbol };
      }
    } else if (chainId === CHAIN_IDS.MAINNET) {
      const networkToken = MAINNET_TOKENS[sourceSymbol];
      if (networkToken) {
        return { address: networkToken.address, symbol: sourceSymbol };
      }
    }
    // No network equivalent, use mock
    return { address: tokenAddress as `0x${string}`, symbol: sourceSymbol };
  }

  // Check if it's a known network token (Sepolia)
  if (chainId === CHAIN_IDS.SEPOLIA) {
    for (const [sym, config] of Object.entries(SEPOLIA_TOKENS)) {
      if (config.address.toLowerCase() === lowerAddress) {
        return { address: config.address, symbol: sym };
      }
    }
  }

  // Check if it's a known network token (Mainnet)
  if (chainId === CHAIN_IDS.MAINNET) {
    // @ts-ignore - MAINNET_TOKENS might be empty or not fully typed yet
    for (const [sym, config] of Object.entries(MAINNET_TOKENS || {})) {
      if (config.address.toLowerCase() === lowerAddress) {
        return { address: config.address, symbol: sym };
      }
    }
  }
  
  // Not a test token, use as-is
  return { address: tokenAddress as `0x${string}`, symbol: '' };
}

/**
 * Hook to get token price
 * 
 * @param tokenAddress The token address to get price for
 * @returns TokenPriceResult with price data
 */
export function useTokenPrice(tokenAddress: string | undefined): TokenPriceResult {
  const chainId = useChainId();
  
  // Determine price source
  const isLocalhost = chainId === CHAIN_IDS.HARDHAT;
  const isSepolia = chainId === CHAIN_IDS.SEPOLIA;
  const isMainnet = chainId === CHAIN_IDS.MAINNET;
  
  // Get the token to use for pricing (test tokens → network tokens)
  const priceSource = tokenAddress && chainId ? getPriceSourceToken(tokenAddress, chainId) : null;
  
  // Query PriceFeedRegistry (Sepolia only)
  const registryQuery = useReadContract({
    address: SEPOLIA_DEFI.PRICE_REGISTRY,
    abi: PRICE_REGISTRY_ABI,
    functionName: 'latestRoundData',
    args: priceSource ? [priceSource.address] : undefined,
    query: {
      enabled: isSepolia && !!priceSource,
    },
  });
  
  // Query Chainlink directly (Mainnet)
  const chainlinkFeed = priceSource?.symbol && isMainnet
    ? MAINNET_TOKENS[priceSource.symbol]?.priceFeed
    : undefined;
    
  const chainlinkQuery = useReadContract({
    address: chainlinkFeed,
    abi: CHAINLINK_ABI,
    functionName: 'latestRoundData',
    query: {
      enabled: isMainnet && !!chainlinkFeed,
    },
  });
  
  // Determine result
  if (!tokenAddress || !priceSource) {
    return {
      price: null,
      priceUsd: null,
      isLoading: false,
      isError: false,
      source: 'mock',
    };
  }
  
  // Localhost: Use mock prices
  if (isLocalhost) {
    const symbol = priceSource.symbol || 'USDC'; // Default to USDC
    const mockPrice = MOCK_PRICES[symbol] || MOCK_PRICES.USDC;
    return {
      price: mockPrice,
      priceUsd: Number(mockPrice) / 1e8,
      isLoading: false,
      isError: false,
      source: 'mock',
    };
  }
  
  // Sepolia: Use registry
  if (isSepolia) {
    if (registryQuery.isLoading) {
      return { price: null, priceUsd: null, isLoading: true, isError: false, source: 'registry' };
    }
    if (registryQuery.isError || !registryQuery.data) {
      // Fallback to mock
      const symbol = priceSource.symbol || 'USDC';
      const mockPrice = MOCK_PRICES[symbol] || MOCK_PRICES.USDC;
      return {
        price: mockPrice,
        priceUsd: Number(mockPrice) / 1e8,
        isLoading: false,
        isError: false,
        source: 'mock',
      };
    }
    const [, answer] = registryQuery.data as [bigint, bigint, bigint, bigint, bigint];
    return {
      price: answer,
      priceUsd: Number(answer) / 1e8,
      isLoading: false,
      isError: false,
      source: 'registry',
    };
  }
  
  // Mainnet: Use Chainlink directly
  if (isMainnet) {
    if (chainlinkQuery.isLoading) {
      return { price: null, priceUsd: null, isLoading: true, isError: false, source: 'chainlink' };
    }
    if (chainlinkQuery.isError || !chainlinkQuery.data) {
      // Fallback to mock
      const symbol = priceSource.symbol || 'USDC';
      const mockPrice = MOCK_PRICES[symbol] || MOCK_PRICES.USDC;
      return {
        price: mockPrice,
        priceUsd: Number(mockPrice) / 1e8,
        isLoading: false,
        isError: false,
        source: 'mock',
      };
    }
    const [, answer] = chainlinkQuery.data as [bigint, bigint, bigint, bigint, bigint];
    return {
      price: answer,
      priceUsd: Number(answer) / 1e8,
      isLoading: false,
      isError: false,
      source: 'chainlink',
    };
  }
  
  // Unknown chain: Use mock
  const symbol = priceSource.symbol || 'USDC';
  const mockPrice = MOCK_PRICES[symbol] || MOCK_PRICES.USDC;
  return {
    price: mockPrice,
    priceUsd: Number(mockPrice) / 1e8,
    isLoading: false,
    isError: false,
    source: 'mock',
  };
}

/**
 * Get mock price for a token symbol (sync, for non-hook usage)
 */
export function getMockPrice(symbol: string): bigint {
  return MOCK_PRICES[symbol.toUpperCase()] || MOCK_PRICES.USDC;
}

/**
 * Get mock price as USD number
 */
export function getMockPriceUsd(symbol: string): number {
  return Number(getMockPrice(symbol)) / 1e8;
}

/**
 * Token balance for aggregate calculation
 */
export interface TokenBalance {
  token: `0x${string}`;
  balance: bigint;
  decimals: number;
  symbol?: string;
}

export interface AggregateValueResult {
  /** Total value in payout token (with payout token decimals) */
  totalValue: bigint;
  /** Total value as formatted number string */
  totalFormatted: string;
  /** Whether any prices are still loading */
  isLoading: boolean;
  /** Whether all token prices were successfully fetched */
  isComplete: boolean;
  /** Individual token values for debugging */
  breakdown: Array<{
    token: `0x${string}`;
    balance: bigint;
    priceUsd: number | null;
    valueUsd: number | null;
  }>;
}

/**
 * Hook to calculate aggregate fund value from token balances
 * This bypasses the contract's broken `fundsAvailable` calculation
 * by computing the value entirely on the frontend using PriceFeedRegistry prices.
 * 
 * Uses useReadContracts to batch-fetch all prices in a single call.
 */
export function useAggregateValue(
  tokenBalances: TokenBalance[],
  payoutTokenDecimals: number = 6, // USDC default
  payoutTokenAddress?: `0x${string}`, // Payout token for proper conversion
): AggregateValueResult {
  const rawChainId = useChainId();
  const chainId = rawChainId ?? CHAIN_IDS.SEPOLIA; // Default to Sepolia
  const isSepolia = chainId === CHAIN_IDS.SEPOLIA;
  const isLocalhost = chainId === CHAIN_IDS.HARDHAT;
  
  // Map tokens to their price source addresses
  const priceSourceTokens = tokenBalances.map(tb => 
    getPriceSourceToken(tb.token, chainId)
  );
  
  // Also get payout token price source
  const payoutPriceSource = payoutTokenAddress 
    ? getPriceSourceToken(payoutTokenAddress, chainId)
    : null;
  
  // Build contracts array to query all prices at once from PriceFeedRegistry
  // Include payout token price at the end if it's not a stablecoin
  const priceContracts = [
    ...priceSourceTokens.map(ps => ({
      address: SEPOLIA_DEFI.PRICE_REGISTRY,
      abi: PRICE_REGISTRY_ABI,
      functionName: 'latestRoundData' as const,
      args: [ps.address] as const,
    })),
    // Add payout token price query
    ...(payoutPriceSource ? [{
      address: SEPOLIA_DEFI.PRICE_REGISTRY,
      abi: PRICE_REGISTRY_ABI,
      functionName: 'latestRoundData' as const,
      args: [payoutPriceSource.address] as const,
    }] : []),
  ];
  
  // Batch query all prices from registry (only on Sepolia)
  const { data: priceData, isLoading: pricesLoading } = useReadContracts({
    contracts: priceContracts,
    query: {
      enabled: isSepolia && tokenBalances.length > 0,
    },
  });
  
  // Get payout token price (for converting USD total to payout token)
  let payoutPriceUsd = 1; // Default: assume stablecoin (1 USD)
  if (payoutPriceSource && priceData && priceData[tokenBalances.length]?.result) {
    const [, answer] = priceData[tokenBalances.length].result as [bigint, bigint, bigint, bigint, bigint];
    payoutPriceUsd = Number(answer) / 1e8;
  } else if (payoutPriceSource) {
    // Fallback to mock price
    const symbol = payoutPriceSource.symbol || 'USDC';
    const mockPrice = MOCK_PRICES[symbol.toUpperCase()] || MOCK_PRICES.USDC;
    payoutPriceUsd = Number(mockPrice) / 1e8;
  }
  
  // Calculate aggregate value in USD
  let totalUsd = 0;
  const breakdown: AggregateValueResult['breakdown'] = [];
  let completeCount = 0;
  
  for (let i = 0; i < tokenBalances.length; i++) {
    const tb = tokenBalances[i];
    const priceSource = priceSourceTokens[i];
    let priceUsd: number | null = null;
    
    // On Sepolia, use registry prices if available
    if (isSepolia && priceData && priceData[i]?.result) {
      const [, answer] = priceData[i].result as [bigint, bigint, bigint, bigint, bigint];
      priceUsd = Number(answer) / 1e8; // Chainlink uses 8 decimals
    } 
    // Fallback to mock prices (localhost or if registry fails)
    else {
      const symbol = priceSource.symbol || 'USDC';
      const mockPrice = MOCK_PRICES[symbol.toUpperCase()] || MOCK_PRICES.USDC;
      priceUsd = Number(mockPrice) / 1e8;
    }
    
    let valueUsd: number | null = null;
    
    if (priceUsd !== null && tb.balance > BigInt(0)) {
      // Convert balance to human-readable number
      const balanceNum = Number(tb.balance) / Math.pow(10, tb.decimals);
      valueUsd = balanceNum * priceUsd;
      totalUsd += valueUsd;
      completeCount++;
    } else {
      valueUsd = 0;
      completeCount++;
    }
    
    breakdown.push({
      token: tb.token,
      balance: tb.balance,
      priceUsd,
      valueUsd,
    });
  }
  
  // Convert total USD to payout token value
  // For WETH: totalUsd / priceOfWeth = amount in WETH
  // For USDC: totalUsd / 1 = amount in USDC  
  const totalInPayoutToken = payoutPriceUsd > 0 ? totalUsd / payoutPriceUsd : totalUsd;
  const totalValue = BigInt(Math.floor(totalInPayoutToken * Math.pow(10, payoutTokenDecimals)));
  const totalFormatted = totalInPayoutToken.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.min(payoutTokenDecimals, 8), // Smart decimals up to 8
  });
  
  return {
    totalValue,
    totalFormatted,
    isLoading: isSepolia && pricesLoading,
    isComplete: completeCount === tokenBalances.length,
    breakdown,
  };
}
