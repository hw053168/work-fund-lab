import { network } from "hardhat";

async function main() {
  console.log("=== Debugging network.connect() ===");
  const connection = await network.connect();
  console.log("connection keys:", Object.keys(connection));
  
  const publicClient = await connection.viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  console.log("chainId:", chainId);
  
  // Check if there's a network name somewhere
  console.log("connection.networkName:", (connection as any).networkName);
  console.log("connection.network:", (connection as any).network);
}

main().catch(console.error);
