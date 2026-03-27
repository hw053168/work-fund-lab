import { createPublicClient, http, parseAbi, formatUnits, Address } from "viem";
import { sepolia } from "viem/chains";

// Fund addresses to check
const fundAddresses = [
  '0xadAF413FAB439E33861009CA4F49631181Cbd69A',
  '0x5d4d1E694DCdFDeC0F9fe531E8D8D21E4240675c',
] as const;

// Minimal ABIs
const FundABI = parseAbi([
  "function payoutToken() view returns (address)",
  "function treasuryTokens(uint256) view returns (address)",
  "function SWAP_ROUTER() view returns (address)",
  "function PRICE_REGISTRY() view returns (address)",
  "function owner() view returns (address)",
  "function oracle() view returns (address)",
  "function oracleCut() view returns (uint256)",
  "function closed() view returns (bool)",
]);

const ERC20ABI = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address, address) view returns (uint256)"
]);

async function main() {
  // Use a public RPC for Sepolia
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http("https://ethereum-sepolia-rpc.publicnode.com")
  });
  
  for (const fundAddress of fundAddresses) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`=== Fund: ${fundAddress} ===`);
    console.log(`${'='.repeat(60)}\n`);
    
    try {
      // 1. Get Fund Basics
      const [payoutToken, swapRouter, priceRegistry, owner, oracle, oracleCut, closed] = await Promise.all([
        publicClient.readContract({ address: fundAddress, abi: FundABI, functionName: 'payoutToken' }),
        publicClient.readContract({ address: fundAddress, abi: FundABI, functionName: 'SWAP_ROUTER' }),
        publicClient.readContract({ address: fundAddress, abi: FundABI, functionName: 'PRICE_REGISTRY' }),
        publicClient.readContract({ address: fundAddress, abi: FundABI, functionName: 'owner' }),
        publicClient.readContract({ address: fundAddress, abi: FundABI, functionName: 'oracle' }),
        publicClient.readContract({ address: fundAddress, abi: FundABI, functionName: 'oracleCut' }),
        publicClient.readContract({ address: fundAddress, abi: FundABI, functionName: 'closed' }),
      ]);
      
      console.log(`Owner: ${owner}`);
      console.log(`Oracle: ${oracle}`);
      console.log(`Oracle Cut: ${oracleCut}%`);
      console.log(`Closed: ${closed}`);
      console.log(`SWAP_ROUTER: ${swapRouter}`);
      console.log(`PRICE_REGISTRY: ${priceRegistry}`);
      
      // 2. Get Payout Token Details
      const [payoutSymbol, payoutDecimals, payoutBalance] = await Promise.all([
        publicClient.readContract({ address: payoutToken, abi: ERC20ABI, functionName: 'symbol' }),
        publicClient.readContract({ address: payoutToken, abi: ERC20ABI, functionName: 'decimals' }),
        publicClient.readContract({ address: payoutToken, abi: ERC20ABI, functionName: 'balanceOf', args: [fundAddress] }),
      ]);

      console.log(`\nPayout Token: ${payoutToken} (${payoutSymbol})`);
      console.log(`Fund Payout Balance: ${formatUnits(payoutBalance, payoutDecimals)} ${payoutSymbol}`);
      
      // 3. Get all treasury tokens
      console.log(`\n--- Treasury Tokens ---`);
      const treasuryTokens: Address[] = [];
      let idx = 0;
      while (true) {
        try {
          const token = await publicClient.readContract({ address: fundAddress, abi: FundABI, functionName: 'treasuryTokens', args: [BigInt(idx)] });
          treasuryTokens.push(token);
          idx++;
        } catch {
          break;
        }
      }
      
      if (treasuryTokens.length === 0) {
        console.log(`  No deposits found!`);
      } else {
        console.log(`Found ${treasuryTokens.length} treasury tokens:`);
        
        for (const token of treasuryTokens) {
          const [symbol, decimals, balance] = await Promise.all([
            publicClient.readContract({ address: token, abi: ERC20ABI, functionName: 'symbol' }),
            publicClient.readContract({ address: token, abi: ERC20ABI, functionName: 'decimals' }),
            publicClient.readContract({ address: token, abi: ERC20ABI, functionName: 'balanceOf', args: [fundAddress] }),
          ]);
          
          const isPayout = token.toLowerCase() === payoutToken.toLowerCase();
          console.log(`  ${token} (${symbol}): ${formatUnits(balance, decimals)} ${isPayout ? '(PAYOUT TOKEN)' : ''}`);
        }
      }
    } catch (error) {
      console.log(`Error reading fund: ${error}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
