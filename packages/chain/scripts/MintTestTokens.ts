import { network } from "hardhat";
import { parseUnits } from "viem";

// Test token addresses on Sepolia (from your deployment)
const SEPOLIA_TEST_TOKENS = {
  FUND: "0x4cbe3d15b89ef1bcd7b0f7e964b681b55c4457a9",
  USDC: "0x23055b5ae3ea9565d0a71663a729c6a8922c23fc",
  USDT: "0x2b48e781c1672996c23780d60a5d423a3a1e478e",
  WETH: "0xc836d8ea42daec2a659d10eea8b7ff8dc4f6d5db",
};

// Simple ERC20 ABI for minting
const TEST_TOKEN_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const [deployer] = await walletClient.getAddresses();
  const chainId = await publicClient.getChainId();

  console.log(`\n=== Minting Test Tokens on Chain ${chainId} ===`);
  console.log(`Recipient: ${deployer}`);

  // Amounts to mint (generous amounts for testing)
  const mintAmounts = {
    FUND: parseUnits("100000", 18),  // 100,000 FUND$
    USDC: parseUnits("100000", 6),   // 100,000 USDC
    USDT: parseUnits("100000", 6),   // 100,000 USDT
    WETH: parseUnits("100", 18),     // 100 WETH
  };

  for (const [symbol, address] of Object.entries(SEPOLIA_TEST_TOKENS)) {
    try {
      const tokenAddress = address as `0x${string}`;
      const amount = mintAmounts[symbol as keyof typeof mintAmounts];

      // Get current balance
      const balanceBefore = await publicClient.readContract({
        address: tokenAddress,
        abi: TEST_TOKEN_ABI,
        functionName: "balanceOf",
        args: [deployer],
      });

      const decimals = await publicClient.readContract({
        address: tokenAddress,
        abi: TEST_TOKEN_ABI,
        functionName: "decimals",
      });

      console.log(`\n${symbol}:`);
      console.log(`  Address: ${tokenAddress}`);
      console.log(`  Balance before: ${Number(balanceBefore) / 10 ** decimals}`);

      // Mint tokens
      const hash = await walletClient.writeContract({
        account: deployer,
        address: tokenAddress,
        abi: TEST_TOKEN_ABI,
        functionName: "mint",
        args: [deployer, amount],
      });

      console.log(`  Minting ${Number(amount) / 10 ** decimals} ${symbol}...`);
      await publicClient.waitForTransactionReceipt({ hash });

      // Get new balance
      const balanceAfter = await publicClient.readContract({
        address: tokenAddress,
        abi: TEST_TOKEN_ABI,
        functionName: "balanceOf",
        args: [deployer],
      });

      console.log(`  ✅ Balance after: ${Number(balanceAfter) / 10 ** decimals}`);
    } catch (error: any) {
      console.log(`  ❌ Failed to mint ${symbol}: ${error.message}`);
    }
  }

  console.log(`\n=== Done! ===\n`);
}

main().catch(console.error);
