import { network } from "hardhat";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PRICE_REGISTRY = '0x25cd50874192263b2b549041ede463aa9466e282' as const;

// Test tokens that use mock prices
const TOKENS_TO_UPDATE = [
  { address: '0x4cbe3d15b89ef1bcd7b0f7e964b681b55c4457a9' as const, name: 'FUND$' },
  { address: '0x23055b5ae3ea9565d0a71663a729c6a8922c23fc' as const, name: 'TestUSDC' },
  { address: '0x2b48e781c1672996c23780d60a5d423a3a1e478e' as const, name: 'TestUSDT' },
  { address: '0xc836d8ea42daec2a659d10eea8b7ff8dc4f6d5db' as const, name: 'TestWETH' },
  // Circle USDC also needs mock update if Chainlink is stale
  { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const, name: 'CircleUSDC' },
];

// Load ABI
const PriceFeedRegistryArtifact = JSON.parse(
  readFileSync(join(__dirname, "../artifacts/contracts/PriceFeedRegistry.sol/PriceFeedRegistry.json"), "utf-8")
);

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClient = await viem.getWalletClient();
  const [deployer] = await walletClient.getAddresses();

  console.log(`\n=== Refreshing Mock Prices ===`);
  console.log(`Deployer: ${deployer}`);
  console.log(`Registry: ${PRICE_REGISTRY}\n`);

  for (const token of TOKENS_TO_UPDATE) {
    try {
      // Check if token is supported
      const isSupported = await publicClient.readContract({
        address: PRICE_REGISTRY,
        abi: PriceFeedRegistryArtifact.abi,
        functionName: 'isSupported',
        args: [token.address]
      });

      if (!isSupported) {
        console.log(`❌ ${token.name}: Not in registry`);
        continue;
      }

      // Get current price and age
      const priceData = await publicClient.readContract({
        address: PRICE_REGISTRY,
        abi: PriceFeedRegistryArtifact.abi,
        functionName: 'latestRoundData',
        args: [token.address]
      }) as [bigint, bigint, bigint, bigint, bigint];
      
      const currentPrice = priceData[1];
      const updatedAt = priceData[3];
      const now = BigInt(Math.floor(Date.now() / 1000));
      const age = now - updatedAt;

      console.log(`📊 ${token.name} (${token.address.slice(0,10)}...)`);
      console.log(`   Current price: ${currentPrice} (age: ${age}s)`);

      if (age > 3600n) {
        console.log(`   ⚠️  STALE - refreshing...`);
        
        // Call updateMockPrice to refresh the timestamp
        const hash = await walletClient.writeContract({
          address: PRICE_REGISTRY,
          abi: PriceFeedRegistryArtifact.abi,
          functionName: 'updateMockPrice',
          args: [token.address, currentPrice],
          account: deployer,
        });
        
        console.log(`   ✅ Updated: ${hash}`);
        await publicClient.waitForTransactionReceipt({ hash });
      } else {
        console.log(`   ✅ Fresh (age < 1 hour)`);
      }
    } catch (e: any) {
      console.log(`❌ ${token.name}: ${e.message?.slice(0, 100)}`);
    }
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
