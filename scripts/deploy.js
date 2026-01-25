const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const Payeer = await hre.ethers.getContractFactory("Payeer");
  const payeer = await Payeer.deploy();

  await payeer.waitForDeployment();

  console.log("Payeer deployed to:", await payeer.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
