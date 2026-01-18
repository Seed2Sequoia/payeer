const hre = require("hardhat");
const { ethers } = require("hardhat");

const PAYEER_ADDRESS = "0x54290C255108E547877C630cC55b23a2A62a2dAF";

async function main() {
    console.log("🚀 Creating 10 Additional Test Accounts\n");

    // Generate a new master wallet for this batch
    const masterWallet = ethers.Wallet.createRandom();
    console.log("🔑 New Master Wallet Generated:");
    console.log("   Address:", masterWallet.address);
    console.log("   Mnemonic:", masterWallet.mnemonic.phrase);
    console.log("   Private Key:", masterWallet.privateKey);
    console.log("\n");

    // Derive 10 accounts from the master wallet
    const accounts = [];
    for (let i = 0; i < 10; i++) {
        const path = `m/44'/60'/0'/0/${i}`;
        const wallet = ethers.HDNodeWallet.fromMnemonic(
            ethers.Mnemonic.fromPhrase(masterWallet.mnemonic.phrase),
            path
        );
        accounts.push(wallet);
    }

    console.log("👥 Generated 10 Accounts:");
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

    // Get current nextSessionId from contract
    const payeerContract = Payeer.attach(PAYEER_ADDRESS).connect(funder);
    const currentSessionId = await payeerContract.nextSessionId();
    console.log(`📊 Current Session ID on contract: ${currentSessionId}\n`);

    // Available functions for interaction
    const interactionFunctions = [
        { name: "createSession", type: "write" },
        { name: "joinSession", type: "write" },
        { name: "spinWheel", type: "write" },
        { name: "getSession", type: "read" },
        { name: "getParticipants", type: "read" }
    ];

    // Track created sessions
    const createdSessions = [];
    let nextSessionId = Number(currentSessionId);

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
                    // Try to find an active session
                    let foundSession = false;

                    // First check our newly created sessions
                    for (const sessionId of createdSessions) {
                        try {
                            const sessionData = await payeer.getSession(sessionId);
                            const isActive = sessionData[1];

                            if (isActive) {
                                const entryFee = sessionData[0];
                                const tx = await payeer.joinSession(sessionId, { value: entryFee });
                                await tx.wait();
                                console.log(`   ✅ Joined Session #${sessionId}`);
                                foundSession = true;
                                break;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    // If no session found in our list, try existing sessions
                    if (!foundSession && nextSessionId > 0) {
                        for (let sid = 0; sid < nextSessionId; sid++) {
                            try {
                                const sessionData = await payeer.getSession(sid);
                                const isActive = sessionData[1];

                                if (isActive) {
                                    const entryFee = sessionData[0];
                                    const tx = await payeer.joinSession(sid, { value: entryFee });
                                    await tx.wait();
                                    console.log(`   ✅ Joined Session #${sid}`);
                                    foundSession = true;
                                    break;
                                }
                            } catch (e) {
                                continue;
                            }
                        }
                    }

                    if (!foundSession) {
                        console.log(`   ⚠️  No active sessions available to join`);
                    }

                } else if (func.name === "spinWheel") {
                    let foundSession = false;

                    // Try to spin a session with participants
                    for (let sid = 0; sid < nextSessionId; sid++) {
                        try {
                            const sessionData = await payeer.getSession(sid);
                            const isActive = sessionData[1];
                            const participantCount = sessionData[4];

                            if (isActive && participantCount > 0n) {
                                const tx = await payeer.spinWheel(sid);
                                await tx.wait();
                                console.log(`   ✅ Spun Wheel for Session #${sid} - Winner Selected!`);
                                // Remove from active sessions
                                const index = createdSessions.indexOf(sid);
                                if (index > -1) createdSessions.splice(index, 1);
                                foundSession = true;
                                break;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    if (!foundSession) {
                        console.log(`   ⚠️  No sessions available to spin (need active session with participants)`);
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

    console.log("\n\n✨ Additional Test Accounts Script Completed!");
    console.log("\n📊 Summary:");
    console.log(`   Starting Session ID: ${currentSessionId}`);
    console.log(`   Final Session ID: ${nextSessionId}`);
    console.log(`   New Sessions Created: ${nextSessionId - Number(currentSessionId)}`);
    console.log(`   Active Sessions Remaining: ${createdSessions.length}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
