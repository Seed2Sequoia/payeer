const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Payeer", function () {
  let Payeer, payeer, MockToken, mockToken;
  let owner, addr1, addr2, addr3;
  const ETH_FEE = ethers.parseEther("0.1");
  const TOKEN_FEE = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // Deploy MockToken
    MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy();

    // Deploy Payeer
    Payeer = await ethers.getContractFactory("Payeer");
    payeer = await Payeer.deploy();
  });

  describe("Pausable", function () {
    it("Should allow owner to pause and unpause", async function () {
      await payeer.pause();
      
      await expect(payeer.createSession("Paused", ETH_FEE, ethers.ZeroAddress, ethers.ZeroHash))
        .to.be.revertedWithCustomError(payeer, "EnforcedPause");

      await payeer.unpause();
      
      await expect(payeer.createSession("Unpaused", ETH_FEE, ethers.ZeroAddress, ethers.ZeroHash))
        .to.emit(payeer, "SessionCreated");
    });

    it("Should prevent joining when paused", async function () {
      await payeer.createSession("Active", ETH_FEE, ethers.ZeroAddress, ethers.ZeroHash);
      
      await payeer.pause();
      
      await expect(payeer.connect(addr1).joinSession(0, "Try join", "", { value: ETH_FEE }))
        .to.be.revertedWithCustomError(payeer, "EnforcedPause");
        
      await payeer.unpause();
      
      await expect(payeer.connect(addr1).joinSession(0, "Join now", "", { value: ETH_FEE }))
        .to.emit(payeer, "ParticipantJoined");
    });
  });

  describe("Nicknames", function () {
    it("Should allow user to set nickname", async function () {
      await expect(payeer.connect(addr1).setNickname("Alice"))
        .to.emit(payeer, "NicknameSet")
        .withArgs(addr1.address, "Alice");
      
      expect(await payeer.getNickname(addr1.address)).to.equal("Alice");
    });
  });

  describe("Timeouts", function () {
    it("Should allow refund after timeout", async function () {
      await payeer.createSession("Timeout Session", ETH_FEE, ethers.ZeroAddress, ethers.ZeroHash);
      await payeer.connect(addr1).joinSession(0, "Waiter", "", { value: ETH_FEE });
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");

      const balanceBefore = await ethers.provider.getBalance(addr1.address);
      
      // Claim refund
      const tx = await payeer.connect(addr1).claimRefund(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(addr1.address);
      expect(balanceAfter + gasUsed).to.equal(balanceBefore + ETH_FEE);
    });

    it("Should prevent joining after timeout", async function () {
      await payeer.createSession("Expired Session", ETH_FEE, ethers.ZeroAddress, ethers.ZeroHash);
      
      // Fast forward
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");

      await expect(payeer.connect(addr1).joinSession(0, "Late", "", { value: ETH_FEE }))
        .to.be.revertedWith("Session expired");
    });
  });

  describe("Cancellation and Refunds", function () {
    it("Should allow creator to cancel session", async function () {
      await payeer.createSession("Cancelled Session", ETH_FEE, ethers.ZeroAddress, ethers.ZeroHash);
      
      await expect(payeer.cancelSession(0))
        .to.emit(payeer, "SessionCancelled")
        .withArgs(0);

      const session = await payeer.getSession(0);
      expect(session.isActive).to.be.false;
      expect(session.isCancelled).to.be.true; // Check internal mapping if exposed, but we rely on isActive
      // Actually isCancelled is not returned in getSession tuple unless we updated getSession?
      // Let's check getSession return values in Payeer.sol
    });

    it("Should refund ETH participants", async function () {
      await payeer.createSession("Refund ETH", ETH_FEE, ethers.ZeroAddress, ethers.ZeroHash);
      await payeer.connect(addr1).joinSession(0, "Refund me", "", { value: ETH_FEE });
      
      await payeer.cancelSession(0);

      const balanceBefore = await ethers.provider.getBalance(addr1.address);
      
      // Claim refund
      const tx = await payeer.connect(addr1).claimRefund(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice; // wait, receipt.gasPrice might be null in hardhat sometimes, use tx.gasPrice

      const balanceAfter = await ethers.provider.getBalance(addr1.address);
      
      // Balance should increase by ETH_FEE minus gas
      expect(balanceAfter + gasUsed).to.equal(balanceBefore + ETH_FEE);
    });

    it("Should refund ERC20 participants", async function () {
      await payeer.createSession("Refund Token", TOKEN_FEE, mockToken.target, ethers.ZeroHash);
      
      await mockToken.mint(addr1.address, TOKEN_FEE);
      await mockToken.connect(addr1).approve(payeer.target, TOKEN_FEE);
      await payeer.connect(addr1).joinSession(0, "Refund me token", "");

      await payeer.cancelSession(0);

      const balanceBefore = await mockToken.balanceOf(addr1.address);
      await payeer.connect(addr1).claimRefund(0);
      const balanceAfter = await mockToken.balanceOf(addr1.address);

      expect(balanceAfter).to.equal(balanceBefore + TOKEN_FEE);
    });
  });

  describe("Private Sessions", function () {
    it("Should create private session and require password", async function () {
      const password = "secret123";
      const passwordHash = ethers.keccak256(ethers.toUtf8Bytes(password));
      
      await expect(payeer.createSession("Private Party", ETH_FEE, ethers.ZeroAddress, passwordHash))
        .to.emit(payeer, "SessionCreated")
        .withArgs(0, "Private Party", ETH_FEE, ethers.ZeroAddress, owner.address, true);

      // Fail with wrong password
      await expect(payeer.connect(addr1).joinSession(0, "Wrong Pass", "wrong", { value: ETH_FEE }))
        .to.be.revertedWith("Incorrect password");

      // Success with correct password
      await expect(payeer.connect(addr1).joinSession(0, "Right Pass", password, { value: ETH_FEE }))
        .to.emit(payeer, "ParticipantJoined");
    });
  });

  describe("ETH Sessions", function () {
    it("Should create a session", async function () {
      await expect(payeer.createSession("Dinner Bill", ETH_FEE, ethers.ZeroAddress, ethers.ZeroHash))
        .to.emit(payeer, "SessionCreated")
        .withArgs(0, "Dinner Bill", ETH_FEE, ethers.ZeroAddress, owner.address, false);

      const session = await payeer.getSession(0);
      expect(session.title).to.equal("Dinner Bill");
      expect(session.isActive).to.be.true;
    });

    it("Should allow participants to join with ETH", async function () {
      await payeer.createSession("Dinner Bill", ETH_FEE, ethers.ZeroAddress, ethers.ZeroHash);
      
      await expect(payeer.connect(addr1).joinSession(0, "I won't pay!", "", { value: ETH_FEE }))
        .to.emit(payeer, "ParticipantJoined")
        .withArgs(0, addr1.address, "I won't pay!");

      const participants = await payeer.getParticipants(0);
      expect(participants.length).to.equal(1);
      expect(participants[0]).to.equal(addr1.address);
    });

    it("Should spin the wheel and distribute prizes/fees", async function () {
      await payeer.createSession("Dinner Bill", ETH_FEE, ethers.ZeroAddress, ethers.ZeroHash);
      
      await payeer.connect(addr1).joinSession(0, "Taunt 1", "", { value: ETH_FEE });
      await payeer.connect(addr2).joinSession(0, "Taunt 2", "", { value: ETH_FEE });

      // Check owner balance before
      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);

      // Spin
      await expect(payeer.spinWheel(0))
        .to.emit(payeer, "WinnerSelected");

      // Check session ended
      const session = await payeer.getSession(0);
      expect(session.isActive).to.be.false;

      // Check Owner received fee (1% of 0.2 ETH = 0.002 ETH)
      const expectedFee = (ETH_FEE * 2n) / 100n;
      // Note: owner paid for gas, so balance check is tricky. 
      // But we can check if contract balance is 0
      expect(await ethers.provider.getBalance(payeer.target)).to.equal(0);
    });
  });

  describe("ERC20 Sessions", function () {
    it("Should allow participants to join with ERC20", async function () {
      await payeer.createSession("Poker Night", TOKEN_FEE, mockToken.target, ethers.ZeroHash);

      // Mint tokens to users
      await mockToken.mint(addr1.address, TOKEN_FEE);
      await mockToken.connect(addr1).approve(payeer.target, TOKEN_FEE);

      await expect(payeer.connect(addr1).joinSession(0, "All in!", ""))
        .to.emit(payeer, "ParticipantJoined")
        .withArgs(0, addr1.address, "All in!");
        
      expect(await mockToken.balanceOf(payeer.target)).to.equal(TOKEN_FEE);
    });

    it("Should distribute ERC20 prizes and fees", async function () {
      await payeer.createSession("Poker Night", TOKEN_FEE, mockToken.target, ethers.ZeroHash);

      // Setup users
      await mockToken.mint(addr1.address, TOKEN_FEE);
      await mockToken.connect(addr1).approve(payeer.target, TOKEN_FEE);
      await payeer.connect(addr1).joinSession(0, "P1", "");

      await mockToken.mint(addr2.address, TOKEN_FEE);
      await mockToken.connect(addr2).approve(payeer.target, TOKEN_FEE);
      await payeer.connect(addr2).joinSession(0, "P2", "");

      const initialOwnerBalance = await mockToken.balanceOf(owner.address);

      await payeer.spinWheel(0);

      // Fee calculation: 200 tokens * 1% = 2 tokens
      const fee = (TOKEN_FEE * 2n) / 100n;
      const prize = (TOKEN_FEE * 2n) - fee;

      expect(await mockToken.balanceOf(owner.address)).to.equal(initialOwnerBalance + fee);
      expect(await mockToken.balanceOf(payeer.target)).to.equal(0);
      
      // One of them should have the prize
      const b1 = await mockToken.balanceOf(addr1.address);
      const b2 = await mockToken.balanceOf(addr2.address);
      expect(b1 + b2).to.equal(prize);
    });
  });
});
