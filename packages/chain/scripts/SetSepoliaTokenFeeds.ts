import { network } from "hardhat";

// Sepolia Chainlink Price Feeds (token/USD)
// https://docs.chain.link/data-feeds/price-feeds/addresses?network=ethereum&page=1#sepolia-testnet
const CHAINLINK_FEEDS: Record<string, `0x${string}`> = {
  WETH: "0x694AA1769357215DE4FAC081bf1f309aDC325306",  // ETH/USD
  USDC: "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E",  // USDC/USD
  LINK: "0xc59E3633BAAC79493d908e63626716e204A45EdF",  // LINK/USD
  BTC: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",   // BTC/USD
};

// Test tokens deployed on Sepolia (our test tokens)
const TEST_TOKENS: Record<string, `0x${string}`> = {
  WETH: "0xc836d8ea42daec2a659d10eea8b7ff8dc4f6d5db",
  USDC: "0x23055b5ae3ea9565d0a71663a729c6a8922c23fc",
  USDT: "0x2b48e781c1672996c23780d60a5d423a3a1e478e",
  FUND: "0x4cbe3d15b89ef1bcd7b0f7e964b681b55c4457a9",
};

// Network tokens on Sepolia (real testnet tokens)
const NETWORK_TOKENS: Record<string, `0x${string}`> = {
  WETH: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
  USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
};

// The 7 existing Sepolia funds
const SEPOLIA_FUNDS: `0x${string}`[] = [
  "0x41AF30FB6aadc232B799bA6e9c61bae7076333A6",
  "0xB2da63776e91051f3eDCc4A2518CA048f02373a1",
  "0xd301EDCd1849541157Ec96F4Da68C02576E4C8De",
  "0xfC46cb3268dc43587Aa776c25b351decAeF50d4a",
  "0x280c6165208e01737f2F16D06321eDa25499821C",
  "0x2467ccc4d62248b2B6c04D8A9c91428a1705E7c7",
  "0x9f1c8Ba318a9CBA794C42E5fF28D25596eeee200",
];

// Fund ABI (minimal for setTokenFeed)
const FUND_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "feed", type: "address" },
    ],
    name: "setTokenFeed",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "oracle",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "worker",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "address" }],
    name: "tokenFeeds",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const [deployer] = await walletClient.getAddresses();
  const chainId = await publicClient.getChainId();
  
  if (chainId !== 11155111) {
    console.error("This script is only for Sepolia (chainId 11155111)");
    console.error(`Current chainId: ${chainId}`);
    process.exit(1);
  }
  
  console.log(`\n=== Setting Token Feeds on Sepolia Funds ===`);
  console.log(`Deployer: ${deployer}`);
  console.log(`Chain ID: ${chainId}\n`);

  // Token → Chainlink Feed mapping
  // Map both test tokens and network tokens to Chainlink feeds
  const tokenFeedPairs: { token: `0x${string}`; feed: `0x${string}`; name: string }[] = [
    // Test WETH → ETH/USD feed
    { token: TEST_TOKENS.WETH, feed: CHAINLINK_FEEDS.WETH, name: "TestWETH → ETH/USD" },
    // Network WETH → ETH/USD feed  
    { token: NETWORK_TOKENS.WETH, feed: CHAINLINK_FEEDS.WETH, name: "NetworkWETH → ETH/USD" },
    // Test USDC → USDC/USD feed
    { token: TEST_TOKENS.USDC, feed: CHAINLINK_FEEDS.USDC, name: "TestUSDC → USDC/USD" },
    // Network USDC → USDC/USD feed
    { token: NETWORK_TOKENS.USDC, feed: CHAINLINK_FEEDS.USDC, name: "NetworkUSDC → USDC/USD" },
    // Test USDT → use USDC/USD feed (close enough for testnet)
    { token: TEST_TOKENS.USDT, feed: CHAINLINK_FEEDS.USDC, name: "TestUSDT → USDC/USD" },
  ];

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const fundAddress of SEPOLIA_FUNDS) {
    console.log(`\n--- Fund: ${fundAddress} ---`);
    
    // Check if we're the manager (worker or oracle)
    const [worker, oracle] = await Promise.all([
      publicClient.readContract({
        address: fundAddress,
        abi: FUND_ABI,
        functionName: "worker",
      }),
      publicClient.readContract({
        address: fundAddress,
        abi: FUND_ABI,
        functionName: "oracle",
      }),
    ]);
    
    const isManager = deployer.toLowerCase() === worker.toLowerCase() || 
                      deployer.toLowerCase() === oracle.toLowerCase();
    
    if (!isManager) {
      console.log(`  ⚠️  Not a manager. Worker=${worker.slice(0,10)}..., Oracle=${oracle.slice(0,10)}...`);
      console.log(`      Skipping this fund.`);
      skipCount += tokenFeedPairs.length;
      continue;
    }
    
    console.log(`  ✓ You are the ${deployer.toLowerCase() === worker.toLowerCase() ? 'worker' : 'oracle'}`);
    
    // Set feeds for each token
    for (const { token, feed, name } of tokenFeedPairs) {
      // Check if already set
      const currentFeed = await publicClient.readContract({
        address: fundAddress,
        abi: FUND_ABI,
        functionName: "tokenFeeds",
        args: [token],
      });
      
      if (currentFeed.toLowerCase() === feed.toLowerCase()) {
        console.log(`  → ${name}: Already set ✓`);
        skipCount++;
        continue;
      }
      
      try {
        const hash = await walletClient.writeContract({
          account: deployer,
          address: fundAddress,
          abi: FUND_ABI,
          functionName: "setTokenFeed",
          args: [token, feed],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`  → ${name}: Set! (tx: ${hash.slice(0,10)}..., status: ${receipt.status})`);
        successCount++;
      } catch (e: any) {
        console.log(`  → ${name}: FAILED - ${e.message?.slice(0, 60)}`);
        failCount++;
      }
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Success: ${successCount}`);
  console.log(`Skipped (already set or not manager): ${skipCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`===============\n`);
}

main().catch(console.error);
