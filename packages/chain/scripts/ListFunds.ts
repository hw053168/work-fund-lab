import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  
  const factories = {
    "Legacy v1": "0x0fFBB917970CD533714D67eC79897C12d54a3bD5",
    "Legacy v2": "0x1816313C1b0381ED86cAFE7ae4037BFe5b6b830F",
    "Old v3": "0x4d462b917582331811De6A32DE4D4Fe7735f8950",
    "Old v4": "0x9786331bfFaE2bF8E3fa561483bD2F5080b5E761",
    "Current": "0xD608DB2690b25e99969C4383fd7561c376Aad8e6",
  };

  const publicClient = await viem.getPublicClient();

  for (const [name, addr] of Object.entries(factories)) {
    console.log(`\n=== ${name}: ${addr} ===`);
    try {
      const funds = await publicClient.readContract({
        address: addr as `0x${string}`,
        abi: [{
          inputs: [],
          name: "instances",
          outputs: [{ type: "address[]" }],
          stateMutability: "view",
          type: "function"
        }],
        functionName: "instances"
      });
      console.log(`  Funds (${funds.length}):`, funds);
    } catch (e: any) {
      console.log(`  Error: ${e.shortMessage || e.message?.slice(0, 60)}`);
    }
  }
}

main().catch(console.error);
