require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.19",
  networks: {
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : (process.env['PRIVATE-KEY'] ? [process.env['PRIVATE-KEY']] : []),
    },
  },
  etherscan: {
    apiKey: process.env.BASESCAN_API_KEY || "C9CFD5REN63QS5AESUEF3WJ6EPPWJ2UN9R",
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      }
    ]
  },
};
