/**
 * DeployRegistry.ts - Deploy PriceFeedRegistry and configure all token feeds
 * 
 * Run with: npx hardhat run scripts/DeployRegistry.ts --network sepolia
 * 
 * This script:
 * 1. Deploys the PriceFeedRegistry contract
 * 2. Configures feeds for all test tokens (with mock prices)
 * 3. Configures feeds for network tokens (with Chainlink)
 * 4. Outputs the registry address for use in FundFactory deployment
 */

import { network } from "hardhat";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load PriceFeedRegistry artifact
const PriceFeedRegistry = JSON.parse(
  readFileSync(join(__dirname, "../artifacts/contracts/PriceFeedRegistry.sol/PriceFeedRegistry.json"), "utf-8")
);

// Chainlink Price Feeds on Sepolia
const CHAINLINK_FEEDS = {
  ETH_USD: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  USDC_USD: "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E",
  // Note: No USDT/USD feed on Sepolia
};

// All tokens to configure
const TOKEN_CONFIGS = {
  // Test tokens (your deployed ones)
  "Test FUND$": {
    address: "0x4cbe3d15b89ef1bcd7b0f7e964b681b55c4457a9",
    chainlinkFeed: "0x0000000000000000000000000000000000000000", // No Chainlink
    mockPrice: 100000000n, // $1.00
  },
  "Test USDC": {
    address: "0x23055b5ae3ea9565d0a71663a729c6a8922c23fc",
    chainlinkFeed: CHAINLINK_FEEDS.USDC_USD, // Use real Chainlink
    mockPrice: 100000000n, // $1.00 fallback
  },
  "Test USDT": {
    address: "0x2b48e781c1672996c23780d60a5d423a3a1e478e",
    chainlinkFeed: "0x0000000000000000000000000000000000000000", // No Chainlink
    mockPrice: 100000000n, // $1.00
  },
  "Test WETH": {
    address: "0xc836d8ea42daec2a659d10eea8b7ff8dc4f6d5db",
    chainlinkFeed: CHAINLINK_FEEDS.ETH_USD, // Use real Chainlink
    mockPrice: 390000000000n, // $3,900 fallback
  },
  // Network tokens (real Sepolia tokens)
  "Network USDC": {
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle's Sepolia USDC
    chainlinkFeed: CHAINLINK_FEEDS.USDC_USD,
    mockPrice: 100000000n, // $1.00 fallback
  },
  "Network WETH": {
    address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9", // Sepolia WETH
    chainlinkFeed: CHAINLINK_FEEDS.ETH_USD,
    mockPrice: 390000000000n, // $3,900 fallback
  },
};

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const [deployer] = await walletClient.getAddresses();
  const chainId = await publicClient.getChainId();

  console.log(`\n=== Deploying PriceFeedRegistry on Chain ${chainId} ===`);
  console.log(`Deployer: ${deployer}`);

  // Deploy PriceFeedRegistry
  console.log(`\nDeploying PriceFeedRegistry...`);
  const deployHash = await walletClient.deployContract({
    account: deployer,
    abi: PriceFeedRegistry.abi,
    bytecode: PriceFeedRegistry.bytecode as `0x${string}`,
    args: [],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const registryAddress = receipt.contractAddress!;
  console.log(`✅ PriceFeedRegistry deployed @ ${registryAddress}`);

  // Configure all token feeds
  console.log(`\n=== Configuring Token Feeds ===`);
  
  for (const [name, config] of Object.entries(TOKEN_CONFIGS)) {
    console.log(`\nConfiguring ${name}...`);
    console.log(`  Token: ${config.address}`);
    console.log(`  Chainlink: ${config.chainlinkFeed === "0x0000000000000000000000000000000000000000" ? "(none)" : config.chainlinkFeed}`);
    console.log(`  Mock Price: $${Number(config.mockPrice) / 1e8}`);

    const hash = await walletClient.writeContract({
      account: deployer,
      address: registryAddress,
      abi: PriceFeedRegistry.abi,
      functionName: "setFeed",
      args: [config.address, config.chainlinkFeed, config.mockPrice],
    });

    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  ✅ Configured`);
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`DEPLOYMENT COMPLETE`);
  console.log(`${"=".repeat(60)}`);
  console.log(`\nPriceFeedRegistry: ${registryAddress}`);
  console.log(`\nConfigured ${Object.keys(TOKEN_CONFIGS).length} tokens`);
  
  console.log(`\n=== Next Steps ===`);
  console.log(`To use this registry with new Funds, redeploy FundFactory with:`);
  console.log(`\n  npx hardhat ignition deploy ignition/modules/FundFactory.ts --network sepolia \\`);
  console.log(`    --parameters '{"priceRegistry": "${registryAddress}"}'`);
  
  console.log(`\n=== Add to contracts.ts ===`);
  console.log(`PRICE_REGISTRY: "${registryAddress}" as \`0x\${string}\`,`);

  return registryAddress;
}

main().catch(console.error);
