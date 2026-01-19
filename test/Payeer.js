const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Payeer", function () {
  let Payeer;
  let payeer;
  let owner;
  let addr1;
  let addr2;
  let addr3;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    Payeer = await ethers.getContractFactory("Payeer");
    payeer = await Payeer.deploy();
  });

  it("Should create a new session", async function () {
    const entryFee = ethers.parseEther("1");
    await payeer.createSession(entryFee);

    // Check nextSessionId incremented
    expect(await payeer.nextSessionId()).to.equal(1);

    // Check session details
    const session = await payeer.getSession(0);
    expect(session.entryFee).to.equal(entryFee);
    expect(session.isActive).to.equal(true);
    expect(session.participantCount).to.equal(0);
  });

  it("Should allow participants to join", async function () {
    const entryFee = ethers.parseEther("1");
    await payeer.createSession(entryFee);

    await payeer.connect(addr1).joinSession(0, "I win!", { value: entryFee });
    await payeer.connect(addr2).joinSession(0, "No, I win!", { value: entryFee });

    const participants = await payeer.getParticipants(0);
    expect(participants.length).to.equal(2);
    expect(participants[0]).to.equal(addr1.address);
    expect(participants[1]).to.equal(addr2.address);

    // Check contract balance
    const contractBalance = await ethers.provider.getBalance(payeer.target);
    expect(contractBalance).to.equal(ethers.parseEther("2"));
  });

  it("Should fail if entry fee is incorrect", async function () {
    const entryFee = ethers.parseEther("1");
    await payeer.createSession(entryFee);

    await expect(
      payeer.connect(addr1).joinSession(0, "Fail", { value: ethers.parseEther("0.5") })
    ).to.be.revertedWith("Incorrect entry fee");
  });

  it("Should pick a winner and distribute funds", async function () {
    const entryFee = ethers.parseEther("1");
    await payeer.createSession(entryFee);

    await payeer.connect(addr1).joinSession(0, "A", { value: entryFee });
    await payeer.connect(addr2).joinSession(0, "B", { value: entryFee });
    await payeer.connect(addr3).joinSession(0, "C", { value: entryFee });

    // Track balances before spin
    const balanceBefore1 = await ethers.provider.getBalance(addr1.address);
    const balanceBefore2 = await ethers.provider.getBalance(addr2.address);
    const balanceBefore3 = await ethers.provider.getBalance(addr3.address);

    const tx = await payeer.spinWheel(0);
    await tx.wait();

    const session = await payeer.getSession(0);
    expect(session.isActive).to.equal(false);
    expect(session.totalPool).to.equal(0);
    expect(session.winner).to.not.equal(ethers.ZeroAddress);

    // One of them should have won 3 ETH (minus gas fees strictly speaking, but let's check contract logic)
    // Checking exact balances is hard due to gas fees.
    // Let's create a non-miner/non-tx-sender account check to avoid gas confusion if possible,
    // or just check the event logs.

    // Using event check:
    const receipt = await tx.wait();
    // Ethers v6 event parsing might need specific handling or we can just trust the state check above for now.
    // But let's verify the contract balance is zero.
    const contractBalance = await ethers.provider.getBalance(payeer.target);
    expect(contractBalance).to.equal(0);
  });
});
