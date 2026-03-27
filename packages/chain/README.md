# `work-fund-lab` Contracts

## Usage

### Running Tests

To run all the tests in the project, execute the following command:

```shell
npx hardhat test
```

You can also selectively run the Solidity or `node:test` tests:

```shell
npx hardhat test solidity
npx hardhat test nodejs
```

### Deploying/Testing Locally

To run the deployment to a local chain:

```shell
npx hardhat ignition deploy --network localhost ignition/modules/FundFactory.ts
npx hardhat ignition deploy --network localhost ignition/modules/FundToken.ts
```

To create a test environment with a ready-made fund (runs the above automatically):

```shell
npx hardhat run --no-compile --network localhost scripts/DeployTestEnv.ts
```

To synchronize the contract ABIs to the dApp:

```shell
npx hardhat run --no-compile scripts/SyncAbis.ts
```

### Deploying to Testnet

To run the deployment to Sepolia:

```shell
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npx hardhat ignition deploy --network sepolia ignition/modules/FundFactory.ts
npx hardhat ignition deploy --network sepolia ignition/modules/FundToken.ts
```

Then, optionally to verify it on Etherscan:

```shell
npx hardhat keystore set ETHERSCAN_API_KEY
npx hardhat ignition verify --network sepolia chain-11155111
npx hardhat ignition deploy --verify --network sepolia ignition/modules/FundFactory.ts
npx hardhat ignition deploy --verify --network sepolia ignition/modules/FundToken.ts
```

## Sepolia Contract Addresses

### Core Contracts

| Contract | Address | Etherscan |
|----------|---------|-----------|
| Fund (Implementation) | `0x8c088eB37ef00DdD4D3fa06A65d32f127cB813e4` | [View](https://sepolia.etherscan.io/address/0x8c088eB37ef00DdD4D3fa06A65d32f127cB813e4) |
| FundFactory | `0x0fFBB917970CD533714D67eC79897C12d54a3bD5` | [View](https://sepolia.etherscan.io/address/0x0fFBB917970CD533714D67eC79897C12d54a3bD5) |
| PriceFeedRegistry | `0x25cd50874192263b2b549041ede463aa9466e282` | [View](https://sepolia.etherscan.io/address/0x25cd50874192263b2b549041ede463aa9466e282) |

### Test Tokens (Our Deployed)

| Token | Address | Etherscan |
|-------|---------|-----------|
| Test FUND$ | `0x4cbe3d15b89ef1bcd7b0f7e964b681b55c4457a9` | [View](https://sepolia.etherscan.io/address/0x4cbe3d15b89ef1bcd7b0f7e964b681b55c4457a9) |
| Test USDC | `0x23055b5ae3ea9565d0a71663a729c6a8922c23fc` | [View](https://sepolia.etherscan.io/address/0x23055b5ae3ea9565d0a71663a729c6a8922c23fc) |
| Test USDT | `0x2b48e781c1672996c23780d60a5d423a3a1e478e` | [View](https://sepolia.etherscan.io/address/0x2b48e781c1672996c23780d60a5d423a3a1e478e) |
| Test WETH | `0xc836d8ea42daec2a659d10eea8b7ff8dc4f6d5db` | [View](https://sepolia.etherscan.io/address/0xc836d8ea42daec2a659d10eea8b7ff8dc4f6d5db) |

### Network Tokens (Circle/Wrapped)

| Token | Address | Etherscan |
|-------|---------|-----------|
| Circle USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | [View](https://sepolia.etherscan.io/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238) |
| Wrapped ETH | `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9` | [View](https://sepolia.etherscan.io/address/0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9) |

### Chainlink Price Feeds

| Feed | Address | Etherscan |
|------|---------|-----------|
| ETH/USD | `0x694AA1769357215DE4FAC081bf1f309aDC325306` | [View](https://sepolia.etherscan.io/address/0x694AA1769357215DE4FAC081bf1f309aDC325306) |
| USDC/USD | `0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E` | [View](https://sepolia.etherscan.io/address/0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E) |

### External DeFi

| Contract | Address | Etherscan |
|----------|---------|-----------|
| Uniswap V3 SwapRouter | `0xE592427A0AEce92De3Edee1F18E0157C05861564` | [View](https://sepolia.etherscan.io/address/0xE592427A0AEce92De3Edee1F18E0157C05861564) |

## Checking Status on Etherscan

### Check Fund Status

1. Go to the fund address on Etherscan (e.g., `https://sepolia.etherscan.io/address/<FUND_ADDRESS>`)
2. Click **"Read as Proxy"** tab (funds are proxy contracts)
3. Key functions to check:
   - `status()` - Returns: 0=pending, 1=active, 2=complete, 3=refunding
   - `payoutToken()` - The token address for payouts
   - `worker()` - Worker address
   - `oracle()` - Oracle address
   - `terms()` - IPFS CID of the terms document

### Check Token Balance

1. Go to the token contract on Etherscan
2. Click **"Read Contract"** tab
3. Call `balanceOf(address)` with the fund or wallet address

### Check FundFactory Funds

1. Go to FundFactory on Etherscan: [0x0fFBB917970CD533714D67eC79897C12d54a3bD5](https://sepolia.etherscan.io/address/0x0fFBB917970CD533714D67eC79897C12d54a3bD5)
2. Click **"Read Contract"** tab
3. Call `fundsCount()` to see total funds created
4. Call `funds(index)` with index 0, 1, 2... to get fund addresses

### Check Price Feed Registry

1. Go to PriceFeedRegistry: [0x25cd50874192263b2b549041ede463aa9466e282](https://sepolia.etherscan.io/address/0x25cd50874192263b2b549041ede463aa9466e282)
2. Click **"Read Contract"** tab
3. Call `getPrice(tokenAddress)` to get current price (8 decimals)
4. Call `tokenFeeds(tokenAddress)` to see Chainlink feed + mock price config

### View Transaction History

1. Go to any contract/fund address
2. Click **"Events"** tab to see all emitted events
3. Or click **"Internal Txns"** to see contract-to-contract calls

### Deployer Wallet

| Wallet | Address | Etherscan |
|--------|---------|-----------|
| Deployer | `0xE05C5dA500AA1f828aEF9d030aE52E66B7B05e82` | [View](https://sepolia.etherscan.io/address/0xE05C5dA500AA1f828aEF9d030aE52E66B7B05e82) |

## Scripts Reference

### Deployment Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `DeployTestEnv.ts` | `npx hardhat run --network localhost scripts/DeployTestEnv.ts` | Creates a complete local test environment with FundFactory, tokens, and a sample fund |
| `DeployRegistry.ts` | `npx hardhat run --network sepolia scripts/DeployRegistry.ts` | Deploys PriceFeedRegistry and configures all token price feeds (Chainlink + mocks) |

### Fund Management Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `CreateSepoliaFunds.ts` | `npx hardhat run --network sepolia scripts/CreateSepoliaFunds.ts` | Creates test funds on Sepolia with different payout tokens. Set `DEPLOY_TEST_TOKENS=true` to also deploy test tokens |
| `DumpFunds.ts` | `npx hardhat run --network localhost scripts/DumpFunds.ts` | Exports all funds from localhost FundFactory to `funds-dump.json` |

### Token Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `MintTestTokens.ts` | `npx hardhat run --network sepolia scripts/MintTestTokens.ts` | Mints test tokens (FUND$, USDC, USDT, WETH) to a wallet address on Sepolia |
| `RefreshMockPrices.ts` | `npx hardhat run --network sepolia scripts/RefreshMockPrices.ts` | Refreshes stale mock prices in PriceFeedRegistry |

### Utility Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `SyncAbis.ts` | `npx hardhat run --no-compile scripts/SyncAbis.ts` | Syncs contract ABIs and addresses to the dApp (`packages/dapp/chain/contracts.ts`) |
| `SyncPrice.ts` | `npx tsx scripts/SyncPrice.ts` | Fetches current prices from Chainlink Mainnet feeds (ETH, USDC, USDT) - reference only |
| `UploadTermsToPinata.ts` | `npx tsx scripts/UploadTermsToPinata.ts` | Interactive CLI to create and upload fund terms JSON to IPFS via Pinata |

### Archived Scripts

One-time debug/fix scripts moved to `scripts/archive/`:
- `GetAccounts.ts` - Lists Hardhat accounts (use `npx hardhat accounts` instead)
- `DebugFund.ts` - Debug script for inspecting a specific fund
- `FixFundUSDCFeed.ts` - One-time fix for USDC price feed on a specific fund
- `LockTermsTest.ts` - One-time test for lock-terms flow

### Script Prerequisites

**For Sepolia scripts:**
```shell
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

**For Pinata upload:**
```shell
# Set environment variables (or source from dapp/.env.local)
export NEXT_PUBLIC_PINATA_JWT="your-jwt-token"
export NEXT_PUBLIC_GATEWAY_URL="your-gateway-url"
```
