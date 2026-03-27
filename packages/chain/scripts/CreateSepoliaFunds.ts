import { network } from "hardhat";
import { encodeAbiParameters, parseAbiParameters, keccak256 } from "viem";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Create test Funds on Sepolia, each with a different payout token
 * 
 * Run with: npx hardhat run scripts/CreateSepoliaFunds.ts --network sepolia
 * 
 * Prerequisites:
 * - FundFactory already deployed on Sepolia
 * - Configure SEPOLIA_RPC_URL and SEPOLIA_PRIVATE_KEY in .env
 * - Have Sepolia ETH for gas
 * 
 * Optional: Uncomment DEPLOY_TEST_TOKENS to deploy your own test tokens first
 */

// ============================================
// CONFIGURATION - Update these addresses!
// ============================================

// Set to true to deploy test tokens (FundToken, TestUSDC, TestUSDT, TestWETH)
// Set to false to use existing tokens on Sepolia
const DEPLOY_TEST_TOKENS = false;

// FundFactory address on Sepolia (from your deployment)
const FUND_FACTORY_ADDRESS = "0x0fFBB917970CD533714D67eC79897C12d54a3bD5" as const;

// Existing tokens on Sepolia
const SEPOLIA_TOKENS = {
  // Your deployed FundToken on Sepolia (update after deployment)
  FUND: {
    address: "0x0000000000000000000000000000000000000000" as `0x${string}`, // TODO: Update with your deployed address
    name: "FUND (⚡permit 18dec)",
  },
  // Circle's official test USDC
  USDC: {
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`,
    name: "USDC (⚡permit 6dec)",
  },
  // Your deployed TestUSDT on Sepolia (update after deployment)
  USDT: {
    address: "0x0000000000000000000000000000000000000000" as `0x${string}`, // TODO: Update with your deployed address
    name: "USDT (standard 6dec)",
  },
  // Wrapped ETH on Sepolia
  WETH: {
    address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9" as `0x${string}`,
    name: "WETH (⚡permit 18dec)",
  },
};

// Default terms CID (update if you have a different one)
const FUND_TERMS = "bafkreie7525ywkhwglluidqr3ule3jsd22bfyfs7yx6jgtlc3v34enosji";

// ============================================

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load contract artifacts
const FundFactoryArtifact = JSON.parse(
  readFileSync(join(__dirname, "../artifacts/contracts/FundFactory.sol/FundFactory.json"), "utf-8")
);
const FundArtifact = JSON.parse(
  readFileSync(join(__dirname, "../artifacts/contracts/Fund.sol/Fund.json"), "utf-8")
);

// Test token artifacts (for optional deployment)
const FundTokenArtifact = JSON.parse(
  readFileSync(join(__dirname, "../artifacts/contracts/FundToken.sol/FundToken.json"), "utf-8")
);
const TestUSDCArtifact = JSON.parse(
  readFileSync(join(__dirname, "../artifacts/contracts/TestUSDC.sol/TestUSDC.json"), "utf-8")
);
const TestUSDTArtifact = JSON.parse(
  readFileSync(join(__dirname, "../artifacts/contracts/TestUSDT.sol/TestUSDT.json"), "utf-8")
);
const TestWETHArtifact = JSON.parse(
  readFileSync(join(__dirname, "../artifacts/contracts/TestWETH.sol/TestWETH.json"), "utf-8")
);

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClient = await viem.getWalletClient();
  const [deployer] = await walletClient.getAddresses();
  const chainId = await publicClient.getChainId();

  console.log(`\n=== Creating Test Funds on Sepolia ===`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Deployer (Worker/Oracle): ${deployer}`);
  console.log(`FundFactory: ${FUND_FACTORY_ADDRESS}`);
  
  const balance = await publicClient.getBalance({ address: deployer });
  console.log(`Balance: ${Number(balance) / 1e18} ETH\n`);

  if (chainId !== 11155111) {
    console.error(`❌ Error: Expected Sepolia (11155111), got chain ${chainId}`);
    console.error(`   Run with: npx hardhat run scripts/CreateSepoliaFunds.ts --network sepolia`);
    process.exit(1);
  }

  // ============================================
  // OPTIONAL: Deploy test tokens
  // ============================================
  if (DEPLOY_TEST_TOKENS) {
    console.log(`\n=== Deploying Test Tokens ===`);

    // Deploy FundToken ($FUND) - 18 decimals, ERC20Permit
    console.log(`Deploying FundToken ($FUND)...`);
    const fundTokenHash = await walletClient.deployContract({
      abi: FundTokenArtifact.abi,
      bytecode: FundTokenArtifact.bytecode as `0x${string}`,
      args: [],
      account: deployer,
    });
    const fundTokenReceipt = await publicClient.waitForTransactionReceipt({ hash: fundTokenHash });
    SEPOLIA_TOKENS.FUND.address = fundTokenReceipt.contractAddress!;
    console.log(`  ✅ FundToken @ ${SEPOLIA_TOKENS.FUND.address}`);

    // Deploy TestUSDC - 6 decimals, ERC20Permit (skip if using Circle's official)
    // console.log(`Deploying TestUSDC...`);
    // const usdcHash = await walletClient.deployContract({
    //   abi: TestUSDCArtifact.abi,
    //   bytecode: TestUSDCArtifact.bytecode as `0x${string}`,
    //   args: [],
    //   account: deployer,
    // });
    // const usdcReceipt = await publicClient.waitForTransactionReceipt({ hash: usdcHash });
    // SEPOLIA_TOKENS.USDC.address = usdcReceipt.contractAddress!;
    // console.log(`  ✅ TestUSDC @ ${SEPOLIA_TOKENS.USDC.address}`);

    // Deploy TestUSDT - 6 decimals, Standard ERC20 (no permit)
    console.log(`Deploying TestUSDT...`);
    const usdtHash = await walletClient.deployContract({
      abi: TestUSDTArtifact.abi,
      bytecode: TestUSDTArtifact.bytecode as `0x${string}`,
      args: [],
      account: deployer,
    });
    const usdtReceipt = await publicClient.waitForTransactionReceipt({ hash: usdtHash });
    SEPOLIA_TOKENS.USDT.address = usdtReceipt.contractAddress!;
    console.log(`  ✅ TestUSDT @ ${SEPOLIA_TOKENS.USDT.address}`);

    // Deploy TestWETH - 18 decimals, ERC20Permit (skip if using official WETH)
    // console.log(`Deploying TestWETH...`);
    // const wethHash = await walletClient.deployContract({
    //   abi: TestWETHArtifact.abi,
    //   bytecode: TestWETHArtifact.bytecode as `0x${string}`,
    //   args: [],
    //   account: deployer,
    // });
    // const wethReceipt = await publicClient.waitForTransactionReceipt({ hash: wethHash });
    // SEPOLIA_TOKENS.WETH.address = wethReceipt.contractAddress!;
    // console.log(`  ✅ TestWETH @ ${SEPOLIA_TOKENS.WETH.address}`);

    console.log(`\n=== Test Token Deployment Complete ===`);
    console.log(`FUND: ${SEPOLIA_TOKENS.FUND.address}`);
    console.log(`USDC: ${SEPOLIA_TOKENS.USDC.address}`);
    console.log(`USDT: ${SEPOLIA_TOKENS.USDT.address}`);
    console.log(`WETH: ${SEPOLIA_TOKENS.WETH.address}`);
    console.log(`======================================\n`);
  }

  // Check existing funds
  const existingFunds = (await publicClient.readContract({
    address: FUND_FACTORY_ADDRESS,
    abi: FundFactoryArtifact.abi,
    functionName: "instances",
    args: [],
  })) as `0x${string}`[];
  
  console.log(`Existing funds: ${existingFunds.length}`);

  // Define the funds to create (one per token type available on Sepolia)
  // Only include tokens with valid addresses
  const fundsToCreate = [
    SEPOLIA_TOKENS.FUND.address !== "0x0000000000000000000000000000000000000000" 
      ? { token: SEPOLIA_TOKENS.FUND.address, name: SEPOLIA_TOKENS.FUND.name } : null,
    { token: SEPOLIA_TOKENS.USDC.address, name: SEPOLIA_TOKENS.USDC.name },
    SEPOLIA_TOKENS.USDT.address !== "0x0000000000000000000000000000000000000000"
      ? { token: SEPOLIA_TOKENS.USDT.address, name: SEPOLIA_TOKENS.USDT.name } : null,
    { token: SEPOLIA_TOKENS.WETH.address, name: SEPOLIA_TOKENS.WETH.name },
  ].filter(Boolean) as { token: `0x${string}`; name: string }[];

  const createdFunds: { address: `0x${string}`; token: string; name: string }[] = [];

  // Create funds
  console.log(`\nCreating ${fundsToCreate.length} test funds...`);
  for (let i = 0; i < fundsToCreate.length; i++) {
    const { token, name } = fundsToCreate[i];
    
    console.log(`\n[${i + 1}/${fundsToCreate.length}] Creating fund with ${name}...`);
    
    // Encode initialization args: worker, oracle, cut, token, terms
    // Using deployer as both worker and oracle for testing
    const fundInitArgs = encodeAbiParameters(
      parseAbiParameters('address worker, address oracle, uint256 cut, address token, string terms'),
      [deployer, deployer, 0n, token, FUND_TERMS],
    );

    try {
      // Simulate first
      const { result } = await publicClient.simulateContract({
        account: deployer,
        address: FUND_FACTORY_ADDRESS,
        abi: FundFactoryArtifact.abi,
        functionName: 'deploy',
        args: [fundInitArgs],
      });
      const fundAddress = result as unknown as `0x${string}`;

      // Execute
      const hash = await walletClient.writeContract({
        account: deployer,
        address: FUND_FACTORY_ADDRESS,
        abi: FundFactoryArtifact.abi,
        functionName: 'deploy',
        args: [fundInitArgs],
      });
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  ✅ Fund created @ ${fundAddress} (tx: ${receipt.transactionHash.slice(0, 10)}...)`);
      
      createdFunds.push({ address: fundAddress, token, name });

      // Lock terms (sign and submit)
      console.log(`  🔐 Locking terms...`);
      const termsSign = await walletClient.signTypedData({
        account: deployer,
        domain: {
          name: 'Fund',
          version: '1',
          chainId: chainId,
          verifyingContract: fundAddress,
        },
        types: {
          SignTerms: [
            { name: 'terms', type: 'bytes32' },
          ],
        },
        primaryType: 'SignTerms',
        message: {
          terms: keccak256(FUND_TERMS as `0x${string}`),
        },
      });

      const lockHash = await walletClient.writeContract({
        account: deployer,
        address: fundAddress,
        abi: FundArtifact.abi,
        functionName: 'lockTerms',
        args: [termsSign],
      });
      
      await publicClient.waitForTransactionReceipt({ hash: lockHash });
      console.log(`  ✅ Terms locked!`);

    } catch (error: any) {
      console.error(`  ❌ Failed: ${error.message}`);
    }
  }

  // Summary
  console.log(`\n=== Summary ===`);
  console.log(`Chain: Sepolia (${chainId})`);
  console.log(`Worker/Oracle: ${deployer}`);
  console.log(`FundFactory: ${FUND_FACTORY_ADDRESS}`);
  console.log(`\nCreated Funds:`);
  for (const fund of createdFunds) {
    console.log(`  ${fund.name}`);
    console.log(`    Address: ${fund.address}`);
    console.log(`    Token:   ${fund.token}`);
  }
  console.log(`\n===============\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
