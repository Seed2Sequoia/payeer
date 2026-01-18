const hre = require("hardhat");
const { ethers } = require("hardhat");

const PAYEER_ADDRESS = "0x54290C255108E547877C630cC55b23a2A62a2dAF";

async function main() {
    console.log("🚀 Starting Payeer Test Interaction Script\n");

    // Generate a new master wallet
    const masterWallet = ethers.Wallet.createRandom();
    console.log("🔑 Master Wallet Generated:");
    console.log("   Address:", masterWallet.address);
    console.log("   Mnemonic:", masterWallet.mnemonic.phrase);
    console.log("   Private Key:", masterWallet.privateKey);
    console.log("\n");

    // Derive 12 accounts from the master wallet
    const accounts = [];
    for (let i = 0; i < 12; i++) {
        const path = `m/44'/60'/0'/0/${i}`;
        const wallet = ethers.HDNodeWallet.fromMnemonic(
            ethers.Mnemonic.fromPhrase(masterWallet.mnemonic.phrase),
            path
        );
        accounts.push(wallet);
    }

    console.log("👥 Generated 12 Accounts:");
    accounts.forEach((acc, i) => {
        console.log(`   Account ${i}: ${acc.address}`);
    });
    console.log("\n");

    // Get the deployer/funder account from hardhat config
    const [funder] = await ethers.getSigners();
    console.log("💰 Funder Account:", funder.address);

    // Check funder balance
    const funderBalance = await ethers.provider.getBalance(funder.address);
    console.log("   Balance:", ethers.formatEther(funderBalance), "ETH\n");

    // Fund each account with 0.0005 ETH
    console.log("💸 Funding accounts with 0.0005 ETH each...");
    const fundAmount = ethers.parseEther("0.0005");

    for (let i = 0; i < accounts.length; i++) {
        const tx = await funder.sendTransaction({
            to: accounts[i].address,
            value: fundAmount,
        });
        await tx.wait();
        console.log(`   ✅ Funded Account ${i}: ${accounts[i].address}`);
    }
    console.log("\n");

    // Connect accounts to provider
    const connectedAccounts = accounts.map(acc => acc.connect(ethers.provider));

    // Get contract instance
    const Payeer = await ethers.getContractFactory("Payeer");

    // Available functions for interaction:
    // 1. createSession(uint256 _entryFee)
    // 2. joinSession(uint256 _sessionId) - payable
    // 3. spinWheel(uint256 _sessionId)
    // 4. getSession(uint256 _sessionId) - view
    // 5. getParticipants(uint256 _sessionId) - view

    const interactionFunctions = [
        { name: "createSession", type: "write" },
        { name: "joinSession", type: "write" },
        { name: "spinWheel", type: "write" },
        { name: "getSession", type: "read" },
        { name: "getParticipants", type: "read" }
    ];

    // Track created sessions
    const createdSessions = [];
    let nextSessionId = 0;

    console.log("🎲 Starting Random Interactions (2 per account)...\n");

    for (let i = 0; i < connectedAccounts.length; i++) {
        const account = connectedAccounts[i];
        const payeer = Payeer.attach(PAYEER_ADDRESS).connect(account);

        console.log(`\n📍 Account ${i} (${account.address}):`);

        // Randomly select 2 different functions
        const shuffled = [...interactionFunctions].sort(() => Math.random() - 0.5);
        const selectedFunctions = shuffled.slice(0, 2);

        for (const func of selectedFunctions) {
            try {
                if (func.name === "createSession") {
                    const entryFee = ethers.parseEther("0.0001");
                    const tx = await payeer.createSession(entryFee);
                    await tx.wait();
                    createdSessions.push(nextSessionId);
                    console.log(`   ✅ Created Session #${nextSessionId} with entry fee 0.0001 ETH`);
                    nextSessionId++;

                } else if (func.name === "joinSession") {
                    if (createdSessions.length > 0) {
                        const sessionId = createdSessions[Math.floor(Math.random() * createdSessions.length)];
                        const sessionData = await payeer.getSession(sessionId);
                        const entryFee = sessionData[0];
                        const isActive = sessionData[1];

                        if (isActive) {
                            const tx = await payeer.joinSession(sessionId, { value: entryFee });
                            await tx.wait();
                            console.log(`   ✅ Joined Session #${sessionId}`);
                        } else {
                            console.log(`   ⚠️  Session #${sessionId} is not active, skipping join`);
                        }
                    } else {
                        console.log(`   ⚠️  No sessions available to join`);
                    }

                } else if (func.name === "spinWheel") {
                    if (createdSessions.length > 0) {
                        const sessionId = createdSessions[Math.floor(Math.random() * createdSessions.length)];
                        const sessionData = await payeer.getSession(sessionId);
                        const isActive = sessionData[1];
                        const participantCount = sessionData[4];

                        if (isActive && participantCount > 0n) {
                            const tx = await payeer.spinWheel(sessionId);
                            await tx.wait();
                            console.log(`   ✅ Spun Wheel for Session #${sessionId}`);
                            // Remove from active sessions
                            const index = createdSessions.indexOf(sessionId);
                            if (index > -1) createdSessions.splice(index, 1);
                        } else {
                            console.log(`   ⚠️  Session #${sessionId} cannot be spun (inactive or no participants)`);
                        }
                    } else {
                        console.log(`   ⚠️  No sessions available to spin`);
                    }

                } else if (func.name === "getSession") {
                    if (nextSessionId > 0) {
                        const sessionId = Math.floor(Math.random() * nextSessionId);
                        const sessionData = await payeer.getSession(sessionId);
                        console.log(`   ✅ Read Session #${sessionId} - Active: ${sessionData[1]}, Participants: ${sessionData[4]}`);
                    } else {
                        console.log(`   ⚠️  No sessions exist yet`);
                    }

                } else if (func.name === "getParticipants") {
                    if (nextSessionId > 0) {
                        const sessionId = Math.floor(Math.random() * nextSessionId);
                        const participants = await payeer.getParticipants(sessionId);
                        console.log(`   ✅ Read Participants for Session #${sessionId} - Count: ${participants.length}`);
                    } else {
                        console.log(`   ⚠️  No sessions exist yet`);
                    }
                }

                // Small delay between interactions
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.log(`   ❌ Error executing ${func.name}:`, error.message.split('\n')[0]);
            }
        }
    }

    console.log("\n\n✨ Test Interaction Script Completed!");
    console.log("\n📊 Summary:");
    console.log(`   Total Sessions Created: ${nextSessionId}`);
    console.log(`   Active Sessions Remaining: ${createdSessions.length}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
