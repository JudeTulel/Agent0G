// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AgentRegistry.sol";

/**
 * @title AgentRental
 * @dev Smart contract for handling AI agent rentals and payments
 */
contract AgentRental is Ownable, ReentrancyGuard {
    
    uint256 private _rentalIdCounter;
    
    AgentRegistry public agentRegistry;
    
    enum RentalType { PAY_PER_USE, SUBSCRIPTION }
    enum RentalStatus { ACTIVE, COMPLETED, CANCELLED, EXPIRED }
    
    struct Rental {
        uint256 id;
        uint256 agentId;
        address renter;
        address agentOwner;
        RentalType rentalType;
        RentalStatus status;
        uint256 amount;
        uint256 usageCount;
        uint256 maxUsage; // For pay-per-use, 0 for unlimited subscription
        uint256 startTime;
        uint256 endTime; // For subscriptions
        uint256 createdAt;
    }
    
    struct Escrow {
        uint256 rentalId;
        uint256 amount;
        bool released;
        uint256 createdAt;
    }
    
    mapping(uint256 => Rental) public rentals;
    mapping(uint256 => Escrow) public escrows;
    mapping(address => uint256[]) public userRentals;
    mapping(uint256 => uint256[]) public agentRentals; // agentId => rentalIds
    
    // Platform fee (in basis points, e.g., 300 = 3%)
    uint256 public platformFee = 250;
    address public feeRecipient;
    
    event RentalCreated(
        uint256 indexed rentalId,
        uint256 indexed agentId,
        address indexed renter,
        RentalType rentalType,
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
    
    modifier validAgent(uint256 _agentId) {
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(_agentId);
        require(agent.isActive, "Agent is not active");
        _;
    }
    
    modifier onlyRenter(uint256 _rentalId) {
        require(rentals[_rentalId].renter == msg.sender, "Not the renter");
        _;
    }
    
    modifier rentalExists(uint256 _rentalId) {
        require(rentals[_rentalId].id != 0, "Rental does not exist");
        _;
    }
    
    constructor(address _agentRegistry, address _feeRecipient) Ownable(msg.sender) {
        agentRegistry = AgentRegistry(_agentRegistry);
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @dev Rent an agent with pay-per-use model
     */
    function rentAgentPayPerUse(
        uint256 _agentId,
        uint256 _maxUsage
    ) external payable validAgent(_agentId) nonReentrant returns (uint256) {
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(_agentId);
        require(agent.pricePerUse > 0, "Pay-per-use not available");
        require(_maxUsage > 0, "Max usage must be greater than 0");
        
        uint256 totalCost = agent.pricePerUse * _maxUsage;
        require(msg.value >= totalCost, "Insufficient payment");
        
        _rentalIdCounter++;
        uint256 newRentalId = _rentalIdCounter;
        
        rentals[newRentalId] = Rental({
            id: newRentalId,
            agentId: _agentId,
            renter: msg.sender,
            agentOwner: agent.owner,
            rentalType: RentalType.PAY_PER_USE,
            status: RentalStatus.ACTIVE,
            amount: totalCost,
            usageCount: 0,
            maxUsage: _maxUsage,
            startTime: block.timestamp,
            endTime: 0,
            createdAt: block.timestamp
        });
        
        // Create escrow
        escrows[newRentalId] = Escrow({
            rentalId: newRentalId,
            amount: totalCost,
            released: false,
            createdAt: block.timestamp
        });
        
        userRentals[msg.sender].push(newRentalId);
        agentRentals[_agentId].push(newRentalId);
        
        // Refund excess payment
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }
        
        emit RentalCreated(newRentalId, _agentId, msg.sender, RentalType.PAY_PER_USE, totalCost);
        
        return newRentalId;
    }
    
    /**
     * @dev Rent an agent with subscription model
     */
    function rentAgentSubscription(
        uint256 _agentId,
        uint256 _duration // Duration in seconds
    ) external payable validAgent(_agentId) nonReentrant returns (uint256) {
        AgentRegistry.Agent memory agent = agentRegistry.getAgent(_agentId);
        require(agent.subscriptionPrice > 0, "Subscription not available");
        require(_duration > 0, "Duration must be greater than 0");
        
        uint256 totalCost = agent.subscriptionPrice;
        require(msg.value >= totalCost, "Insufficient payment");
        
        _rentalIdCounter++;
        uint256 newRentalId = _rentalIdCounter;
        
        uint256 endTime = block.timestamp + _duration;
        
        rentals[newRentalId] = Rental({
            id: newRentalId,
            agentId: _agentId,
            renter: msg.sender,
            agentOwner: agent.owner,
            rentalType: RentalType.SUBSCRIPTION,
            status: RentalStatus.ACTIVE,
            amount: totalCost,
            usageCount: 0,
            maxUsage: 0, // Unlimited for subscription
            startTime: block.timestamp,
            endTime: endTime,
            createdAt: block.timestamp
        });
        
        // Create escrow
        escrows[newRentalId] = Escrow({
            rentalId: newRentalId,
            amount: totalCost,
            released: false,
            createdAt: block.timestamp
        });
        
        userRentals[msg.sender].push(newRentalId);
        agentRentals[_agentId].push(newRentalId);
        
        // Refund excess payment
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }
        
        emit RentalCreated(newRentalId, _agentId, msg.sender, RentalType.SUBSCRIPTION, totalCost);
        
        return newRentalId;
    }
    
    /**
     * @dev Use an agent (increment usage count)
     */
    function useAgent(uint256 _rentalId) 
        external 
        rentalExists(_rentalId) 
        onlyRenter(_rentalId) 
        nonReentrant 
    {
        Rental storage rental = rentals[_rentalId];
        require(rental.status == RentalStatus.ACTIVE, "Rental not active");
        
        // Check if rental is still valid
        if (rental.rentalType == RentalType.SUBSCRIPTION) {
            require(block.timestamp <= rental.endTime, "Subscription expired");
        } else {
            require(rental.usageCount < rental.maxUsage, "Usage limit reached");
        }
        
        rental.usageCount++;
        
        // Update agent usage in registry
        agentRegistry.incrementUsage(rental.agentId);
        
        // Check if pay-per-use rental is completed
        if (rental.rentalType == RentalType.PAY_PER_USE && 
            rental.usageCount >= rental.maxUsage) {
            rental.status = RentalStatus.COMPLETED;
            _releaseEscrow(_rentalId);
            emit RentalCompleted(_rentalId);
        }
        
        emit RentalUsed(_rentalId, rental.agentId, msg.sender, rental.usageCount);
    }
    
    /**
     * @dev Complete a subscription rental (can be called by renter or after expiry)
     */
    function completeSubscription(uint256 _rentalId) 
        external 
        rentalExists(_rentalId) 
        nonReentrant 
    {
        Rental storage rental = rentals[_rentalId];
        require(rental.rentalType == RentalType.SUBSCRIPTION, "Not a subscription");
        require(rental.status == RentalStatus.ACTIVE, "Rental not active");
        require(
            msg.sender == rental.renter || block.timestamp > rental.endTime,
            "Cannot complete subscription yet"
        );
        
        rental.status = RentalStatus.COMPLETED;
        _releaseEscrow(_rentalId);
        
        emit RentalCompleted(_rentalId);
    }
    
    /**
     * @dev Cancel a rental (only before any usage)
     */
    function cancelRental(uint256 _rentalId) 
        external 
        rentalExists(_rentalId) 
        onlyRenter(_rentalId) 
        nonReentrant 
    {
        Rental storage rental = rentals[_rentalId];
        require(rental.status == RentalStatus.ACTIVE, "Rental not active");
        require(rental.usageCount == 0, "Cannot cancel after usage");
        
        rental.status = RentalStatus.CANCELLED;
        
        // Refund to renter
        Escrow storage escrow = escrows[_rentalId];
        require(!escrow.released, "Escrow already released");
        
        escrow.released = true;
        payable(rental.renter).transfer(escrow.amount);
        
        emit RentalCancelled(_rentalId);
    }
    
    /**
     * @dev Release escrow funds to agent owner
     */
    function _releaseEscrow(uint256 _rentalId) internal {
        Escrow storage escrow = escrows[_rentalId];
        require(!escrow.released, "Escrow already released");
        
        Rental storage rental = rentals[_rentalId];
        
        escrow.released = true;
        
        // Calculate platform fee
        uint256 fee = (escrow.amount * platformFee) / 10000;
        uint256 ownerAmount = escrow.amount - fee;
        
        // Transfer to agent owner and platform
        payable(rental.agentOwner).transfer(ownerAmount);
        payable(feeRecipient).transfer(fee);
        
        emit EscrowReleased(_rentalId, escrow.amount);
    }
    
    /**
     * @dev Get rental details
     */
    function getRental(uint256 _rentalId) 
        external 
        view 
        rentalExists(_rentalId) 
        returns (Rental memory) 
    {
        return rentals[_rentalId];
    }
    
    /**
     * @dev Get user's rentals
     */
    function getUserRentals(address _user) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return userRentals[_user];
    }
    
    /**
     * @dev Get agent's rentals
     */
    function getAgentRentals(uint256 _agentId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return agentRentals[_agentId];
    }
    
    /**
     * @dev Check if rental is active and can be used
     */
    function canUseRental(uint256 _rentalId) 
        external 
        view 
        rentalExists(_rentalId) 
        returns (bool) 
    {
        Rental memory rental = rentals[_rentalId];
        
        if (rental.status != RentalStatus.ACTIVE) {
            return false;
        }
        
        if (rental.rentalType == RentalType.SUBSCRIPTION) {
            return block.timestamp <= rental.endTime;
        } else {
            return rental.usageCount < rental.maxUsage;
        }
    }
    
    /**
     * @dev Get total number of rentals
     */
    function getTotalRentals() external view returns (uint256) {
        return _rentalIdCounter;
    }
    
    /**
     * @dev Update platform fee (only owner)
     */
    function updatePlatformFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 1000, "Fee cannot exceed 10%"); // Max 10%
        platformFee = _newFee;
    }
    
    /**
     * @dev Update fee recipient (only owner)
     */
    function updateFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Invalid recipient");
        feeRecipient = _newRecipient;
    }
}