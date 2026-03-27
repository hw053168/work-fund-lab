import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { sepolia } from "viem/chains";

// Uniswap V3 Factory Address on Sepolia
const FACTORY_ADDRESS = "0x0227628f3F023bb0B980b67D528571c95c6DaC1c";

// Token Addresses on Sepolia
const TOKENS = {
  USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  WBTC: "0x29f2D40B0605204364af54EC677bD022dA425d03",
  WETH: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
  UNI:  "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  LINK: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
  DAI:  "0x68194a729C2450ad26072b3D33ADaCbcef39D574"
};

const FactoryABI = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)"
]);

const PoolABI = parseAbi([
  "function liquidity() view returns (uint128)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
]);

async function main() {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http("https://ethereum-sepolia-rpc.publicnode.com")
  });

  console.log("\n=== Checking Uniswap V3 Liquidity on Sepolia (Fee: 0.3%) ===\n");

  const pairs = [
    ["USDC", "WBTC"],
    ["USDC", "WETH"],
    ["WETH", "WBTC"],
    ["UNI", "WETH"],
    ["LINK", "WETH"],
    ["DAI", "USDC"],
    ["DAI", "WETH"]
  ];

  for (const [symA, symB] of pairs) {
    const tokenA = TOKENS[symA as keyof typeof TOKENS];
    const tokenB = TOKENS[symB as keyof typeof TOKENS];

    try {
      const poolAddress = await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: FactoryABI,
        functionName: "getPool",
        args: [tokenA, tokenB, 3000] // 0.3% fee
      });

      if (poolAddress === "0x0000000000000000000000000000000000000000") {
        console.log(`❌ ${symA}/${symB}: No Pool Found`);
        continue;
      }

      const liquidity = await publicClient.readContract({
        address: poolAddress,
        abi: PoolABI,
        functionName: "liquidity"
      });

      const liquidityStr = liquidity.toString();
      const status = liquidity > 0n ? "✅ Active" : "⚠️ Empty";
      
      console.log(`${status} ${symA}/${symB}`);
      console.log(`   Pool: ${poolAddress}`);
      console.log(`   Liquidity: ${liquidityStr}`);

    } catch (error) {
      console.log(`❌ ${symA}/${symB}: Error checking pool`, error);
    }
  }
}

main();


