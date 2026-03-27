/**
 * Token configurations for different networks
 * These are the ERC20 tokens available for fund deposits/withdrawals
 */

// Chain IDs
export const CHAIN_IDS = {
  MAINNET: 1,
  SEPOLIA: 11155111,
  HARDHAT: 31337,
} as const;

// Token interface
export interface TokenConfig {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  // Chainlink price feed address (if available)
  priceFeed?: `0x${string}`;
}

// ============================================
// SEPOLIA TESTNET TOKENS (Network tokens - real contracts)
// ============================================
export const SEPOLIA_TOKENS: Record<string, TokenConfig> = {
  USDT: {
    address: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    // No official Chainlink USDT/USD feed on Sepolia - use mock price
  },
  WETH: {
    address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    priceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  },
  DAI: {
    address: "0x68194a729C2450ad26072b3D33ADaCbcef39D574",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    // No official Chainlink DAI/USD feed on Sepolia - use mock price
  },
  LINK: {
    address: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    symbol: "LINK",
    name: "Chainlink Token",
    decimals: 18,
    priceFeed: "0xc59E3633BAAC79493d908e63626716e204A45EdF",
  },
  USDC: {
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    priceFeed: "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E",
  },
  WBTC: {
    address: "0x29f2D40B0605204364af54EC677bD022dA425d03",
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
    priceFeed: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
  },
  UNI: {
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    symbol: "UNI",
    name: "Uniswap Token",
    decimals: 18,
    // No official Chainlink UNI/USD feed on Sepolia - use mock price
  },
};

// ============================================
// SEPOLIA TEST TOKENS (Our deployed test tokens)
// ============================================
export const SEPOLIA_TEST_TOKENS: Record<string, TokenConfig> = {
  FUND: {
    address: "0x4cbe3d15b89ef1bcd7b0f7e964b681b55c4457a9",
    symbol: "FUND$",
    name: "Test FUND$",
    decimals: 18,
  },
  USDT: {
    address: "0x2b48e781c1672996c23780d60a5d423a3a1e478e",
    symbol: "USDT",
    name: "Test USDT",
    decimals: 6,
  },
  USDC: {
    address: "0x23055b5ae3ea9565d0a71663a729c6a8922c23fc",
    symbol: "USDC",
    name: "Test USDC",
    decimals: 6,
  },
  WETH: {
    address: "0xc836d8ea42daec2a659d10eea8b7ff8dc4f6d5db",
    symbol: "WETH",
    name: "Test WETH",
    decimals: 18,
  },
};

// Sepolia DeFi infrastructure
export const SEPOLIA_DEFI = {
  // Uniswap V3 SwapRouter (same address on Sepolia/Mainnet)
  SWAP_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564" as `0x${string}`,
  // Chainlink ETH/USD feed (Sepolia)
  ETH_USD_FEED: "0x694AA1769357215DE4FAC081bf1f309aDC325306" as `0x${string}`,
  // PriceFeedRegistry (centralized hybrid pricer)
  PRICE_REGISTRY: "0x25cd50874192263b2b549041ede463aa9466e282" as `0x${string}`,
};

// ============================================
// TEST TOKEN → NETWORK TOKEN MAPPING
// Test tokens use prices from their corresponding network tokens
// ============================================
export const TEST_TOKEN_PRICE_SOURCE: Record<string, string> = {
  // Test FUND$ → use mock $1 (no network equivalent)
  "0x4cbe3d15b89ef1bcd7b0f7e964b681b55c4457a9": "FUND",
  // Test USDC → use Network USDC price
  "0x23055b5ae3ea9565d0a71663a729c6a8922c23fc": "USDC",
  // Test USDT → use mock $1 (no Chainlink on Sepolia)
  "0x2b48e781c1672996c23780d60a5d423a3a1e478e": "USDT",
  // Test WETH → use Network WETH price
  "0xc836d8ea42daec2a659d10eea8b7ff8dc4f6d5db": "WETH",
};

// ============================================
// MOCK PRICES (for localhost/fallback)
// 8 decimals like Chainlink
// ============================================
export const MOCK_PRICES: Record<string, bigint> = {
  FUND: BigInt(100000000),        // $1.00
  USDC: BigInt(100000000),        // $1.00
  USDT: BigInt(100000000),        // $1.00
  DAI: BigInt(100000000),         // $1.00
  WETH: BigInt(390000000000),     // $3,900.00
  WBTC: BigInt(10400000000000),   // $104,000.00
  LINK: BigInt(1400000000),       // $14.00
  UNI: BigInt(1200000000),        // $12.00
};

// ============================================
// MAINNET TOKENS
// ============================================
export const MAINNET_TOKENS: Record<string, TokenConfig> = {
  USDC: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    priceFeed: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6", // USDC/USD Mainnet
  },
  USDT: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    priceFeed: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", // USDT/USD Mainnet
  },
  WETH: {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // ETH/USD Mainnet
  },
  DAI: {
    address: "0x6B175474E89094C44Da98b954EescdeCB5C811111",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    priceFeed: "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9", // DAI/USD Mainnet
  },
};

// Mainnet DeFi infrastructure
export const MAINNET_DEFI = {
  // Uniswap V3 SwapRouter (same address on Mainnet/Sepolia)
  SWAP_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564" as `0x${string}`,
  // Chainlink ETH/USD feed (Mainnet)
  ETH_USD_FEED: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" as `0x${string}`,
};

// ============================================
// LOCALHOST/HARDHAT TOKENS (Mock addresses)
// These are set after running DeployTestEnv.ts
// ============================================
export const HARDHAT_TOKENS: Record<string, TokenConfig> = {
  FUND: {
    address: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9", // FundToken address from deployment
    symbol: "FUND",
    name: "Fund Token",
    decimals: 18,
  },
  USDC: {
    address: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707", // TestUSDC address from deployment
    symbol: "USDC",
    name: "Test USDC",
    decimals: 6,
  },
  USDT: {
    address: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9", // TestUSDT address from deployment
    symbol: "USDT",
    name: "Test USDT",
    decimals: 6,
  },
  WETH: {
    address: "0x0165878A594ca255338adfa4d48449f69242Eb8F", // TestWETH address from deployment
    symbol: "WETH",
    name: "Test WETH",
    decimals: 18,
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get tokens for a specific chain
 */
export function getTokensForChain(chainId: number): Record<string, TokenConfig> {
  switch (chainId) {
    case CHAIN_IDS.MAINNET:
      return MAINNET_TOKENS;
    case CHAIN_IDS.SEPOLIA:
      return SEPOLIA_TOKENS;
    case CHAIN_IDS.HARDHAT:
      return HARDHAT_TOKENS;
    default:
      return {};
  }
}

/**
 * Get token list as array for dropdowns
 */
export function getTokenList(chainId: number): TokenConfig[] {
  return Object.values(getTokensForChain(chainId));
}

/**
 * Get DeFi config for a chain
 */
export function getDefiConfig(chainId: number) {
  switch (chainId) {
    case CHAIN_IDS.MAINNET:
      return MAINNET_DEFI;
    case CHAIN_IDS.SEPOLIA:
      return SEPOLIA_DEFI;
    default:
      return null;
  }
}

/**
 * Check if a token is a test token (has a price source mapping)
 */
export function isTestToken(tokenAddress: string): boolean {
  return tokenAddress.toLowerCase() in TEST_TOKEN_PRICE_SOURCE ||
    Object.keys(TEST_TOKEN_PRICE_SOURCE).some(
      addr => addr.toLowerCase() === tokenAddress.toLowerCase()
    );
}

/**
 * Get the price source symbol for a token
 * For test tokens, returns the network token symbol to use for pricing
 * For other tokens, tries to match by address in known tokens
 */
export function getPriceSourceSymbol(tokenAddress: string, chainId: number): string | null {
  const lowerAddress = tokenAddress.toLowerCase();
  
  // Check test token mapping first
  for (const [addr, symbol] of Object.entries(TEST_TOKEN_PRICE_SOURCE)) {
    if (addr.toLowerCase() === lowerAddress) {
      return symbol;
    }
  }
  
  // Check network tokens
  const networkTokens = getTokensForChain(chainId);
  for (const [symbol, config] of Object.entries(networkTokens)) {
    if (config.address.toLowerCase() === lowerAddress) {
      return symbol;
    }
  }
  
  return null;
}

