import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

const ROUTER_0xE592 = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const ROUTER_0x3bFA = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E";

async function main() {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http("https://ethereum-sepolia-rpc.publicnode.com")
  });

  console.log("Checking Router Contracts on Sepolia...");

  const code1 = await publicClient.getBytecode({ address: ROUTER_0xE592 });
  console.log(`0xE592... (Mainnet Address): ${code1 ? "✅ Exists" : "❌ No Code"}`);

  const code2 = await publicClient.getBytecode({ address: ROUTER_0x3bFA });
  console.log(`0x3bFA... (Sepolia Address): ${code2 ? "✅ Exists" : "❌ No Code"}`);
}

main();
