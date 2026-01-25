# Payeer

Payeer is a decentralized application (dApp) built on the Base blockchain that allows a group of friends to randomly select one person to pay the bill.

## Features

- **Add Participants**: Add names of people sharing the bill.
- **Random Selection**: Fairly and randomly select one person to pay.
- **Reset**: Clear the list for a new round.

## Tech Stack

- **Solidity**: Smart Contract
- **Hardhat**: Development Environment
- **Base Sepolia**: Testnet for deployment

## Prerequisites

- Node.js installed
- A wallet with Base Sepolia ETH

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Gbangbolaoluwagbemiga/sequoia.git
   cd sequoia
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add your private key:
   ```env
   PRIVATE_KEY=your_private_key_here
   ```

## Usage

### Compile Contract

```bash
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

### Deploy to Base Sepolia

```bash
npx hardhat run scripts/deploy.js --network baseSepolia
```

### Deploy to Base Mainnet

```bash
npx hardhat run scripts/deploy.js --network base
```

## Contract Address

`0xaA101687765a8e379b1686404950b253Aa5517E1` (Base Mainnet)
`0x49879D6e369920C62bbB211826F21720BCAbF696` (Base Sepolia)

## Features (v2)

- **Sessions**: Create multiple betting sessions with custom titles.
- **ERC20 Support**: Users can bet with any ERC20 token (e.g., USDC) or ETH.
- **Platform Fees**: A 1% fee is collected from the pot to support the platform.
- **Cancellation & Refunds**: Creators can cancel sessions, and participants can claim full refunds.
- **Taunts**: Add a fun message when you join!

## Features (v3)

- **Nicknames**: Set a global nickname for your address.
- **Session Timeouts**: Sessions expire after 7 days, allowing participants to claim refunds if no winner is selected.
- **Private Sessions**: Create password-protected sessions for private groups.
- **Emergency Pause**: Contract owner can pause critical functions in case of emergency.
