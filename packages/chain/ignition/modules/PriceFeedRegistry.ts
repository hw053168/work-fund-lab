import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("PriceFeedRegistry", (m) => {
  // Deploy the centralized price feed registry
  const registry = m.contract("PriceFeedRegistry", []);

  return { registry };
});
