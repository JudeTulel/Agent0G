import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

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
      http: ['https://rpc-zero-gravity-mainnet.0g.ai'],
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
  id: 16601,
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
      projectId: 'your-project-id', // Replace with actual WalletConnect project ID
    }),
  ],
  transports: {
    [ogChain.id]: http(),
    [ogTestnet.id]: http(),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})

// Smart contract addresses (from deployment)
export const CONTRACT_ADDRESSES = {
  [ogTestnet.id]: {
    AgentRegistry: '0x1234567890123456789012345678901234567890', // Replace with actual addresses
    AgentRental: '0x2345678901234567890123456789012345678901',
    UsageTracking: '0x3456789012345678901234567890123456789012',
  },
  [ogChain.id]: {
    AgentRegistry: '0x4567890123456789012345678901234567890123',
    AgentRental: '0x5678901234567890123456789012345678901234',
    UsageTracking: '0x6789012345678901234567890123456789012345',
  },
}

// Contract ABIs (simplified for demo)
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

