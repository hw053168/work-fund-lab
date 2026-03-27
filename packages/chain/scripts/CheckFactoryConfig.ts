import { createPublicClient, http, parseAbi } from "viem";
import { sepolia } from "viem/chains";

const FACTORY_ADDRESS = "0x1816313C1b0381ED86cAFE7ae4037BFe5b6b830F";

const FACTORY_ABI = parseAbi([
  "function FUND_IMPLEMENTATION() view returns (address)"
]);

const FUND_ABI = parseAbi([
  "function SWAP_ROUTER() view returns (address)"
]);

async function main() {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http("https://ethereum-sepolia-rpc.publicnode.com")
  });

  console.log(`Checking Factory: ${FACTORY_ADDRESS}`);

  try {
    const implementation = await publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "FUND_IMPLEMENTATION"
    });
    console.log(`Implementation: ${implementation}`);

    const router = await publicClient.readContract({
      address: implementation,
      abi: FUND_ABI,
      functionName: "SWAP_ROUTER"
    });
    console.log(`Swap Router:    ${router}`);

    if (router === "0xE592427A0AEce92De3Edee1F18E0157C05861564") {
      console.log("Status: ❌ Configured for MAINNET (Broken on Sepolia)");
    } else if (router === "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E") {
      console.log("Status: ✅ Configured for SEPOLIA (Real Liquidity)");
    } else {
      console.log("Status: ⚠️  Configured for MOCK/CUSTOM (Test Environment)");
    }

  } catch (error) {
    console.error("Error reading contract:", error);
  }
}

main();
