import { createPublicClient, http, parseAbi } from "viem";
import { sepolia } from "viem/chains";

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error("SEPOLIA_RPC_URL not set");
  
  console.log("RPC URL found");

  const client = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl)
  });

  const factoryAddress = "0x4d462b917582331811De6A32DE4D4Fe7735f8950";
  const abi = parseAbi(["function getAllFunds() view returns (address[])"]);

  console.log(`Checking FundFactory at ${factoryAddress}...`);
  const funds = await client.readContract({
    address: factoryAddress,
    abi: abi,
    functionName: "getAllFunds"
  });

  console.log(`Found ${funds.length} funds:`);
  funds.forEach((fund, index) => {
    console.log(`  ${index + 1}. ${fund}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
