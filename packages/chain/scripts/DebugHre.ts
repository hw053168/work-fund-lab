import hre from "hardhat";

async function main() {
  console.log("Network:", hre.network.name);
  console.log("Provider exists:", !!hre.network.provider);
}

main().catch(console.error);
