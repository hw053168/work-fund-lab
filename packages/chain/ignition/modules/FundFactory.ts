import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import hre from "hardhat";

const SWAP_ROUTERS: Record<string, string> = {
  mainnet: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  sepolia: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
  hardhat: "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Default to Mainnet for local dev
};

const PRICE_REGISTRIES: Record<string, string> = {
  mainnet: "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf",
  sepolia: "0x25cd50874192263b2b549041ede463aa9466e282",
  hardhat: "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf", // Default to Mainnet for local dev
};

export default buildModule("FundFactory", (m) => {
  // Hardhat v3: Use hre.globalOptions.network instead of hre.network.name
  const networkName = hre.globalOptions.network;
  console.log("[FundFactory] Detected network:", networkName);
  
  const defaultRouter = SWAP_ROUTERS[networkName] || SWAP_ROUTERS.mainnet;
  const defaultRegistry = PRICE_REGISTRIES[networkName] || PRICE_REGISTRIES.mainnet;
  
  console.log("[FundFactory] Default router:", defaultRouter);
  console.log("[FundFactory] Default registry:", defaultRegistry);

  // Define a parameter 'swapRouter' with a default value based on the network
  const swapRouterAddress = m.getParameter("swapRouter", defaultRouter);
  
  // Define a parameter 'priceRegistry' with a default value based on the network
  const priceRegistryAddress = m.getParameter("priceRegistry", defaultRegistry);

  // Pass the router and registry addresses to the Fund constructor
  const fundImplementation = m.contract("Fund", [swapRouterAddress, priceRegistryAddress]);

  // Deploy the factory with the implementation
  const fundFactory = m.contract("FundFactory", [fundImplementation]);

  return { fundImplementation, fundFactory };
});
