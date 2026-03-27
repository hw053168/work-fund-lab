import { network } from "hardhat";
import { parseAbi } from "viem";

const FUND_ABI = parseAbi([
  "function SWAP_ROUTER() view returns (address)",
  "function PRICE_REGISTRY() view returns (address)"
]);

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const newImpl = "0xbe7C4aDb31745B24F2A50eE76731B60289E8425F";
  console.log("Checking NEW Fund Implementation:", newImpl);

  const router = await publicClient.readContract({
    address: newImpl,
    abi: FUND_ABI,
    functionName: "SWAP_ROUTER"
  });
  console.log("SWAP_ROUTER:", router);
  console.log("  Expected Sepolia:", "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E");
  console.log("  Match:", router.toLowerCase() === "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E".toLowerCase() ? "✅ YES" : "❌ NO");

  const registry = await publicClient.readContract({
    address: newImpl,
    abi: FUND_ABI,
    functionName: "PRICE_REGISTRY"
  });
  console.log("PRICE_REGISTRY:", registry);
  console.log("  Expected Sepolia:", "0x25cd50874192263b2b549041ede463aa9466e282");
  console.log("  Match:", registry.toLowerCase() === "0x25cd50874192263b2b549041ede463aa9466e282".toLowerCase() ? "✅ YES" : "❌ NO");
}

main().catch(console.error);
