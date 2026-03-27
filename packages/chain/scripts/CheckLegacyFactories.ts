import { network } from "hardhat";
import { parseAbi } from "viem";

const FACTORY_ABI = parseAbi([
  "function FUND_IMPLEMENTATION() view returns (address)"
]);

const FUND_ABI = parseAbi([
  "function SWAP_ROUTER() view returns (address)",
  "function PRICE_REGISTRY() view returns (address)"
]);

const FACTORIES = {
  "Legacy v1": "0x0fFBB917970CD533714D67eC79897C12d54a3bD5",
  "Legacy v2": "0x1816313C1b0381ED86cAFE7ae4037BFe5b6b830F",
  "Old Current": "0x4d462b917582331811De6A32DE4D4Fe7735f8950",
  "NEW Current": "0x9786331bfFaE2bF8E3fa561483bD2F5080b5E761",
};

const KNOWN_ROUTERS = {
  "0xE592427A0AEce92De3Edee1F18E0157C05861564": "Mainnet Uniswap V3",
  "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E": "Sepolia Uniswap V3",
};

const KNOWN_REGISTRIES = {
  "0x25cd50874192263b2b549041ede463aa9466e282": "Sepolia Registry",
  "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf": "Mainnet Registry",
};

async function main() {
  // @ts-ignore
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  for (const [name, factoryAddr] of Object.entries(FACTORIES)) {
    console.log(`\n=== ${name} Factory: ${factoryAddr} ===`);
    
    try {
      const implAddr = await publicClient.readContract({
        address: factoryAddr as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: "FUND_IMPLEMENTATION"
      });
      console.log(`  Implementation: ${implAddr}`);

      // Check SWAP_ROUTER
      try {
        const router = await publicClient.readContract({
          address: implAddr as `0x${string}`,
          abi: FUND_ABI,
          functionName: "SWAP_ROUTER"
        });
        const routerName = KNOWN_ROUTERS[router as string] || "Unknown";
        console.log(`  SWAP_ROUTER: ${router} (${routerName})`);
      } catch (e) {
        console.log(`  SWAP_ROUTER: NOT FOUND`);
      }

      // Check PRICE_REGISTRY
      try {
        const registry = await publicClient.readContract({
          address: implAddr as `0x${string}`,
          abi: FUND_ABI,
          functionName: "PRICE_REGISTRY"
        });
        const registryName = KNOWN_REGISTRIES[(registry as string).toLowerCase()] || "Unknown";
        console.log(`  PRICE_REGISTRY: ${registry} (${registryName})`);
      } catch (e) {
        console.log(`  PRICE_REGISTRY: NOT FOUND`);
      }

    } catch (e: any) {
      console.log(`  ERROR: ${e.message?.slice(0, 100)}`);
    }
  }
}

main().catch(console.error);
