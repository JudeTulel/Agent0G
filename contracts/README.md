# AI Agent Marketplace Smart Contracts

This directory contains the smart contracts for the AI Agent Marketplace built on 0G Chain.

## Contracts Overview

### 1. AgentRegistry.sol
The core registry contract that manages AI agent registration, metadata, and reviews.

**Key Features:**
- Agent registration and management
- Category-based organization
- Review and rating system
- Owner permissions and access control

**Main Functions:**
- `registerAgent()` - Register a new AI agent
- `updateAgent()` - Update agent details
- `addReview()` - Add user reviews and ratings
- `getAgent()` - Retrieve agent information
- `getAgentsByCategory()` - Get agents by category

### 2. AgentRental.sol
Handles the rental and payment logic for AI agents.

**Key Features:**
- Pay-per-use and subscription models
- Escrow system for secure payments
- Platform fee management
- Rental lifecycle management

**Main Functions:**
- `rentAgentPayPerUse()` - Rent agent with usage-based pricing
- `rentAgentSubscription()` - Rent agent with subscription model
- `useAgent()` - Execute agent usage
- `cancelRental()` - Cancel unused rentals
- `completeSubscription()` - Complete subscription rentals

### 3. UsageTracking.sol
Tracks and verifies AI agent usage with 0G Compute integration.

**Key Features:**
- Usage recording and verification
- Compute provider management
- Proof-based verification system
- Usage statistics and analytics

**Main Functions:**
- `recordUsage()` - Record agent usage by compute providers
- `verifyUsage()` - Verify usage with cryptographic proofs
- `registerComputeProvider()` - Register compute providers
- `getUsageStats()` - Get usage statistics

## Setup and Installation

1. Install dependencies:
```bash
cd contracts
npm install
```

2. Compile contracts:
```bash
npm run compile
```

3. Run tests:
```bash
npm run test
```

## Deployment

### Local Development
```bash
npx hardhat node
npm run deploy
```

### 0G Testnet
```bash
export PRIVATE_KEY="your_private_key_here"
npm run deploy:testnet
```

### 0G Mainnet
```bash
export PRIVATE_KEY="your_private_key_here"
npx hardhat run scripts/deploy.js --network 0g-mainnet
```

## Contract Interactions

### Registering an Agent
```javascript
const tx = await agentRegistry.registerAgent(
  "My AI Agent",
  "Description of the agent",
  "chatbot",
  "QmIPFSHash...", // 0G Storage hash
  ethers.parseEther("0.1"), // Price per use
  ethers.parseEther("1.0")  // Subscription price
);
```

### Renting an Agent
```javascript
// Pay-per-use
const rental = await agentRental.rentAgentPayPerUse(
  agentId,
  5, // Max usage count
  { value: ethers.parseEther("0.5") }
);

// Subscription
const subscription = await agentRental.rentAgentSubscription(
  agentId,
  30 * 24 * 60 * 60, // 30 days
  { value: ethers.parseEther("1.0") }
);
```

### Using an Agent
```javascript
await agentRental.useAgent(rentalId);
```

## Security Considerations

1. **Reentrancy Protection**: All state-changing functions use OpenZeppelin's ReentrancyGuard
2. **Access Control**: Proper ownership and permission checks
3. **Input Validation**: Comprehensive parameter validation
4. **Escrow System**: Secure fund management with automatic release
5. **Overflow Protection**: Using Solidity 0.8+ built-in overflow protection

## Gas Optimization

- Efficient storage patterns
- Batch operations where possible
- Optimized loops and iterations
- Minimal external calls

## Integration with 0G Ecosystem

### 0G Storage
- Agent workflows stored as IPFS hashes on 0G Storage
- Metadata and large files stored off-chain
- Immutable storage for agent definitions

### 0G Compute
- Integration with compute providers
- Verifiable computation proofs
- Resource usage tracking
- Decentralized AI model execution


