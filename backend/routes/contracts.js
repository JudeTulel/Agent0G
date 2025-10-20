const express = require('express');
const { ethers } = require('ethers');
const ContractService = require('../services/contractService');
const router = express.Router();

// Initialize contract service
let contractService = null;

const initContractService = () => {
  if (!contractService) {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const signer = new ethers.Wallet(process.env.SERVICE_PRIVATE_KEY, provider);
    contractService = new ContractService(provider, signer);
  }
  return contractService;
};

// Middleware to ensure contract service is initialized
const requireContracts = (req, res, next) => {
  try {
    req.contractService = initContractService();
    next();
  } catch (error) {
    res.status(500).json({
      error: 'Contract service initialization failed',
      details: error.message
    });
  }
};

// Agent Registry Routes

// Get all agents
router.get('/agents', requireContracts, async (req, res) => {
  try {
    const { offset = 0, limit = 50, category } = req.query;
    
    let agents;
    if (category && category !== 'all') {
      agents = await req.contractService.getAgentsByCategory(category, parseInt(offset), parseInt(limit));
    } else {
      agents = await req.contractService.getAllAgents(parseInt(offset), parseInt(limit));
    }
    
    res.json({
      success: true,
      agents,
      offset: parseInt(offset),
      limit: parseInt(limit),
      category: category || 'all'
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({
      error: 'Failed to fetch agents',
      details: error.message
    });
  }
});

// Get specific agent
router.get('/agents/:agentId', requireContracts, async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = await req.contractService.getAgent(agentId);
    
    res.json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({
      error: 'Failed to fetch agent',
      details: error.message
    });
  }
});

// Register new agent
router.post('/agents', requireContracts, async (req, res) => {
  try {
    const { name, description, category, workflowHash, pricePerUse, subscriptionPrice } = req.body;
    
    if (!name || !description || !category || !workflowHash) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'name, description, category, and workflowHash are required'
      });
    }
    
    const result = await req.contractService.registerAgent({
      name,
      description,
      category,
      workflowHash,
      pricePerUse: pricePerUse || 0,
      subscriptionPrice: subscriptionPrice || 0
    });
    
    res.status(201).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error registering agent:', error);
    res.status(500).json({
      error: 'Failed to register agent',
      details: error.message
    });
  }
});

// Get agent reviews
router.get('/agents/:agentId/reviews', requireContracts, async (req, res) => {
  try {
    const { agentId } = req.params;
    const reviews = await req.contractService.getAgentReviews(agentId);
    
    res.json({
      success: true,
      reviews,
      agentId
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      error: 'Failed to fetch reviews',
      details: error.message
    });
  }
});

// Add agent review
router.post('/agents/:agentId/reviews', requireContracts, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { rating, comment } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Invalid rating',
        details: 'Rating must be between 1 and 5'
      });
    }
    
    const result = await req.contractService.addReview(agentId, rating, comment || '');
    
    res.json({
      success: true,
      ...result,
      agentId,
      rating,
      comment
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      error: 'Failed to add review',
      details: error.message
    });
  }
});

// Agent Rental Routes

// Rent an agent (pay-per-use)
router.post('/agents/:agentId/rent/pay-per-use', requireContracts, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { value } = req.body; // Value in ETH

    if (!value) {
      return res.status(400).json({ error: 'Value is required for pay-per-use rental' });
    }

    const result = await req.contractService.rentAgentPayPerUse(
      agentId,
      ethers.parseEther(value.toString())
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error renting agent (pay-per-use):', error);
    res.status(500).json({ error: 'Failed to rent agent', details: error.message });
  }
});

// Rent an agent (subscription)
router.post('/agents/:agentId/rent/subscription', requireContracts, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { duration, value } = req.body; // Duration in seconds, value in ETH

    if (!duration || !value) {
      return res.status(400).json({ error: 'Duration and value are required for subscription rental' });
    }

    const result = await req.contractService.rentAgentSubscription(
      agentId,
      duration,
      ethers.parseEther(value.toString())
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error renting agent (subscription):', error);
    res.status(500).json({ error: 'Failed to rent agent', details: error.message });
  }
});

// Get rental details
router.get('/rentals/:rentalId', requireContracts, async (req, res) => {
  try {
    const { rentalId } = req.params;
    const rental = await req.contractService.getRental(rentalId);
    
    res.json({
      success: true,
      rental
    });
  } catch (error) {
    console.error('Error fetching rental:', error);
    res.status(500).json({
      error: 'Failed to fetch rental',
      details: error.message
    });
  }
});

// Usage Tracking Routes

// Record usage
router.post('/usage/record', requireContracts, async (req, res) => {
  try {
    const { agentId, rentalId, user, computeHash, cost } = req.body;
    
    if (!agentId || !rentalId || !user || !computeHash || !cost) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'agentId, rentalId, user, computeHash, and cost are required'
      });
    }
    
    const result = await req.contractService.recordUsage(agentId, rentalId, user, computeHash, cost);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error recording usage:', error);
    res.status(500).json({
      error: 'Failed to record usage',
      details: error.message
    });
  }
});

// Get usage statistics
router.get('/agents/:agentId/usage-stats', requireContracts, async (req, res) => {
  try {
    const { agentId } = req.params;
    const stats = await req.contractService.getUsageStats(agentId);
    
    res.json({
      success: true,
      stats,
      agentId
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({
      error: 'Failed to fetch usage stats',
      details: error.message
    });
  }
});

// Utility Routes

// Get agent count
router.get('/stats/agent-count', requireContracts, async (req, res) => {
  try {
    const count = await req.contractService.getAgentCount();
    
    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Error fetching agent count:', error);
    res.status(500).json({
      error: 'Failed to fetch agent count',
      details: error.message
    });
  }
});

// Get owner agents
router.get('/owners/:owner/agents', requireContracts, async (req, res) => {
  try {
    const { owner } = req.params;
    
    if (!ethers.isAddress(owner)) {
      return res.status(400).json({
        error: 'Invalid address',
        details: 'Owner must be a valid Ethereum address'
      });
    }
    
    const agentIds = await req.contractService.getOwnerAgents(owner);
    
    // Fetch full agent details for each ID
    const agents = await Promise.all(
      agentIds.map(id => req.contractService.getAgent(id))
    );
    
    res.json({
      success: true,
      agents,
      owner,
      count: agents.length
    });
  } catch (error) {
    console.error('Error fetching owner agents:', error);
    res.status(500).json({
      error: 'Failed to fetch owner agents',
      details: error.message
    });
  }
});

// Health check for contract connectivity
router.get('/health', requireContracts, async (req, res) => {
  try {
    // Test contract connectivity by getting agent count
    const count = await req.contractService.getAgentCount();
    
    res.json({
      success: true,
      status: 'healthy',
      agentCount: count,
      contracts: {
        agentRegistry: process.env.AGENT_REGISTRY_ADDRESS,
        agentRental: process.env.AGENT_RENTAL_ADDRESS,
        usageTracking: process.env.USAGE_TRACKING_ADDRESS
      },
      network: {
        rpcUrl: process.env.RPC_URL,
        chainId: 'testnet'
      }
    });
  } catch (error) {
    console.error('Contract health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
