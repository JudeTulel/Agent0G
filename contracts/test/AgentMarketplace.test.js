const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AI Agent Marketplace", function () {
  let agentRegistry, agentRental, usageTracking;
  let owner, agent1Owner, agent2Owner, renter1, renter2, computeProvider;
  let feeRecipient;

  beforeEach(async function () {
    // Get signers
    [owner, agent1Owner, agent2Owner, renter1, renter2, computeProvider, feeRecipient] = await ethers.getSigners();

    // Deploy AgentRegistry
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    agentRegistry = await AgentRegistry.deploy();
    await agentRegistry.waitForDeployment();

    // Deploy AgentRental
    const AgentRental = await ethers.getContractFactory("AgentRental");
    agentRental = await AgentRental.deploy(await agentRegistry.getAddress(), feeRecipient.address);
    await agentRental.waitForDeployment();

    // Deploy UsageTracking
    const UsageTracking = await ethers.getContractFactory("UsageTracking");
    usageTracking = await UsageTracking.deploy(
      await agentRegistry.getAddress(),
      await agentRental.getAddress()
    );
    await usageTracking.waitForDeployment();

    // Register compute provider
    await usageTracking.connect(owner).registerComputeProvider(
      computeProvider.address,
      "https://compute-provider.example.com"
    );
  });

  describe("AgentRegistry", function () {
    it("Should register a new agent", async function () {
      const tx = await agentRegistry.connect(agent1Owner).registerAgent(
        "Test Agent",
        "A test AI agent",
        "chatbot",
        "QmTestHash123",
        ethers.parseEther("0.1"), // 0.1 ETH per use
        ethers.parseEther("1.0")  // 1 ETH subscription
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'AgentRegistered');
      expect(event).to.not.be.undefined;

      const agentId = event.args[0];
      const agent = await agentRegistry.getAgent(agentId);

      expect(agent.name).to.equal("Test Agent");
      expect(agent.owner).to.equal(agent1Owner.address);
      expect(agent.category).to.equal("chatbot");
      expect(agent.pricePerUse).to.equal(ethers.parseEther("0.1"));
      expect(agent.subscriptionPrice).to.equal(ethers.parseEther("1.0"));
      expect(agent.isActive).to.be.true;
    });

    it("Should update an existing agent", async function () {
      // Register agent first
      const tx = await agentRegistry.connect(agent1Owner).registerAgent(
        "Test Agent",
        "A test AI agent",
        "chatbot",
        "QmTestHash123",
        ethers.parseEther("0.1"),
        ethers.parseEther("1.0")
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'AgentRegistered');
      const agentId = event.args[0];

      // Update agent
      await agentRegistry.connect(agent1Owner).updateAgent(
        agentId,
        "Updated Agent",
        "Updated description",
        ethers.parseEther("0.2"),
        ethers.parseEther("2.0")
      );

      const agent = await agentRegistry.getAgent(agentId);
      expect(agent.name).to.equal("Updated Agent");
      expect(agent.description).to.equal("Updated description");
      expect(agent.pricePerUse).to.equal(ethers.parseEther("0.2"));
      expect(agent.subscriptionPrice).to.equal(ethers.parseEther("2.0"));
    });

    it("Should add a review to an agent", async function () {
      // Register agent
      const tx = await agentRegistry.connect(agent1Owner).registerAgent(
        "Test Agent",
        "A test AI agent",
        "chatbot",
        "QmTestHash123",
        ethers.parseEther("0.1"),
        ethers.parseEther("1.0")
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'AgentRegistered');
      const agentId = event.args[0];

      // Add review
      await agentRegistry.connect(renter1).addReview(
        agentId,
        5,
        "Excellent agent!"
      );

      const reviews = await agentRegistry.getAgentReviews(agentId);
      expect(reviews.length).to.equal(1);
      expect(reviews[0].reviewer).to.equal(renter1.address);
      expect(reviews[0].rating).to.equal(5);
      expect(reviews[0].comment).to.equal("Excellent agent!");

      const agent = await agentRegistry.getAgent(agentId);
      expect(agent.rating).to.equal(500); // 5 * 100
      expect(agent.reviewCount).to.equal(1);
    });

    it("Should not allow owner to review their own agent", async function () {
      // Register agent
      const tx = await agentRegistry.connect(agent1Owner).registerAgent(
        "Test Agent",
        "A test AI agent",
        "chatbot",
        "QmTestHash123",
        ethers.parseEther("0.1"),
        ethers.parseEther("1.0")
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'AgentRegistered');
      const agentId = event.args[0];

      // Try to add review as owner
      await expect(
        agentRegistry.connect(agent1Owner).addReview(agentId, 5, "Great!")
      ).to.be.revertedWith("Cannot review own agent");
    });
  });

  describe("AgentRental", function () {
    let agentId;

    beforeEach(async function () {
      // Register an agent for testing
      const tx = await agentRegistry.connect(agent1Owner).registerAgent(
        "Test Agent",
        "A test AI agent",
        "chatbot",
        "QmTestHash123",
        ethers.parseEther("0.1"), // 0.1 ETH per use
        ethers.parseEther("1.0")  // 1 ETH subscription
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'AgentRegistered');
      agentId = event.args[0];
    });

    it("Should rent an agent with pay-per-use model", async function () {
      const maxUsage = 5;
      const totalCost = ethers.parseEther("0.5"); // 0.1 * 5

      const tx = await agentRental.connect(renter1).rentAgentPayPerUse(
        agentId,
        maxUsage,
        { value: totalCost }
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'RentalCreated');
      expect(event).to.not.be.undefined;

      const rentalId = event.args[0];
      const rental = await agentRental.getRental(rentalId);

      expect(rental.agentId).to.equal(agentId);
      expect(rental.renter).to.equal(renter1.address);
      expect(rental.rentalType).to.equal(0); // PAY_PER_USE
      expect(rental.amount).to.equal(totalCost);
      expect(rental.maxUsage).to.equal(maxUsage);
    });

    it("Should rent an agent with subscription model", async function () {
      const duration = 30 * 24 * 60 * 60; // 30 days
      const subscriptionCost = ethers.parseEther("1.0");

      const tx = await agentRental.connect(renter1).rentAgentSubscription(
        agentId,
        duration,
        { value: subscriptionCost }
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'RentalCreated');
      const rentalId = event.args[0];
      const rental = await agentRental.getRental(rentalId);

      expect(rental.agentId).to.equal(agentId);
      expect(rental.renter).to.equal(renter1.address);
      expect(rental.rentalType).to.equal(1); // SUBSCRIPTION
      expect(rental.amount).to.equal(subscriptionCost);
      expect(rental.maxUsage).to.equal(0); // Unlimited for subscription
    });

    it("Should allow agent usage within limits", async function () {
      const maxUsage = 3;
      const totalCost = ethers.parseEther("0.3");

      // Rent agent
      const tx = await agentRental.connect(renter1).rentAgentPayPerUse(
        agentId,
        maxUsage,
        { value: totalCost }
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'RentalCreated');
      const rentalId = event.args[0];

      // Use agent
      await agentRental.connect(renter1).useAgent(rentalId);
      await agentRental.connect(renter1).useAgent(rentalId);

      const rental = await agentRental.getRental(rentalId);
      expect(rental.usageCount).to.equal(2);
      expect(rental.status).to.equal(0); // ACTIVE

      // Use agent one more time to reach limit
      await agentRental.connect(renter1).useAgent(rentalId);

      const finalRental = await agentRental.getRental(rentalId);
      expect(finalRental.usageCount).to.equal(3);
      expect(finalRental.status).to.equal(1); // COMPLETED
    });

    it("Should not allow usage beyond limits", async function () {
      const maxUsage = 2;
      const totalCost = ethers.parseEther("0.2");

      // Rent agent
      const tx = await agentRental.connect(renter1).rentAgentPayPerUse(
        agentId,
        maxUsage,
        { value: totalCost }
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'RentalCreated');
      const rentalId = event.args[0];

      // Use agent to limit
      await agentRental.connect(renter1).useAgent(rentalId);
      await agentRental.connect(renter1).useAgent(rentalId);

      // Try to use beyond limit
      await expect(
        agentRental.connect(renter1).useAgent(rentalId)
      ).to.be.revertedWith("Rental not active");
    });

    it("Should allow rental cancellation before usage", async function () {
      const maxUsage = 5;
      const totalCost = ethers.parseEther("0.5");

      // Rent agent
      const tx = await agentRental.connect(renter1).rentAgentPayPerUse(
        agentId,
        maxUsage,
        { value: totalCost }
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'RentalCreated');
      const rentalId = event.args[0];

      // Cancel rental
      const balanceBefore = await ethers.provider.getBalance(renter1.address);
      await agentRental.connect(renter1).cancelRental(rentalId);
      const balanceAfter = await ethers.provider.getBalance(renter1.address);

      // Check refund (accounting for gas costs)
      expect(balanceAfter).to.be.gt(balanceBefore);

      const rental = await agentRental.getRental(rentalId);
      expect(rental.status).to.equal(2); // CANCELLED
    });
  });

  describe("UsageTracking", function () {
    let agentId, rentalId;

    beforeEach(async function () {
      // Register an agent
      const tx1 = await agentRegistry.connect(agent1Owner).registerAgent(
        "Test Agent",
        "A test AI agent",
        "chatbot",
        "QmTestHash123",
        ethers.parseEther("0.1"),
        ethers.parseEther("1.0")
      );
      const receipt1 = await tx1.wait();
      const event1 = receipt1.logs.find(log => log.fragment && log.fragment.name === 'AgentRegistered');
      agentId = event1.args[0];

      // Rent the agent
      const tx2 = await agentRental.connect(renter1).rentAgentPayPerUse(
        agentId,
        5,
        { value: ethers.parseEther("0.5") }
      );
      const receipt2 = await tx2.wait();
      const event2 = receipt2.logs.find(log => log.fragment && log.fragment.name === 'RentalCreated');
      rentalId = event2.args[0];
    });

    it("Should record agent usage", async function () {
      const computeJobId = ethers.keccak256(ethers.toUtf8Bytes("job123"));
      
      const tx = await usageTracking.connect(computeProvider).recordUsage(
        rentalId,
        computeJobId,
        1500, // 1.5 seconds
        100,  // 100 units of resources
        "input_hash",
        "output_hash"
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'UsageRecorded');
      expect(event).to.not.be.undefined;

      const recordId = event.args[0];
      const record = await usageTracking.getUsageRecord(recordId);

      expect(record.rentalId).to.equal(rentalId);
      expect(record.agentId).to.equal(agentId);
      expect(record.user).to.equal(renter1.address);
      expect(record.computeJobId).to.equal(computeJobId);
      expect(record.computeTime).to.equal(1500);
      expect(record.resourcesUsed).to.equal(100);
      expect(record.verified).to.be.false;
    });

    it("Should verify usage with proof", async function () {
      const computeJobId = ethers.keccak256(ethers.toUtf8Bytes("job123"));
      
      // Record usage
      const tx1 = await usageTracking.connect(computeProvider).recordUsage(
        rentalId,
        computeJobId,
        1500,
        100,
        "input_hash",
        "output_hash"
      );
      const receipt1 = await tx1.wait();
      const event1 = receipt1.logs.find(log => log.fragment && log.fragment.name === 'UsageRecorded');
      const recordId = event1.args[0];

      // Verify usage
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof123"));
      await usageTracking.connect(computeProvider).verifyUsage(
        recordId,
        proofHash,
        true
      );

      const record = await usageTracking.getUsageRecord(recordId);
      expect(record.verified).to.be.true;
      expect(record.proofHash).to.equal(proofHash);
    });

    it("Should get usage statistics for agent", async function () {
      const computeJobId1 = ethers.keccak256(ethers.toUtf8Bytes("job1"));
      const computeJobId2 = ethers.keccak256(ethers.toUtf8Bytes("job2"));
      
      // Record two usage instances
      await usageTracking.connect(computeProvider).recordUsage(
        rentalId,
        computeJobId1,
        1000,
        50,
        "input1",
        "output1"
      );
      
      await usageTracking.connect(computeProvider).recordUsage(
        rentalId,
        computeJobId2,
        2000,
        75,
        "input2",
        "output2"
      );

      const stats = await usageTracking.getAgentUsageStats(agentId);
      expect(stats.totalUsage).to.equal(2);
      expect(stats.verifiedUsage).to.equal(0); // Not verified yet
      expect(stats.totalComputeTime).to.equal(3000); // 1000 + 2000
      expect(stats.totalResourcesUsed).to.equal(125); // 50 + 75
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete agent lifecycle", async function () {
      // 1. Register agent
      const tx1 = await agentRegistry.connect(agent1Owner).registerAgent(
        "Complete Test Agent",
        "A complete test AI agent",
        "trader",
        "QmCompleteTestHash",
        ethers.parseEther("0.05"),
        ethers.parseEther("0.5")
      );
      const receipt1 = await tx1.wait();
      const event1 = receipt1.logs.find(log => log.fragment && log.fragment.name === 'AgentRegistered');
      const agentId = event1.args[0];

      // 2. Rent agent
      const tx2 = await agentRental.connect(renter1).rentAgentPayPerUse(
        agentId,
        3,
        { value: ethers.parseEther("0.15") }
      );
      const receipt2 = await tx2.wait();
      const event2 = receipt2.logs.find(log => log.fragment && log.fragment.name === 'RentalCreated');
      const rentalId = event2.args[0];

      // 3. Use agent and record usage
      const computeJobId = ethers.keccak256(ethers.toUtf8Bytes("integration_job"));
      
      await usageTracking.connect(computeProvider).recordUsage(
        rentalId,
        computeJobId,
        2500,
        150,
        "integration_input",
        "integration_output"
      );

      await agentRental.connect(renter1).useAgent(rentalId);

      // 4. Verify usage
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("integration_proof"));
      const recordId = 1; // First record
      await usageTracking.connect(computeProvider).verifyUsage(
        recordId,
        proofHash,
        true
      );

      // 5. Add review
      await agentRegistry.connect(renter1).addReview(
        agentId,
        4,
        "Good agent for trading!"
      );

      // 6. Verify final state
      const agent = await agentRegistry.getAgent(agentId);
      expect(agent.totalUsage).to.equal(1);
      expect(agent.rating).to.equal(400); // 4 * 100
      expect(agent.reviewCount).to.equal(1);

      const rental = await agentRental.getRental(rentalId);
      expect(rental.usageCount).to.equal(1);
      expect(rental.status).to.equal(0); // Still ACTIVE (can use 2 more times)

      const record = await usageTracking.getUsageRecord(recordId);
      expect(record.verified).to.be.true;
      expect(record.computeTime).to.equal(2500);
    });
  });
});

