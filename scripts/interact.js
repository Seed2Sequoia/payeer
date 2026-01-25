const hre = require("hardhat");

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    console.error("Please set CONTRACT_ADDRESS in .env");
    return;
  }
  
  const Payeer = await hre.ethers.getContractFactory("Payeer");
  const payeer = await Payeer.attach(contractAddress);
  console.log("Attached to Payeer at:", contractAddress);

  // Read state
  const nextSessionId = await payeer.nextSessionId();
  console.log("Next Session ID:", nextSessionId.toString());
  
  const platformFee = await payeer.platformFeePercentage();
  console.log("Platform Fee:", platformFee.toString() + "%");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
