import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'
import { allAgents } from '../data/mockData'
import { ethers } from 'ethers'

// 0G Chain configuration
export const ogChain = {
  id: 8888,
  name: '0G Chain',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://evmrpc.0g.ai'],
    },
  },
  blockExplorers: {
    default: {
      name: '0G Explorer',
      url: 'https://scan.0g.ai',
    },
  },
}

export const ogTestnet = {
  id: 16602,
  name: '0G-Galileo-Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'OG',
    symbol: 'OG',
  },
  rpcUrls: {
    default: {
      http: ['https://evmrpc-testnet.0g.ai'],
    },
  },
  blockExplorers: {
    default: {
      name: '0G Galileo Explorer',
      url: 'https://chainscan-galileo.0g.ai',
    },
  },
}

// Wagmi configuration
export const config = createConfig({
  chains: [ogChain, ogTestnet, mainnet, sepolia],
  connectors: [
    injected(),
    metaMask(),
    walletConnect({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID , 
    }),
  ],
  transports: {
    [ogChain.id]: http(),
    [ogTestnet.id]: http(),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})

// Smart contract addresses 
export const CONTRACT_ADDRESSES = {
  [ogTestnet.id]: {
    AgentRegistry: '0x27ba7979978d28Ff39918c89379391B90675Ab3f', 
    AgentRental: '0xE540671912401FB13405e81958a19e9F4153437f',
    UsageTracking: '',
  },
  [ogChain.id]: {
    AgentRegistry: '0x4567890123456789012345678901234567890123',
    AgentRental: '0x5678901234567890123456789012345678901234',
    UsageTracking: '0xeB47b31e69CA4fE4fe1A6fCf11Cb107F24F1302B',
  },
}

// API base URL
const API_BASE_URL = 'https://agent0g.onrender.com/api';

/**
 * Fetches all agents from the backend.
 * @param {object} filters - Optional filters (e.g., { category: 'DeFi', limit: 20 }).
 * @returns {Promise<Array>} - A promise that resolves to an array of agents.
 */
export const fetchAgents = async (filters = {}) => {
  try {
    const query = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_BASE_URL}/contracts/agents?${query}`);
    if (!response.ok) {
      console.warn(`API fetch failed with status ${response.status}, falling back to mock data.`);
      return allAgents; // Fallback on HTTP error
    }
    const data = await response.json();
    const agents = (data.agents || []).map(agent => ({
      ...agent,
      id: agent.id.toString(),
      pricePerUse: agent.pricePerUse ? parseFloat(ethers.formatEther(agent.pricePerUse)) : 0,
      subscriptionPrice: agent.subscriptionPrice ? parseFloat(ethers.formatEther(agent.subscriptionPrice)) : 0,
      rating: Number(agent.rating || 0),
      reviewCount: Number(agent.reviewCount || 0),
      totalUsage: Number(agent.totalUsage || 0),
    }));

    if (agents.length === 0) {
      // fallback to mocks if backend returns empty
      console.log("No agents returned from API, using mock data.");
      return allAgents;
    }

    return agents;
  } catch (error) {
    console.error("Failed to fetch agents:", error);
    // Return mock agents on any other error
    return allAgents;
  }
};

/**
 * Fetches a single agent by its ID.
 * @param {string|number} agentId - The ID of the agent to fetch.
 * @returns {Promise<object|null>} - A promise that resolves to the agent object or null if not found.
 */
export const fetchAgentById = async (agentId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/contracts/agents/${agentId}`);
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Agent ${agentId} not found in API, falling back to mock data.`);
        return allAgents.find(agent => agent.id.toString() === agentId.toString()) || null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const agent = data.agent;
    return {
      ...agent,
      id: agent.id.toString(),
      pricePerUse: parseFloat(ethers.formatEther(agent.pricePerUse || '0')),
      subscriptionPrice: parseFloat(ethers.formatEther(agent.subscriptionPrice || '0')),
      rating: Number(agent.rating),
      reviewCount: Number(agent.reviewCount),
      totalUsage: Number(agent.totalUsage),
    };
  } catch (error) {
    console.error(`Failed to fetch agent ${agentId}:`, error);
    return allAgents.find(agent => agent.id.toString() === agentId.toString()) || null;
  }
};


// Contract ABIs 
export const AGENT_REGISTRY_ABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "_name", "type": "string"},
      {"internalType": "string", "name": "_description", "type": "string"},
      {"internalType": "string", "name": "_category", "type": "string"},
      {"internalType": "string", "name": "_workflowHash", "type": "string"},
      {"internalType": "uint256", "name": "_pricePerUse", "type": "uint256"},
      {"internalType": "uint256", "name": "_subscriptionPrice", "type": "uint256"}
    ],
    "name": "registerAgent",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_agentId", "type": "uint256"}],
    "name": "getAgent",
    "outputs": [
      {
        "components": [
          {"internalType": "uint256", "name": "id", "type": "uint256"},
          {"internalType": "string", "name": "name", "type": "string"},
          {"internalType": "string", "name": "description", "type": "string"},
          {"internalType": "string", "name": "category", "type": "string"},
          {"internalType": "address", "name": "owner", "type": "address"},
          {"internalType": "string", "name": "workflowHash", "type": "string"},
          {"internalType": "uint256", "name": "pricePerUse", "type": "uint256"},
          {"internalType": "uint256", "name": "subscriptionPrice", "type": "uint256"},
          {"internalType": "uint256", "name": "rating", "type": "uint256"},
          {"internalType": "uint256", "name": "reviewCount", "type": "uint256"},
          {"internalType": "uint256", "name": "totalUsage", "type": "uint256"},
          {"internalType": "bool", "name": "isActive", "type": "bool"},
          {"internalType": "uint256", "name": "createdAt", "type": "uint256"}
        ],
        "internalType": "struct AgentRegistry.Agent",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "agentId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "owner", "type": "address"},
      {"indexed": false, "internalType": "string", "name": "name", "type": "string"}
    ],
    "name": "AgentRegistered",
    "type": "event"
  }
]

export const AGENT_RENTAL_ABI = [
  {
    "inputs": [
      {"internalType": "uint256", "name": "_agentId", "type": "uint256"},
      {"internalType": "uint256", "name": "_maxUsage", "type": "uint256"}
    ],
    "name": "rentAgentPayPerUse",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_agentId", "type": "uint256"},
      {"internalType": "uint256", "name": "_duration", "type": "uint256"}
    ],
    "name": "rentAgentSubscription",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_rentalId", "type": "uint256"}],
    "name": "useAgent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "rentalId", "type": "uint256"},
      {"indexed": true, "internalType": "uint256", "name": "agentId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "renter", "type": "address"}
    ],
    "name": "RentalCreated",
    "type": "event"
  }
]

// Utility functions
export const formatEther = (value) => {
  try {
    return parseFloat(value) / 1e18
  } catch {
    return 0
  }
}

export const parseEther = (value) => {
  try {
    return BigInt(Math.floor(parseFloat(value) * 1e18))
  } catch {
    return BigInt(0)
  }
}

export const shortenAddress = (address) => {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export const getExplorerUrl = (chainId, hash, type = 'tx') => {
  const chain = chainId === ogChain.id ? ogChain : ogTestnet
  return `${chain.blockExplorers.default.url}/${type}/${hash}`
}

