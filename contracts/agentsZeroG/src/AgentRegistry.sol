// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
