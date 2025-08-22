// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/AgentRegistry.sol";
import "../src/AgentRental.sol";

contract AgentRentalTest is Test {
    AgentRegistry public agentRegistry;
    AgentRental public agentRental;
    
    address public owner = address(1);
    address public agentOwner = address(2);
    address public renter = address(3);
    address public feeRecipient = address(4);
    address public otherUser = address(5);
    
    uint256 public agentId;
    
    event RentalCreated(
        uint256 indexed rentalId,
        uint256 indexed agentId,
        address indexed renter,
        AgentRental.RentalType rentalType,
        uint256 amount
    );
    
    event RentalUsed(
        uint256 indexed rentalId,
        uint256 indexed agentId,
        address indexed renter,
        uint256 usageCount
    );
    
    event RentalCompleted(uint256 indexed rentalId);
    event RentalCancelled(uint256 indexed rentalId);
    event EscrowReleased(uint256 indexed rentalId, uint256 amount);
    
    function setUp() public {
        vm.startPrank(owner);
        agentRegistry = new AgentRegistry();
        agentRental = new AgentRental(address(agentRegistry), feeRecipient);
        vm.stopPrank();
        
        // Register an agent
        vm.prank(agentOwner);
        agentId = agentRegistry.registerAgent(
            "Test Agent",
            "A test AI agent",
            "AI Assistant",
            "QmTestHash123",
            100, // price per use
            1000 // subscription price
        );
    }
    
    function testRentAgentPayPerUse() public {
        uint256 maxUsage = 5;
        uint256 totalCost = 100 * maxUsage; // 500 wei
        
        vm.deal(renter, 1 ether);
        vm.prank(renter);
        
        vm.expectEmit(true, true, true, true);
        emit RentalCreated(1, agentId, renter, AgentRental.RentalType.PAY_PER_USE, totalCost);
        
        uint256 rentalId = agentRental.rentAgentPayPerUse{value: totalCost}(
            agentId,
            maxUsage
        );
        
        assertEq(rentalId, 1);
        
        AgentRental.Rental memory rental = agentRental.getRental(rentalId);
        assertEq(rental.id, 1);
        assertEq(rental.agentId, agentId);
        assertEq(rental.renter, renter);
        assertEq(rental.agentOwner, agentOwner);
        assertEq(uint8(rental.rentalType), uint8(AgentRental.RentalType.PAY_PER_USE));
        assertEq(uint8(rental.status), uint8(AgentRental.RentalStatus.ACTIVE));
        assertEq(rental.amount, totalCost);
        assertEq(rental.usageCount, 0);
        assertEq(rental.maxUsage, maxUsage);
        assertEq(rental.endTime, 0);
        assertGt(rental.createdAt, 0);
    }
    
    function testRentAgentPayPerUseWithRefund() public {
        uint256 maxUsage = 3;
        uint256 totalCost = 100 * maxUsage; // 300 wei
        uint256 overpayment = 500; // 200 wei overpayment
        
        vm.deal(renter, 1 ether);
        uint256 initialBalance = renter.balance;
        
        vm.prank(renter);
        agentRental.rentAgentPayPerUse{value: totalCost + overpayment}(
            agentId,
            maxUsage
        );
        
        // Should refund the overpayment
        assertEq(renter.balance, initialBalance - totalCost);
    }
    
    function testRentAgentSubscription() public {
        uint256 duration = 30 days;
        uint256 subscriptionPrice = 1000;
        
        vm.deal(renter, 1 ether);
        vm.prank(renter);
        
        vm.expectEmit(true, true, true, true);
        emit RentalCreated(1, agentId, renter, AgentRental.RentalType.SUBSCRIPTION, subscriptionPrice);
        
        uint256 rentalId = agentRental.rentAgentSubscription{value: subscriptionPrice}(
            agentId,
            duration
        );
        
        assertEq(rentalId, 1);
        
        AgentRental.Rental memory rental = agentRental.getRental(rentalId);
        assertEq(rental.id, 1);
        assertEq(rental.agentId, agentId);
        assertEq(rental.renter, renter);
        assertEq(uint8(rental.rentalType), uint8(AgentRental.RentalType.SUBSCRIPTION));
        assertEq(rental.amount, subscriptionPrice);
        assertEq(rental.maxUsage, 0); // Unlimited for subscription
        assertEq(rental.endTime, block.timestamp + duration);
    }
    
    function test_RevertWhen_RentInactiveAgent() public {
        vm.prank(agentOwner);
        agentRegistry.deactivateAgent(agentId);
        
        vm.deal(renter, 1 ether);
        vm.prank(renter);
        vm.expectRevert(bytes("Agent is not active"));
        agentRental.rentAgentPayPerUse{value: 500}(agentId, 5);
    }
    
    function test_RevertWhen_RentPayPerUseInsufficientPayment() public {
        vm.deal(renter, 1 ether);
        vm.prank(renter);
        vm.expectRevert(bytes("Insufficient payment"));
        agentRental.rentAgentPayPerUse{value: 200}(agentId, 5); // Need 500
    }
    
    function test_RevertWhen_RentSubscriptionInsufficientPayment() public {
        vm.deal(renter, 1 ether);
        vm.prank(renter);
        vm.expectRevert(bytes("Insufficient payment"));
        agentRental.rentAgentSubscription{value: 500}(agentId, 30 days); // Need 1000
    }
    
    function testUseAgentPayPerUse() public {
        vm.deal(renter, 1 ether);
        vm.prank(renter);
        uint256 rentalId = agentRental.rentAgentPayPerUse{value: 500}(agentId, 5);
        
        vm.prank(renter);
        vm.expectEmit(true, true, true, true);
        emit RentalUsed(rentalId, agentId, renter, 1);
        
        agentRental.useAgent(rentalId);
        
        AgentRental.Rental memory rental = agentRental.getRental(rentalId);
        assertEq(rental.usageCount, 1);
        
        // Check that agent usage was incremented
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(agentId);
        assertEq(agent.totalUsage, 1);
    }
    
    function testUseAgentSubscription() public {
        vm.deal(renter, 1 ether);
        vm.prank(renter);
        uint256 rentalId = agentRental.rentAgentSubscription{value: 1000}(agentId, 30 days);
        
        vm.prank(renter);
        agentRental.useAgent(rentalId);
        
        AgentRental.Rental memory rental = agentRental.getRental(rentalId);
        assertEq(rental.usageCount, 1);
        assertEq(uint8(rental.status), uint8(AgentRental.RentalStatus.ACTIVE));
    }
    
    function testPayPerUseRentalCompletion() public {
        vm.deal(renter, 1 ether);
        vm.prank(renter);
        uint256 rentalId = agentRental.rentAgentPayPerUse{value: 300}(agentId, 3);
        
        vm.startPrank(renter);
        
        // Use agent 2 times
        agentRental.useAgent(rentalId);
        agentRental.useAgent(rentalId);
        
        AgentRental.Rental memory rental = agentRental.getRental(rentalId);
        assertEq(rental.usageCount, 2);
        assertEq(uint8(rental.status), uint8(AgentRental.RentalStatus.ACTIVE));
        
        // Use agent 3rd time - should complete rental and release escrow
        uint256 agentOwnerBalance = agentOwner.balance;
        uint256 feeRecipientBalance = feeRecipient.balance;
        
        vm.expectEmit(true, false, false, false);
        emit RentalCompleted(rentalId);
        
        agentRental.useAgent(rentalId);
        
        rental = agentRental.getRental(rentalId);
        assertEq(rental.usageCount, 3);
        assertEq(uint8(rental.status), uint8(AgentRental.RentalStatus.COMPLETED));
        
        // Check escrow was released
        uint256 feeBps = agentRental.platformFee();
        uint256 platformFee = (300 * feeBps) / 10000;
        uint256 ownerAmount = 300 - platformFee;
        
        assertEq(agentOwner.balance, agentOwnerBalance + ownerAmount);
        assertEq(feeRecipient.balance, feeRecipientBalance + platformFee);
        
        vm.stopPrank();
    }
    
    function test_RevertWhen_UseAgentNotRenter() public {
        vm.deal(renter, 1 ether);
        vm.prank(renter);
        uint256 rentalId = agentRental.rentAgentPayPerUse{value: 500}(agentId, 5);
        
        vm.prank(otherUser);
        vm.expectRevert(bytes("Not the renter"));
        agentRental.useAgent(rentalId);
    }
    
    function test_RevertWhen_UseAgentExceededUsage() public {
        vm.deal(renter, 1 ether);
        vm.prank(renter);
        uint256 rentalId = agentRental.rentAgentPayPerUse{value: 100}(agentId, 1);
        
        vm.startPrank(renter);
        agentRental.useAgent(rentalId); // completes
        vm.expectRevert(bytes("Rental not active"));
        agentRental.useAgent(rentalId); // should fail
        vm.stopPrank();
    }
    
    function test_RevertWhen_UseExpiredSubscription() public {
        vm.deal(renter, 1 ether);
        vm.prank(renter);
        uint256 rentalId = agentRental.rentAgentSubscription{value: 1000}(agentId, 1 days);
        
        vm.warp(block.timestamp + 2 days);
        
        vm.prank(renter);
        vm.expectRevert(bytes("Subscription expired"));
        agentRental.useAgent(rentalId);
    }
    
    function testCompleteSubscription() public {
        vm.deal(renter, 1 ether);
        vm.prank(renter);
        uint256 rentalId = agentRental.rentAgentSubscription{value: 1000}(agentId, 30 days);
        
        vm.prank(renter);
        vm.expectEmit(true, false, false, false);
        emit RentalCompleted(rentalId);
        
        agentRental.completeSubscription(rentalId);
        
        AgentRental.Rental memory rental = agentRental.getRental(rentalId);
        assertEq(uint8(rental.status), uint8(AgentRental.RentalStatus.COMPLETED));
    }
    
    function testCompleteExpiredSubscription() public {
        vm.deal(renter, 1 ether);
        vm.prank(renter);
        uint256 rentalId = agentRental.rentAgentSubscription{value: 1000}(agentId, 1 days);
        
        vm.warp(block.timestamp + 2 days);
        
        vm.prank(otherUser);
        agentRental.completeSubscription(rentalId);
        
        AgentRental.Rental memory rental = agentRental.getRental(rentalId);
        assertEq(uint8(rental.status), uint8(AgentRental.RentalStatus.COMPLETED));
    }
    
    function testCancelRental() public {
        vm.deal(renter, 1 ether);
        vm.prank(renter);
        uint256 rentalId = agentRental.rentAgentPayPerUse{value: 300}(agentId, 3);

        AgentRental.Rental memory rental = agentRental.getRental(rentalId);
        assertEq(uint8(rental.status), uint8(AgentRental.RentalStatus.ACTIVE));
        assertEq(rental.usageCount, 0);

        uint256 renterBalanceBefore = renter.balance;

        vm.expectEmit(true, false, false, false);
        emit RentalCancelled(rentalId);

        vm.prank(renter);
        agentRental.cancelRental(rentalId);

        rental = agentRental.getRental(rentalId);
        assertEq(uint8(rental.status), uint8(AgentRental.RentalStatus.CANCELLED));

        uint256 renterBalanceAfter = renter.balance;
        assertEq(renterBalanceAfter, renterBalanceBefore + 300);

        ( , uint256 escrowAmount, bool released, ) = agentRental.escrows(rentalId);
        assertEq(escrowAmount, 300);
        assertTrue(released);
    }

    function test_RevertWhen_CancelRentalAfterUsage() public {
        vm.deal(renter, 1 ether);
        vm.prank(renter);
        uint256 rentalId = agentRental.rentAgentPayPerUse{value: 100}(agentId, 1);

        vm.prank(renter);
        agentRental.useAgent(rentalId);

        vm.prank(renter);
        vm.expectRevert(bytes("Rental not active"));
        agentRental.cancelRental(rentalId); // should fail
    }
}
