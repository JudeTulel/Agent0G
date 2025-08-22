// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public agentRegistry;
    
    address public owner = address(1);
    address public user1 = address(2);
    address public user2 = address(3);
    address public user3 = address(4);
    
    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        string name,
        string category,
        uint256 pricePerUse,
        uint256 subscriptionPrice
    );
    
    event AgentUpdated(
        uint256 indexed agentId,
        string name,
        string description,
        uint256 pricePerUse,
        uint256 subscriptionPrice
    );
    
    event AgentDeactivated(uint256 indexed agentId);
    event AgentActivated(uint256 indexed agentId);
    
    event ReviewAdded(
        uint256 indexed agentId,
        address indexed reviewer,
        uint256 rating,
        string comment
    );
    
    function setUp() public {
        vm.prank(owner);
        agentRegistry = new AgentRegistry();
    }
    
    function testRegisterAgent() public {
        vm.prank(user1);
        
        vm.expectEmit(true, true, false, true);
        emit AgentRegistered(
            1,
            user1,
            "Test Agent",
            "AI Assistant",
            100,
            1000
        );
        
        uint256 agentId = agentRegistry.registerAgent(
            "Test Agent",
            "A test AI agent",
            "AI Assistant",
            "QmTestHash123",
            100, // price per use
            1000 // subscription price
        );
        
        assertEq(agentId, 1);
        
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(agentId);
        assertEq(agent.id, 1);
        assertEq(agent.owner, user1);
        assertEq(agent.name, "Test Agent");
        assertEq(agent.description, "A test AI agent");
        assertEq(agent.category, "AI Assistant");
        assertEq(agent.workflowHash, "QmTestHash123");
        assertEq(agent.pricePerUse, 100);
        assertEq(agent.subscriptionPrice, 1000);
        assertTrue(agent.isActive);
        assertEq(agent.totalUsage, 0);
        assertEq(agent.rating, 0);
        assertEq(agent.reviewCount, 0);
        assertGt(agent.createdAt, 0);
        assertGt(agent.updatedAt, 0);
    }
    
    function testRegisterAgentWithOnlyPayPerUse() public {
        vm.prank(user1);
        
        uint256 agentId = agentRegistry.registerAgent(
            "Pay Per Use Agent",
            "Agent with only pay per use",
            "Utility",
            "QmTestHash456",
            50, // price per use
            0   // no subscription
        );
        
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(agentId);
        assertEq(agent.pricePerUse, 50);
        assertEq(agent.subscriptionPrice, 0);
    }
    
    function testRegisterAgentWithOnlySubscription() public {
        vm.prank(user1);
        
        uint256 agentId = agentRegistry.registerAgent(
            "Subscription Agent",
            "Agent with only subscription",
            "Premium",
            "QmTestHash789",
            0,    // no pay per use
            2000  // subscription price
        );
        
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(agentId);
        assertEq(agent.pricePerUse, 0);
        assertEq(agent.subscriptionPrice, 2000);
    }
    
    function test_RevertWhen_RegisterAgentWithEmptyName() public {
        vm.prank(user1);
        vm.expectRevert(bytes("Name cannot be empty"));
        agentRegistry.registerAgent(
            "", // empty name
            "Description",
            "Category",
            "QmTestHash",
            100,
            1000
        );
    }
    
    function test_RevertWhen_RegisterAgentWithEmptyWorkflowHash() public {
        vm.prank(user1);
        vm.expectRevert(bytes("Workflow hash cannot be empty"));
        agentRegistry.registerAgent(
            "Test Agent",
            "Description",
            "Category",
            "", // empty workflow hash
            100,
            1000
        );
    }
    
    function test_RevertWhen_RegisterAgentWithNoPrices() public {
        vm.prank(user1);
        vm.expectRevert(bytes("At least one price must be set"));
        agentRegistry.registerAgent(
            "Test Agent",
            "Description",
            "Category",
            "QmTestHash",
            0, // no pay per use
            0  // no subscription
        );
    }
    
    function testUpdateAgent() public {
        vm.startPrank(user1);
        
        // Register agent first
        uint256 agentId = agentRegistry.registerAgent(
            "Original Agent",
            "Original description",
            "Original",
            "QmOriginalHash",
            100,
            1000
        );
        
        // Update agent
        vm.expectEmit(true, false, false, true);
        emit AgentUpdated(
            agentId,
            "Updated Agent",
            "Updated description",
            200,
            2000
        );
        
        agentRegistry.updateAgent(
            agentId,
            "Updated Agent",
            "Updated description",
            200,
            2000
        );
        
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(agentId);
        assertEq(agent.name, "Updated Agent");
        assertEq(agent.description, "Updated description");
        assertEq(agent.pricePerUse, 200);
        assertEq(agent.subscriptionPrice, 2000);
        
        vm.stopPrank();
    }
    
    function test_RevertWhen_UpdateAgentNotOwner() public {
        vm.prank(user1);
        uint256 agentId = agentRegistry.registerAgent(
            "Test Agent",
            "Description",
            "Category",
            "QmTestHash",
            100,
            1000
        );
        
        // Try to update as different user
        vm.prank(user2);
        vm.expectRevert(bytes("Not agent owner"));
        agentRegistry.updateAgent(
            agentId,
            "Malicious Update",
            "Hacked description",
            999,
            9999
        );
    }
    
    function testDeactivateAndActivateAgent() public {
        vm.startPrank(user1);
        
        uint256 agentId = agentRegistry.registerAgent(
            "Test Agent",
            "Description",
            "Category",
            "QmTestHash",
            100,
            1000
        );
        
        // Deactivate
        vm.expectEmit(true, false, false, false);
        emit AgentDeactivated(agentId);
        
        agentRegistry.deactivateAgent(agentId);
        
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(agentId);
        assertFalse(agent.isActive);
        
        // Activate
        vm.expectEmit(true, false, false, false);
        emit AgentActivated(agentId);
        
        agentRegistry.activateAgent(agentId);
        
        agent = agentRegistry.getAgent(agentId);
        assertTrue(agent.isActive);
        
        vm.stopPrank();
    }
    
    function testAddReview() public {
        vm.prank(user1);
        uint256 agentId = agentRegistry.registerAgent(
            "Test Agent",
            "Description",
            "Category",
            "QmTestHash",
            100,
            1000
        );
        
        vm.prank(user2);
        vm.expectEmit(true, true, false, true);
        emit ReviewAdded(agentId, user2, 5, "Great agent!");
        
        agentRegistry.addReview(agentId, 5, "Great agent!");
        
        AgentRegistry.Review[] memory reviews = agentRegistry.getAgentReviews(agentId);
        assertEq(reviews.length, 1);
        assertEq(reviews[0].reviewer, user2);
        assertEq(reviews[0].rating, 5);
        assertEq(reviews[0].comment, "Great agent!");
        
        // Check updated rating
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(agentId);
        assertEq(agent.rating, 500); // 5 * 100
        assertEq(agent.reviewCount, 1);
    }
    
    function testMultipleReviews() public {
        vm.prank(user1);
        uint256 agentId = agentRegistry.registerAgent(
            "Test Agent",
            "Description",
            "Category",
            "QmTestHash",
            100,
            1000
        );
        
        // Add multiple reviews
        vm.prank(user2);
        agentRegistry.addReview(agentId, 5, "Excellent!");
        
        vm.prank(user3);
        agentRegistry.addReview(agentId, 3, "Good but not great");
        
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(agentId);
        assertEq(agent.reviewCount, 2);
        assertEq(agent.rating, 400); // ((5*100) + (3*100)) / 2 = 400
        
        AgentRegistry.Review[] memory reviews = agentRegistry.getAgentReviews(agentId);
        assertEq(reviews.length, 2);
    }
    
    function test_RevertWhen_AddReviewToOwnAgent() public {
        vm.startPrank(user1);
        
        uint256 agentId = agentRegistry.registerAgent(
            "Test Agent",
            "Description",
            "Category",
            "QmTestHash",
            100,
            1000
        );
        
        // Try to review own agent
        vm.expectRevert(bytes("Cannot review own agent"));
        agentRegistry.addReview(agentId, 5, "Great agent!");
        
        vm.stopPrank();
    }
    
    function test_RevertWhen_AddDuplicateReview() public {
        vm.prank(user1);
        uint256 agentId = agentRegistry.registerAgent(
            "Test Agent",
            "Description",
            "Category",
            "QmTestHash",
            100,
            1000
        );
        
        vm.startPrank(user2);
        
        agentRegistry.addReview(agentId, 5, "First review");
        
        // Try to add second review
        vm.expectRevert(bytes("Already reviewed this agent"));
        agentRegistry.addReview(agentId, 4, "Second review");
        
        vm.stopPrank();
    }
    
    function test_RevertWhen_InvalidRating() public {
        vm.prank(user1);
        uint256 agentId = agentRegistry.registerAgent(
            "Test Agent",
            "Description",
            "Category",
            "QmTestHash",
            100,
            1000
        );
        
        vm.prank(user2);
        vm.expectRevert(bytes("Rating must be between 1 and 5"));
        agentRegistry.addReview(agentId, 6, "Invalid rating"); // Rating > 5
    }
    
    function testIncrementUsage() public {
        vm.prank(user1);
        uint256 agentId = agentRegistry.registerAgent(
            "Test Agent",
            "Description",
            "Category",
            "QmTestHash",
            100,
            1000
        );
        
        // Initially usage should be 0
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(agentId);
        assertEq(agent.totalUsage, 0);
        
        // Increment usage
        agentRegistry.incrementUsage(agentId);
        
        agent = agentRegistry.getAgent(agentId);
        assertEq(agent.totalUsage, 1);
        
        // Increment again
        agentRegistry.incrementUsage(agentId);
        
        agent = agentRegistry.getAgent(agentId);
        assertEq(agent.totalUsage, 2);
    }
    
    function testGetAgentsByOwner() public {
        vm.startPrank(user1);
        
        uint256 agent1 = agentRegistry.registerAgent(
            "Agent 1",
            "Description 1",
            "Category 1",
            "QmHash1",
            100,
            1000
        );
        
        uint256 agent2 = agentRegistry.registerAgent(
            "Agent 2",
            "Description 2",
            "Category 2",
            "QmHash2",
            200,
            2000
        );
        
        vm.stopPrank();
        
        // Register agent as different user
        vm.prank(user2);
        uint256 agent3 = agentRegistry.registerAgent(
            "Agent 3",
            "Description 3",
            "Category 3",
            "QmHash3",
            300,
            3000
        );
        
        uint256[] memory user1Agents = agentRegistry.getAgentsByOwner(user1);
        assertEq(user1Agents.length, 2);
        assertEq(user1Agents[0], agent1);
        assertEq(user1Agents[1], agent2);
        
        uint256[] memory user2Agents = agentRegistry.getAgentsByOwner(user2);
        assertEq(user2Agents.length, 1);
        assertEq(user2Agents[0], agent3);
    }
    
    function testGetAgentsByCategory() public {
        vm.startPrank(user1);
        
        uint256 agent1 = agentRegistry.registerAgent(
            "Agent 1",
            "Description 1",
            "AI Assistant",
            "QmHash1",
            100,
            1000
        );
        
        uint256 agent2 = agentRegistry.registerAgent(
            "Agent 2",
            "Description 2",
            "AI Assistant",
            "QmHash2",
            200,
            2000
        );
        
        uint256 agent3 = agentRegistry.registerAgent(
            "Agent 3",
            "Description 3",
            "Utility",
            "QmHash3",
            300,
            3000
        );
        
        vm.stopPrank();
        
        uint256[] memory aiAgents = agentRegistry.getAgentsByCategory("AI Assistant");
        assertEq(aiAgents.length, 2);
        assertEq(aiAgents[0], agent1);
        assertEq(aiAgents[1], agent2);
        
        uint256[] memory utilityAgents = agentRegistry.getAgentsByCategory("Utility");
        assertEq(utilityAgents.length, 1);
        assertEq(utilityAgents[0], agent3);
    }
    
    function testGetTotalAgents() public {
        assertEq(agentRegistry.getTotalAgents(), 0);
        
        vm.startPrank(user1);
        
        agentRegistry.registerAgent(
            "Agent 1",
            "Description 1",
            "Category 1",
            "QmHash1",
            100,
            1000
        );
        
        assertEq(agentRegistry.getTotalAgents(), 1);
        
        agentRegistry.registerAgent(
            "Agent 2",
            "Description 2",
            "Category 2",
            "QmHash2",
            200,
            2000
        );
        
        assertEq(agentRegistry.getTotalAgents(), 2);
        
        vm.stopPrank();
    }
    
    function testGetActiveAgents() public {
        vm.startPrank(user1);
        
        uint256 agent1 = agentRegistry.registerAgent(
            "Agent 1",
            "Description 1",
            "Category 1",
            "QmHash1",
            100,
            1000
        );
        
        uint256 agent2 = agentRegistry.registerAgent(
            "Agent 2",
            "Description 2",
            "Category 2",
            "QmHash2",
            200,
            2000
        );
        
        uint256 agent3 = agentRegistry.registerAgent(
            "Agent 3",
            "Description 3",
            "Category 3",
            "QmHash3",
            300,
            3000
        );
        
        // Deactivate agent2
        agentRegistry.deactivateAgent(agent2);
        
        vm.stopPrank();
        
        // Get active agents
        AgentRegistry.Agent[] memory activeAgents = agentRegistry.getActiveAgents(0, 10);
        
        // Should return agent1 and agent3 (agent2 is deactivated)
        assertEq(activeAgents.length, 2);
        assertEq(activeAgents[0].id, agent1);
        assertEq(activeAgents[1].id, agent3);
        assertTrue(activeAgents[0].isActive);
        assertTrue(activeAgents[1].isActive);
    }
    
    function test_RevertWhen_GetNonExistentAgent() public {
        vm.expectRevert(bytes("Agent does not exist"));
        agentRegistry.getAgent(999);
    }
}