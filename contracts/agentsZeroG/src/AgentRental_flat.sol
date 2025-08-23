// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19 ^0.8.20;

// lib/openzeppelin-contracts/contracts/utils/Context.sol

// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol

// OpenZeppelin Contracts (last updated v5.1.0) (utils/ReentrancyGuard.sol)

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}

// lib/openzeppelin-contracts/contracts/access/Ownable.sol

// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// src/AgentRegistry.sol

/**
 * @title AgentRegistry
 * @dev Smart contract for registering and managing AI agents on the marketplace
 */
contract AgentRegistry is Ownable, ReentrancyGuard {
    uint256 private _agentIds; // replaces Counters.Counter
    
    struct Agent {
        uint256 id;
        address owner;
        string name;
        string description;
        string category;
        string workflowHash; // IPFS hash stored on 0G Storage
        uint256 pricePerUse;
        uint256 subscriptionPrice;
        bool isActive;
        uint256 totalUsage;
        uint256 rating; // Rating out of 5 stars (multiplied by 100 for precision)
        uint256 reviewCount;
        uint256 createdAt;
        uint256 updatedAt;
    }
    
    struct Review {
        address reviewer;
        uint256 agentId;
        uint256 rating;
        string comment;
        uint256 timestamp;
    }
    
    mapping(uint256 => Agent) public agents;
    mapping(address => uint256[]) public ownerAgents;
    mapping(string => uint256[]) public categoryAgents;
    mapping(uint256 => Review[]) public agentReviews;
    mapping(address => mapping(uint256 => bool)) public hasReviewed;
    
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
    
    modifier onlyAgentOwner(uint256 agentId) {
        require(agents[agentId].owner == msg.sender, "Not agent owner");
        _;
    }
    
    modifier agentExists(uint256 agentId) {
        require(agents[agentId].id != 0, "Agent does not exist");
        _;
    }
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Register a new AI agent
     */
    function registerAgent(
        string memory _name,
        string memory _description,
        string memory _category,
        string memory _workflowHash,
        uint256 _pricePerUse,
        uint256 _subscriptionPrice
    ) external nonReentrant returns (uint256) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_workflowHash).length > 0, "Workflow hash cannot be empty");
        require(_pricePerUse > 0 || _subscriptionPrice > 0, "At least one price must be set");
        
        _agentIds += 1; // increment manually
        uint256 newAgentId = _agentIds;
        
        agents[newAgentId] = Agent({
            id: newAgentId,
            owner: msg.sender,
            name: _name,
            description: _description,
            category: _category,
            workflowHash: _workflowHash,
            pricePerUse: _pricePerUse,
            subscriptionPrice: _subscriptionPrice,
            isActive: true,
            totalUsage: 0,
            rating: 0,
            reviewCount: 0,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        
        ownerAgents[msg.sender].push(newAgentId);
        categoryAgents[_category].push(newAgentId);
        
        emit AgentRegistered(
            newAgentId,
            msg.sender,
            _name,
            _category,
            _pricePerUse,
            _subscriptionPrice
        );
        
        return newAgentId;
    }
    
    function updateAgent(
        uint256 _agentId,
        string memory _name,
        string memory _description,
        uint256 _pricePerUse,
        uint256 _subscriptionPrice
    ) external agentExists(_agentId) onlyAgentOwner(_agentId) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_pricePerUse > 0 || _subscriptionPrice > 0, "At least one price must be set");
        
        Agent storage agent = agents[_agentId];
        agent.name = _name;
        agent.description = _description;
        agent.pricePerUse = _pricePerUse;
        agent.subscriptionPrice = _subscriptionPrice;
        agent.updatedAt = block.timestamp;
        
        emit AgentUpdated(_agentId, _name, _description, _pricePerUse, _subscriptionPrice);
    }
    
    function deactivateAgent(uint256 _agentId) 
        external 
        agentExists(_agentId) 
        onlyAgentOwner(_agentId) 
    {
        agents[_agentId].isActive = false;
        agents[_agentId].updatedAt = block.timestamp;
        emit AgentDeactivated(_agentId);
    }
    
    function activateAgent(uint256 _agentId) 
        external 
        agentExists(_agentId) 
        onlyAgentOwner(_agentId) 
    {
        agents[_agentId].isActive = true;
        agents[_agentId].updatedAt = block.timestamp;
        emit AgentActivated(_agentId);
    }
    
    function addReview(
        uint256 _agentId,
        uint256 _rating,
        string memory _comment
    ) external agentExists(_agentId) {
        require(_rating >= 1 && _rating <= 5, "Rating must be between 1 and 5");
        require(!hasReviewed[msg.sender][_agentId], "Already reviewed this agent");
        require(msg.sender != agents[_agentId].owner, "Cannot review own agent");
        
        Review memory newReview = Review({
            reviewer: msg.sender,
            agentId: _agentId,
            rating: _rating,
            comment: _comment,
            timestamp: block.timestamp
        });
        
        agentReviews[_agentId].push(newReview);
        hasReviewed[msg.sender][_agentId] = true;
        
        // Update agent rating
        Agent storage agent = agents[_agentId];
        uint256 totalRating = (agent.rating * agent.reviewCount) + (_rating * 100);
        agent.reviewCount++;
        agent.rating = totalRating / agent.reviewCount;
        
        emit ReviewAdded(_agentId, msg.sender, _rating, _comment);
    }
    
    function incrementUsage(uint256 _agentId) external agentExists(_agentId) {
        agents[_agentId].totalUsage++;
    }
    
    function getAgent(uint256 _agentId) 
        external 
        view 
        agentExists(_agentId) 
        returns (Agent memory) 
    {
        return agents[_agentId];
    }
    
    function getAgentsByOwner(address _owner) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return ownerAgents[_owner];
    }
    
    function getAgentsByCategory(string memory _category) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return categoryAgents[_category];
    }
    
    function getAgentReviews(uint256 _agentId) 
        external 
        view 
        agentExists(_agentId) 
        returns (Review[] memory) 
    {
        return agentReviews[_agentId];
    }
    
    function getTotalAgents() external view returns (uint256) {
        return _agentIds;
    }
    
    function getActiveAgents(uint256 _offset, uint256 _limit) 
        external 
        view 
        returns (Agent[] memory) 
    {
        uint256 totalAgents = _agentIds;
        require(_offset < totalAgents, "Offset out of bounds");
        
        uint256 end = _offset + _limit;
        if (end > totalAgents) {
            end = totalAgents;
        }
        
        Agent[] memory activeAgents = new Agent[](end - _offset);
        uint256 index = 0;
        
        for (uint256 i = _offset + 1; i <= end; i++) {
            if (agents[i].isActive) {
                activeAgents[index] = agents[i];
                index++;
            }
        }
        
        Agent[] memory result = new Agent[](index);
        for (uint256 j = 0; j < index; j++) {
            result[j] = activeAgents[j];
        }
        
        return result;
    }
}

// src/AgentRental.sol

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
