import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { sepolia } from "viem/chains";

const userAddress = "0xE05C5dA500AA1f828aEF9d030aE52E66B7B05e82";

const TEST_TOKENS = {
  "Test FUND$": { address: "0x4cbe3d15b89ef1bcd7b0f7e964b681b55c4457a9", decimals: 18 },
  "Test USDC":  { address: "0x23055b5ae3ea9565d0a71663a729c6a8922c23fc", decimals: 6 },
  "Test USDT":  { address: "0x2b48e781c1672996c23780d60a5d423a3a1e478e", decimals: 6 },
  "Test WETH":  { address: "0xc836d8ea42daec2a659d10eea8b7ff8dc4f6d5db", decimals: 18 },
};

const ERC20ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)"
]);

async function main() {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http("https://ethereum-sepolia-rpc.publicnode.com")
  });

  console.log(`\n=== Checking Test Token Balances for ${userAddress} ===\n`);

  for (const [name, config] of Object.entries(TEST_TOKENS)) {
    try {
      const balance = await publicClient.readContract({
        address: config.address as `0x${string}`,
        abi: ERC20ABI,
        functionName: "balanceOf",
        args: [userAddress]
      });

      const formatted = formatUnits(balance, config.decimals);
      const status = balance > 0n ? "✅ Minted" : "❌ Not Minted (Balance: 0)";
      
      console.log(`${status} ${name}`);
      console.log(`   Address: ${config.address}`);
      console.log(`   Balance: ${formatted}`);
      console.log("");

    } catch (error) {
      console.log(`❌ Error checking ${name}:`, error);
    }
  }
}

main();
