import { network } from "hardhat";
import { parseAbi } from "viem";

const REGISTRY_ABI = parseAbi([
  "function getLatestPrice(address token) view returns (int256)",
  "function getPriceFeed(address token) view returns (address)"
]);

const REGISTRIES = {
  "Sepolia Registry": "0x25cd50874192263b2b549041ede463aa9466e282",
  "Mainnet Registry": "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf",
};

// Test token (USDC on Sepolia)
const TEST_TOKEN = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

async function main() {
  // @ts-ignore
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  
  console.log(`Chain ID: ${chainId}`);

  for (const [name, addr] of Object.entries(REGISTRIES)) {
    console.log(`\n=== ${name}: ${addr} ===`);
    
    // Check if contract exists (has code)
    const code = await publicClient.getCode({ address: addr as `0x${string}` });
    console.log(`  Has code: ${code && code !== '0x' ? 'YES (' + code.length + ' bytes)' : 'NO'}`);
    
    if (code && code !== '0x') {
      try {
        const feed = await publicClient.readContract({
          address: addr as `0x${string}`,
          abi: REGISTRY_ABI,
          functionName: "getPriceFeed",
          args: [TEST_TOKEN]
        });
        console.log(`  getPriceFeed(USDC): ${feed}`);
      } catch (e: any) {
        console.log(`  getPriceFeed(USDC): ERROR - ${e.shortMessage || e.message?.slice(0, 80)}`);
      }
    }
  }
}

main().catch(console.error);
