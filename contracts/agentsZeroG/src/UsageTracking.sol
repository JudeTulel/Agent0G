// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AgentRegistry.sol";
import "./AgentRental.sol";

/**
 * @title UsageTracking
 * @dev Smart contract for tracking and verifying AI agent usage with 0G Compute integration
 */
contract UsageTracking is Ownable, ReentrancyGuard {
    
    AgentRegistry public agentRegistry;
    AgentRental public agentRental;
    
    struct UsageRecord {
        uint256 id;
        uint256 rentalId;
        uint256 agentId;
        address user;
        bytes32 computeJobId; // 0G Compute job identifier
        bytes32 proofHash; // Hash of the computation proof
        uint256 computeTime; // Time taken for computation (in milliseconds)
        uint256 resourcesUsed; // Amount of compute resources used
        bool verified; // Whether the computation has been verified
        uint256 timestamp;
        string inputDataHash; // Hash of input data
        string outputDataHash; // Hash of output data
    }
    
    struct ComputeProvider {
        address providerAddress;
        string endpoint;
        bool isActive;
        uint256 reputation; // Reputation score (0-1000)
        uint256 totalJobs;
        uint256 successfulJobs;
        uint256 registeredAt;
    }
    
    mapping(uint256 => UsageRecord) public usageRecords;
    mapping(bytes32 => uint256) public jobIdToRecordId; // computeJobId => recordId
    mapping(address => ComputeProvider) public computeProviders;
    mapping(uint256 => uint256[]) public agentUsageHistory; // agentId => recordIds
    mapping(address => uint256[]) public userUsageHistory; // user => recordIds
    
    uint256 private _recordIdCounter;
    
    // Events
    event UsageRecorded(
        uint256 indexed recordId,
        uint256 indexed rentalId,
        uint256 indexed agentId,
        address user,
        bytes32 computeJobId
    );
    
    event UsageVerified(
        uint256 indexed recordId,
        bytes32 indexed computeJobId,
        bool verified
    );
    
    event ComputeProviderRegistered(
        address indexed provider,
        string endpoint
    );
    
    event ComputeProviderUpdated(
        address indexed provider,
        bool isActive,
        uint256 reputation
    );
    
    modifier onlyComputeProvider() {
        require(computeProviders[msg.sender].isActive, "Not an active compute provider");
        _;
    }
    
    modifier recordExists(uint256 _recordId) {
        require(usageRecords[_recordId].id != 0, "Usage record does not exist");
        _;
    }
    
    constructor(address _agentRegistry, address _agentRental) Ownable(msg.sender) {
        agentRegistry = AgentRegistry(_agentRegistry);
        agentRental = AgentRental(_agentRental);
    }
    
    /**
     * @dev Register a compute provider
     */
    function registerComputeProvider(
        address _provider,
        string memory _endpoint
    ) external onlyOwner {
        require(_provider != address(0), "Invalid provider address");
        require(bytes(_endpoint).length > 0, "Endpoint cannot be empty");
        
        computeProviders[_provider] = ComputeProvider({
            providerAddress: _provider,
            endpoint: _endpoint,
            isActive: true,
            reputation: 500, // Start with neutral reputation
            totalJobs: 0,
            successfulJobs: 0,
            registeredAt: block.timestamp
        });
        
        emit ComputeProviderRegistered(_provider, _endpoint);
    }
    
    /**
     * @dev Update compute provider status
     */
    function updateComputeProvider(
        address _provider,
        bool _isActive,
        uint256 _reputation
    ) external onlyOwner {
        require(computeProviders[_provider].providerAddress != address(0), "Provider not registered");
        require(_reputation <= 1000, "Reputation cannot exceed 1000");
        
        computeProviders[_provider].isActive = _isActive;
        computeProviders[_provider].reputation = _reputation;
        
        emit ComputeProviderUpdated(_provider, _isActive, _reputation);
    }
    
    /**
     * @dev Record agent usage (called by compute providers)
     */
    function recordUsage(
        uint256 _rentalId,
        bytes32 _computeJobId,
        uint256 _computeTime,
        uint256 _resourcesUsed,
        string memory _inputDataHash,
        string memory _outputDataHash
    ) external onlyComputeProvider nonReentrant returns (uint256) {
        // Verify rental exists and is valid
        AgentRental.Rental memory rental = agentRental.getRental(_rentalId);
        require(rental.id != 0, "Rental does not exist");
        require(agentRental.canUseRental(_rentalId), "Rental cannot be used");
        
        _recordIdCounter++;
        uint256 newRecordId = _recordIdCounter;
        
        usageRecords[newRecordId] = UsageRecord({
            id: newRecordId,
            rentalId: _rentalId,
            agentId: rental.agentId,
            user: rental.renter,
            computeJobId: _computeJobId,
            proofHash: bytes32(0), // Will be set during verification
            computeTime: _computeTime,
            resourcesUsed: _resourcesUsed,
            verified: false,
            timestamp: block.timestamp,
            inputDataHash: _inputDataHash,
            outputDataHash: _outputDataHash
        });
        
        jobIdToRecordId[_computeJobId] = newRecordId;
        agentUsageHistory[rental.agentId].push(newRecordId);
        userUsageHistory[rental.renter].push(newRecordId);
        
        // Update compute provider stats
        computeProviders[msg.sender].totalJobs++;
        
        emit UsageRecorded(newRecordId, _rentalId, rental.agentId, rental.renter, _computeJobId);
        
        return newRecordId;
    }
    
    /**
     * @dev Verify computation with proof (called by compute providers or verification oracles)
     */
    function verifyUsage(
        uint256 _recordId,
        bytes32 _proofHash,
        bool _isValid
    ) external recordExists(_recordId) nonReentrant {
        UsageRecord storage record = usageRecords[_recordId];
        require(!record.verified, "Usage already verified");
        
        // Only the compute provider who recorded the usage or the owner can verify
        require(
            msg.sender == owner() || computeProviders[msg.sender].isActive,
            "Not authorized to verify"
        );
        
        record.proofHash = _proofHash;
        record.verified = true;
        
        // Update compute provider reputation based on verification result
        if (computeProviders[msg.sender].isActive) {
            if (_isValid) {
                computeProviders[msg.sender].successfulJobs++;
                // Increase reputation slightly for successful jobs
                if (computeProviders[msg.sender].reputation < 1000) {
                    computeProviders[msg.sender].reputation += 1;
                }
            } else {
                // Decrease reputation for failed verifications
                if (computeProviders[msg.sender].reputation > 0) {
                    computeProviders[msg.sender].reputation -= 5;
                }
            }
        }
        
        emit UsageVerified(_recordId, record.computeJobId, _isValid);
    }
    
    /**
     * @dev Get usage record details
     */
    function getUsageRecord(uint256 _recordId) 
        external 
        view 
        recordExists(_recordId) 
        returns (UsageRecord memory) 
    {
        return usageRecords[_recordId];
    }
    
    /**
     * @dev Get usage history for an agent
     */
    function getAgentUsageHistory(uint256 _agentId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return agentUsageHistory[_agentId];
    }
    
    /**
     * @dev Get usage history for a user
     */
    function getUserUsageHistory(address _user) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return userUsageHistory[_user];
    }
    
    /**
     * @dev Get compute provider details
     */
    function getComputeProvider(address _provider) 
        external 
        view 
        returns (ComputeProvider memory) 
    {
        return computeProviders[_provider];
    }
    
    /**
     * @dev Get usage statistics for an agent
     */
    function getAgentUsageStats(uint256 _agentId) 
        external 
        view 
        returns (
            uint256 totalUsage,
            uint256 verifiedUsage,
            uint256 totalComputeTime,
            uint256 totalResourcesUsed
        ) 
    {
        uint256[] memory recordIds = agentUsageHistory[_agentId];
        
        totalUsage = recordIds.length;
        verifiedUsage = 0;
        totalComputeTime = 0;
        totalResourcesUsed = 0;
        
        for (uint256 i = 0; i < recordIds.length; i++) {
            UsageRecord memory record = usageRecords[recordIds[i]];
            
            if (record.verified) {
                verifiedUsage++;
            }
            
            totalComputeTime += record.computeTime;
            totalResourcesUsed += record.resourcesUsed;
        }
    }
    
    /**
     * @dev Get usage statistics for a user
     */
    function getUserUsageStats(address _user) 
        external 
        view 
        returns (
            uint256 totalUsage,
            uint256 verifiedUsage,
            uint256 totalComputeTime,
            uint256 totalResourcesUsed
        ) 
    {
        uint256[] memory recordIds = userUsageHistory[_user];
        
        totalUsage = recordIds.length;
        verifiedUsage = 0;
        totalComputeTime = 0;
        totalResourcesUsed = 0;
        
        for (uint256 i = 0; i < recordIds.length; i++) {
            UsageRecord memory record = usageRecords[recordIds[i]];
            
            if (record.verified) {
                verifiedUsage++;
            }
            
            totalComputeTime += record.computeTime;
            totalResourcesUsed += record.resourcesUsed;
        }
    }
    
    /**
     * @dev Get total number of usage records
     */
    function getTotalUsageRecords() external view returns (uint256) {
        return _recordIdCounter;
    }
    
    /**
     * @dev Batch verify multiple usage records (for efficiency)
     */
    function batchVerifyUsage(
        uint256[] memory _recordIds,
        bytes32[] memory _proofHashes,
        bool[] memory _validityFlags
    ) external onlyOwner {
        require(
            _recordIds.length == _proofHashes.length && 
            _recordIds.length == _validityFlags.length,
            "Array lengths mismatch"
        );
        
        for (uint256 i = 0; i < _recordIds.length; i++) {
            if (usageRecords[_recordIds[i]].id != 0 && !usageRecords[_recordIds[i]].verified) {
                usageRecords[_recordIds[i]].proofHash = _proofHashes[i];
                usageRecords[_recordIds[i]].verified = true;
                
                emit UsageVerified(_recordIds[i], usageRecords[_recordIds[i]].computeJobId, _validityFlags[i]);
            }
        }
    }
}