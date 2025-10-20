const { ethers } = require('ethers');

// Contract ABIs (simplified for key functions)
const AGENT_REGISTRY_ABI = [
  "function registerAgent(string name, string description, string category, string workflowHash, uint256 pricePerUse, uint256 subscriptionPrice) external returns (uint256)",
  "function updateAgent(uint256 agentId, string name, string description, string category, string workflowHash, uint256 pricePerUse, uint256 subscriptionPrice) external",
  "function activateAgent(uint256 agentId) external",
  "function deactivateAgent(uint256 agentId) external",
  "function getAgent(uint256 agentId) external view returns (tuple(uint256 id, address owner, string name, string description, string category, string workflowHash, uint256 pricePerUse, uint256 subscriptionPrice, bool isActive, uint256 totalUsage, uint256 rating, uint256 reviewCount, uint256 createdAt, uint256 updatedAt))",
  "function getAgentsByCategory(string category, uint256 offset, uint256 limit) external view returns (tuple(uint256 id, address owner, string name, string description, string category, string workflowHash, uint256 pricePerUse, uint256 subscriptionPrice, bool isActive, uint256 totalUsage, uint256 rating, uint256 reviewCount, uint256 createdAt, uint256 updatedAt)[])",
  "function getAllAgents(uint256 offset, uint256 limit) external view returns (tuple(uint256 id, address owner, string name, string description, string category, string workflowHash, uint256 pricePerUse, uint256 subscriptionPrice, bool isActive, uint256 totalUsage, uint256 rating, uint256 reviewCount, uint256 createdAt, uint256 updatedAt)[])",
  "function addReview(uint256 agentId, uint256 rating, string comment) external",
  "function getAgentReviews(uint256 agentId) external view returns (tuple(address reviewer, uint256 agentId, uint256 rating, string comment, uint256 timestamp)[])",
  "function getOwnerAgents(address owner) external view returns (uint256[])",
  "function hasReviewed(address reviewer, uint256 agentId) external view returns (bool)",
  "function getAgentCount() external view returns (uint256)"
];

const AGENT_RENTAL_ABI = [
  "function rentAgentPayPerUse(uint256 agentId) external payable returns (uint256)",
  "function rentAgentSubscription(uint256 agentId, uint256 duration) external payable returns (uint256)",
  "function useAgent(uint256 rentalId, bytes data) external returns (bytes)",
  "function cancelRental(uint256 rentalId) external",
  "function completeSubscription(uint256 rentalId) external",
  "function getRental(uint256 rentalId) external view returns (tuple(uint256 id, uint256 agentId, address renter, uint256 rentalType, uint256 startTime, uint256 endTime, uint256 totalCost, uint256 usageCount, bool isActive))",
  "function getUserRentals(address user) external view returns (uint256[])",
  "function getAgentRentals(uint256 agentId) external view returns (uint256[])"
];

const USAGE_TRACKING_ABI = [
  "function recordUsage(uint256 agentId, uint256 rentalId, address user, bytes32 computeHash, uint256 cost) external",
  "function verifyUsage(uint256 usageId, bytes proof) external returns (bool)",
  "function getUsageStats(uint256 agentId) external view returns (tuple(uint256 totalUsage, uint256 totalCost, uint256 averageCost, uint256 lastUsed))",
  "function getUserUsage(address user) external view returns (tuple(uint256 totalUsage, uint256 totalCost, uint256 agentsUsed)[])",
  "function registerComputeProvider(address provider, string endpoint) external"
];

class ContractService {
  constructor(provider, signer) {
    this.provider = provider;
    this.signer = signer;
    
    // Initialize contract instances
    this.agentRegistry = new ethers.Contract(
      process.env.AGENT_REGISTRY_ADDRESS,
      AGENT_REGISTRY_ABI,
      signer
    );
    
    this.agentRental = new ethers.Contract(
      process.env.AGENT_RENTAL_ADDRESS,
      AGENT_RENTAL_ABI,
      signer
    );
    
    this.usageTracking = new ethers.Contract(
      process.env.USAGE_TRACKING_ADDRESS,
      USAGE_TRACKING_ABI,
      signer
    );
  }

  // Agent Registry Methods
  async registerAgent(agentData) {
    try {
      const { name, description, category, workflowHash, pricePerUse, subscriptionPrice } = agentData;
      
      const tx = await this.agentRegistry.registerAgent(
        name,
        description,
        category,
        workflowHash,
        ethers.parseEther(pricePerUse.toString()),
        ethers.parseEther(subscriptionPrice.toString())
      );
      
      const receipt = await tx.wait();
      
      // Extract agent ID from events
      const event = receipt.logs.find(log => {
        try {
          return this.agentRegistry.interface.parseLog(log).name === 'AgentRegistered';
        } catch {
          return false;
        }
      });
      
      const agentId = event ? this.agentRegistry.interface.parseLog(event).args.agentId : null;
      
      return {
        success: true,
        agentId: agentId?.toString(),
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('Error registering agent:', error);
      throw new Error(`Failed to register agent: ${error.message}`);
    }
  }

  // Agent Rental Methods
  async rentAgentPayPerUse(agentId, value) {
    try {
      const tx = await this.agentRental.rentAgentPayPerUse(agentId, { value });
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => {
        try {
          const parsedLog = this.agentRental.interface.parseLog(log);
          return parsedLog && parsedLog.name === 'AgentRented';
        } catch {
          return false;
        }
      });

      const rentalId = event ? this.agentRental.interface.parseLog(event).args.rentalId : null;

      return {
        success: true,
        rentalId: rentalId?.toString(),
        txHash: tx.hash,
      };
    } catch (error) {
      console.error('Error renting agent (pay-per-use):', error);
      throw new Error(`Failed to rent agent for pay-per-use: ${error.message}`);
    }
  }

  async rentAgentSubscription(agentId, duration, value) {
    try {
      const tx = await this.agentRental.rentAgentSubscription(agentId, duration, { value });
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => {
        try {
          const parsedLog = this.agentRental.interface.parseLog(log);
          return parsedLog && parsedLog.name === 'AgentRented';
        } catch {
          return false;
        }
      });
      
      const rentalId = event ? this.agentRental.interface.parseLog(event).args.rentalId : null;

      return {
        success: true,
        rentalId: rentalId?.toString(),
        txHash: tx.hash,
      };
    } catch (error) {
      console.error('Error renting agent (subscription):', error);
      throw new Error(`Failed to rent agent via subscription: ${error.message}`);
    }
  }

  async getAgent(agentId) {
    try {
      const agent = await this.agentRegistry.getAgent(agentId);
      
      return {
        id: agent.id.toString(),
        owner: agent.owner,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        workflowHash: agent.workflowHash,
        pricePerUse: ethers.formatEther(agent.pricePerUse),
        subscriptionPrice: ethers.formatEther(agent.subscriptionPrice),
        isActive: agent.isActive,
        totalUsage: agent.totalUsage.toString(),
        rating: (Number(agent.rating) / 100).toFixed(2), // Convert from basis points
        reviewCount: agent.reviewCount.toString(),
        createdAt: new Date(Number(agent.createdAt) * 1000).toISOString(),
        updatedAt: new Date(Number(agent.updatedAt) * 1000).toISOString()
      };
    } catch (error) {
      console.error('Error getting agent:', error);
      throw new Error(`Failed to get agent: ${error.message}`);
    }
  }

  async getAllAgents(offset = 0, limit = 50) {
    try {
      const agents = await this.agentRegistry.getAllAgents(offset, limit);
      
      return agents.map(agent => ({
        id: agent.id.toString(),
        owner: agent.owner,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        workflowHash: agent.workflowHash,
        pricePerUse: ethers.formatEther(agent.pricePerUse),
        subscriptionPrice: ethers.formatEther(agent.subscriptionPrice),
        isActive: agent.isActive,
        totalUsage: agent.totalUsage.toString(),
        rating: (Number(agent.rating) / 100).toFixed(2),
        reviewCount: agent.reviewCount.toString(),
        createdAt: new Date(Number(agent.createdAt) * 1000).toISOString(),
        updatedAt: new Date(Number(agent.updatedAt) * 1000).toISOString()
      }));
    } catch (error) {
      console.error('Error getting all agents:', error);
      throw new Error(`Failed to get agents: ${error.message}`);
    }
  }

  async getAgentsByCategory(category, offset = 0, limit = 50) {
    try {
      const agents = await this.agentRegistry.getAgentsByCategory(category, offset, limit);
      
      return agents.map(agent => ({
        id: agent.id.toString(),
        owner: agent.owner,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        workflowHash: agent.workflowHash,
        pricePerUse: ethers.formatEther(agent.pricePerUse),
        subscriptionPrice: ethers.formatEther(agent.subscriptionPrice),
        isActive: agent.isActive,
        totalUsage: agent.totalUsage.toString(),
        rating: (Number(agent.rating) / 100).toFixed(2),
        reviewCount: agent.reviewCount.toString(),
        createdAt: new Date(Number(agent.createdAt) * 1000).toISOString(),
        updatedAt: new Date(Number(agent.updatedAt) * 1000).toISOString()
      }));
    } catch (error) {
      console.error('Error getting agents by category:', error);
      throw new Error(`Failed to get agents by category: ${error.message}`);
    }
  }

  async addReview(agentId, rating, comment) {
    try {
      const tx = await this.agentRegistry.addReview(agentId, rating, comment);
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('Error adding review:', error);
      throw new Error(`Failed to add review: ${error.message}`);
    }
  }

  async getAgentReviews(agentId) {
    try {
      const reviews = await this.agentRegistry.getAgentReviews(agentId);
      
      return reviews.map(review => ({
        reviewer: review.reviewer,
        agentId: review.agentId.toString(),
        rating: review.rating.toString(),
        comment: review.comment,
        timestamp: new Date(Number(review.timestamp) * 1000).toISOString()
      }));
    } catch (error) {
      console.error('Error getting agent reviews:', error);
      throw new Error(`Failed to get agent reviews: ${error.message}`);
    }
  }

  async getRental(rentalId) {
    try {
      const rental = await this.agentRental.getRental(rentalId);
      
      return {
        id: rental.id.toString(),
        agentId: rental.agentId.toString(),
        renter: rental.renter,
        rentalType: rental.rentalType.toString(),
        startTime: new Date(Number(rental.startTime) * 1000).toISOString(),
        endTime: new Date(Number(rental.endTime) * 1000).toISOString(),
        totalCost: ethers.formatEther(rental.totalCost),
        usageCount: rental.usageCount.toString(),
        isActive: rental.isActive
      };
    } catch (error) {
      console.error('Error getting rental:', error);
      throw new Error(`Failed to get rental: ${error.message}`);
    }
  }

  // Usage Tracking Methods
  async recordUsage(agentId, rentalId, user, computeHash, cost) {
    try {
      const tx = await this.usageTracking.recordUsage(
        agentId,
        rentalId,
        user,
        computeHash,
        ethers.parseEther(cost.toString())
      );
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('Error recording usage:', error);
      throw new Error(`Failed to record usage: ${error.message}`);
    }
  }

  async getUsageStats(agentId) {
    try {
      const stats = await this.usageTracking.getUsageStats(agentId);
      
      return {
        totalUsage: stats.totalUsage.toString(),
        totalCost: ethers.formatEther(stats.totalCost),
        averageCost: ethers.formatEther(stats.averageCost),
        lastUsed: new Date(Number(stats.lastUsed) * 1000).toISOString()
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      throw new Error(`Failed to get usage stats: ${error.message}`);
    }
  }

  // Utility Methods
  async getAgentCount() {
    try {
      const count = await this.agentRegistry.getAgentCount();
      return count.toString();
    } catch (error) {
      console.error('Error getting agent count:', error);
      throw new Error(`Failed to get agent count: ${error.message}`);
    }
  }

  async getOwnerAgents(owner) {
    try {
      const agentIds = await this.agentRegistry.getOwnerAgents(owner);
      return agentIds.map(id => id.toString());
    } catch (error) {
      console.error('Error getting owner agents:', error);
      throw new Error(`Failed to get owner agents: ${error.message}`);
    }
  }
}

module.exports = ContractService;
