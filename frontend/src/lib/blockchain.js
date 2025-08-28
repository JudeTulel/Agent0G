import { createConfig, http } from 'wagmi'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

// 0G Galileo Testnet configuration
export const ogTestnet = {
  id: 9000,
  name: '0G Galileo Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://evmrpc-testnet.0g.ai'],
    },
  },
  blockExplorers: {
    default: {
      name: '0G Testnet Explorer',
      url: 'https://explorer-testnet.0g.ai',
    },
  },
}

// Wagmi configuration
export const config = createConfig({
  chains: [ogTestnet],
  connectors: [
    injected(),
    metaMask(),
    walletConnect({
      projectId: process.env.VITE_WALLETCONNECT_PROJECT_ID, 
    }),
  ],
  transports: {
    [ogTestnet.id]: http(),
  },
})

// Smart contract addresses
export const CONTRACT_ADDRESSES = {
  AgentRegistry: '0x02D5C205B3E4F550a7c6D1432E3E12c106A25a9a',
  AgentRental: '0xaffd76b978b9F48F3EEbEB20cB1B43C699855Ee3',
  UsageTracking: '0x984E73D5F27859b05118205A9C73A3B5e0816B4B',
}

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

export const getExplorerUrl = (hash, type = 'tx') => {
  return `${ogTestnet.blockExplorers.default.url}/${type}/${hash}`
}