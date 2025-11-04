import { ethers } from "ethers";
import abi from "./AgentRegistryABI.json";

// Contract configuration
export const CONTRACT_ADDRESS = import.meta.env.VITE_AGENT_REGISTRY_CONTRACT || "0x984E73D5F27859b05118205A9C73A3B5e0816B4B";

/**
 * Get the AgentRegistry contract instance with signer
 * @returns {Promise<ethers.Contract>} Contract instance
 */
export async function getAgentRegistryContract() {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed. Please install MetaMask to continue.");
  }

  try {
    // Request account access
    await window.ethereum.request({ method: "eth_requestAccounts" });

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
    return contract;
  } catch (error) {
    console.error("Error connecting to contract:", error);
    throw new Error(`Failed to connect to contract: ${error.message}`);
  }
}

/**
 * Register a new agent on the blockchain
 * @param {Object} agentData - Agent registration data
 * @param {string} agentData.name - Agent name
 * @param {string} agentData.description - Agent description  
 * @param {string} agentData.category - Agent category
 * @param {string} agentData.workflowHash - Workflow hash from 0G Storage
 * @param {string} agentData.pricePerUse - Price per use in ETH (e.g., "0.01")
 * @param {string} agentData.subscriptionPrice - Subscription price in ETH (e.g., "0.1")
 * @returns {Promise<{agentId: string, txHash: string}>} Registration result
 */
export async function registerAgent(agentData) {
  try {
    const contract = await getAgentRegistryContract();
    
    const {
      name,
      description, 
      category,
      workflowHash,
      pricePerUse = "0",
      subscriptionPrice = "0"
    } = agentData;

    // Validate required fields
    if (!name || !description || !category || !workflowHash) {
      throw new Error("Missing required fields: name, description, category, and workflowHash are required");
    }

    // Parse prices to wei
    const pricePerUseWei = ethers.parseEther(pricePerUse.toString());
    const subscriptionPriceWei = ethers.parseEther(subscriptionPrice.toString());

    console.log("🔄 Registering agent on blockchain...");
    console.log("Agent data:", {
      name,
      description,
      category,
      workflowHash,
      pricePerUse: ethers.formatEther(pricePerUseWei),
      subscriptionPrice: ethers.formatEther(subscriptionPriceWei)
    });

    // Call registerAgent function
    const tx = await contract.registerAgent(
      name,
      description,
      category,
      workflowHash,
      pricePerUseWei,
      subscriptionPriceWei
    );

    console.log("📄 Transaction submitted:", tx.hash);
    console.log("⏳ Waiting for confirmation...");

    // Wait for transaction confirmation
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed:", receipt);

    // Extract agent ID from events
    const agentRegisteredEvent = receipt.logs.find(log => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog.name === 'AgentRegistered';
      } catch {
        return false;
      }
    });

    let agentId = null;
    if (agentRegisteredEvent) {
      const parsedLog = contract.interface.parseLog(agentRegisteredEvent);
      agentId = parsedLog.args.agentId.toString();
      console.log("🎉 Agent registered with ID:", agentId);
    }

    return {
      agentId,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    };

  } catch (error) {
    console.error("❌ Agent registration failed:", error);
    throw new Error(`Agent registration failed: ${error.message}`);
  }
}

/**
 * Get agent details by ID
 * @param {string|number} agentId - Agent ID
 * @returns {Promise<Object>} Agent details
 */
export async function getAgent(agentId) {
  try {
    const contract = await getAgentRegistryContract();
    const agent = await contract.getAgent(agentId);
    
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
      rating: agent.rating.toString(),
      reviewCount: agent.reviewCount.toString(),
      createdAt: new Date(Number(agent.createdAt) * 1000).toISOString(),
      updatedAt: new Date(Number(agent.updatedAt) * 1000).toISOString()
    };
  } catch (error) {
    console.error("Error fetching agent:", error);
    throw new Error(`Failed to fetch agent: ${error.message}`);
  }
}

/**
 * Get paginated active agents
 * @param {number} offset - Offset for pagination (default: 0)
 * @param {number} limit - Limit for pagination (default: 10)
 * @returns {Promise<Array>} Array of active agents
 */
export async function getActiveAgents(offset = 0, limit = 10) {
  try {
    const contract = await getAgentRegistryContract();
    const agents = await contract.getActiveAgents(offset, limit);
    
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
      rating: agent.rating.toString(),
      reviewCount: agent.reviewCount.toString(),
      createdAt: new Date(Number(agent.createdAt) * 1000).toISOString(),
      updatedAt: new Date(Number(agent.updatedAt) * 1000).toISOString()
    }));
  } catch (error) {
    console.error("Error fetching active agents:", error);
    throw new Error(`Failed to fetch active agents: ${error.message}`);
  }
}

/**
 * Get agent reviews
 * @param {string|number} agentId - Agent ID
 * @returns {Promise<Array>} Array of reviews
 */
export async function getAgentReviews(agentId) {
  try {
    const contract = await getAgentRegistryContract();
    const reviews = await contract.getAgentReviews(agentId);
    
    return reviews.map(review => ({
      reviewer: review.reviewer,
      agentId: review.agentId.toString(),
      rating: review.rating.toString(),
      comment: review.comment,
      timestamp: new Date(Number(review.timestamp) * 1000).toISOString()
    }));
  } catch (error) {
    console.error("Error fetching reviews:", error);
    throw new Error(`Failed to fetch reviews: ${error.message}`);
  }
}

/**
 * Activate an agent (only owner)
 * @param {string|number} agentId - Agent ID
 * @returns {Promise<string>} Transaction hash
 */
export async function activateAgent(agentId) {
  try {
    const contract = await getAgentRegistryContract();
    const tx = await contract.activateAgent(agentId);
    await tx.wait();
    console.log("✅ Agent activated!");
    return tx.hash;
  } catch (error) {
    console.error("Error activating agent:", error);
    throw new Error(`Failed to activate agent: ${error.message}`);
  }
}

/**
 * Deactivate an agent (only owner)
 * @param {string|number} agentId - Agent ID
 * @returns {Promise<string>} Transaction hash
 */
export async function deactivateAgent(agentId) {
  try {
    const contract = await getAgentRegistryContract();
    const tx = await contract.deactivateAgent(agentId);
    await tx.wait();
    console.log("✅ Agent deactivated!");
    return tx.hash;
  } catch (error) {
    console.error("Error deactivating agent:", error);
    throw new Error(`Failed to deactivate agent: ${error.message}`);
  }
}

/**
 * Check if MetaMask is connected to the correct network
 * @returns {Promise<boolean>} True if on correct network
 */
export async function checkNetwork() {
  try {
    if (!window.ethereum) return false;
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    
    // Check if connected to 0G testnet (chain ID might need to be updated)
    const expectedChainId = import.meta.env.VITE_CHAIN_ID || "9000"; // 0G testnet chain ID
    
    return network.chainId.toString() === expectedChainId;
  } catch (error) {
    console.error("Error checking network:", error);
    return false;
  }
}

/**
 * Get current connected wallet address
 * @returns {Promise<string|null>} Wallet address or null
 */
export async function getConnectedAddress() {
  try {
    if (!window.ethereum) return null;
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return await signer.getAddress();
  } catch (error) {
    console.error("Error getting connected address:", error);
    return null;
  }
}