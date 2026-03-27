import { network } from "hardhat";
import { parseAbi, formatUnits } from "viem";

const REGISTRY_ABI = parseAbi([
  "function getLatestPrice(address token) view returns (int256)",
  "function getPriceFeed(address token) view returns (address)",
  "function owner() view returns (address)"
]);

const SEPOLIA_REGISTRY = "0x25cd50874192263b2b549041ede463aa9466e282";

// Your test tokens from the project
const TEST_TOKENS = {
  "FUND":  "0x4cbe3d15b89ef1bcd7b0f7e964b681b55c4457a9",
  "USDC":  "0x23055b5ae3ea9565d0a71663a729c6a8922c23fc",
  "USDT":  "0x2b48e781c1672996c23780d60a5d423a3a1e478e",
  "WETH":  "0xc836d8ea42daec2a659d10eea8b7ff8dc4f6d5db",
};

async function main() {
  // @ts-ignore
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  console.log(`Checking Sepolia Registry: ${SEPOLIA_REGISTRY}\n`);

  try {
    const owner = await publicClient.readContract({
      address: SEPOLIA_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "owner"
    });
    console.log(`Owner: ${owner}\n`);
  } catch (e) {
    console.log(`Owner: N/A\n`);
  }

  for (const [name, addr] of Object.entries(TEST_TOKENS)) {
    console.log(`${name} (${addr}):`);
    try {
      const feed = await publicClient.readContract({
        address: SEPOLIA_REGISTRY,
        abi: REGISTRY_ABI,
        functionName: "getPriceFeed",
        args: [addr as `0x${string}`]
      });
      console.log(`  Feed: ${feed}`);
      
      if (feed !== "0x0000000000000000000000000000000000000000") {
        const price = await publicClient.readContract({
          address: SEPOLIA_REGISTRY,
          abi: REGISTRY_ABI,
          functionName: "getLatestPrice",
          args: [addr as `0x${string}`]
        });
        console.log(`  Price: ${price} (${formatUnits(price as bigint, 8)} USD)`);
      }
    } catch (e: any) {
      console.log(`  ERROR: ${e.shortMessage || e.message?.slice(0, 60)}`);
    }
  }
}

main().catch(console.error);
