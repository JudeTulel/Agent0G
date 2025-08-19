// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title AgentRegistry
 * @dev Smart contract for registering and managing AI agents on the marketplace
 */
contract AgentRegistry is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    Counters.Counter private _agentIds;
    
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
        
        _agentIds.increment();
        uint256 newAgentId = _agentIds.current();
        
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
    
    /**
     * @dev Update an existing agent
     */
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
    
    /**
     * @dev Deactivate an agent
     */
    function deactivateAgent(uint256 _agentId) 
        external 
        agentExists(_agentId) 
        onlyAgentOwner(_agentId) 
    {
        agents[_agentId].isActive = false;
        agents[_agentId].updatedAt = block.timestamp;
        emit AgentDeactivated(_agentId);
    }
    
    /**
     * @dev Activate an agent
     */
    function activateAgent(uint256 _agentId) 
        external 
        agentExists(_agentId) 
        onlyAgentOwner(_agentId) 
    {
        agents[_agentId].isActive = true;
        agents[_agentId].updatedAt = block.timestamp;
        emit AgentActivated(_agentId);
    }
    
    /**
     * @dev Add a review for an agent
     */
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
    
    /**
     * @dev Increment usage count for an agent (called by rental contract)
     */
    function incrementUsage(uint256 _agentId) external agentExists(_agentId) {
        // This should be called by the rental contract
        agents[_agentId].totalUsage++;
    }
    
    /**
     * @dev Get agent details
     */
    function getAgent(uint256 _agentId) 
        external 
        view 
        agentExists(_agentId) 
        returns (Agent memory) 
    {
        return agents[_agentId];
    }
    
    /**
     * @dev Get agents by owner
     */
    function getAgentsByOwner(address _owner) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return ownerAgents[_owner];
    }
    
    /**
     * @dev Get agents by category
     */
    function getAgentsByCategory(string memory _category) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return categoryAgents[_category];
    }
    
    /**
     * @dev Get reviews for an agent
     */
    function getAgentReviews(uint256 _agentId) 
        external 
        view 
        agentExists(_agentId) 
        returns (Review[] memory) 
    {
        return agentReviews[_agentId];
    }
    
    /**
     * @dev Get total number of agents
     */
    function getTotalAgents() external view returns (uint256) {
        return _agentIds.current();
    }
    
    /**
     * @dev Get active agents (paginated)
     */
    function getActiveAgents(uint256 _offset, uint256 _limit) 
        external 
        view 
        returns (Agent[] memory) 
    {
        uint256 totalAgents = _agentIds.current();
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
        
        // Resize array to actual size
        Agent[] memory result = new Agent[](index);
        for (uint256 j = 0; j < index; j++) {
            result[j] = activeAgents[j];
        }
        
        return result;
    }
}

