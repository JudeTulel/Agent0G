# AI Agent Marketplace Smart Contracts

This directory contains the smart contracts for Agent0G — a platform for agent builders to build and rent agents on the 0G L1.

## Hybrid Architecture (User-Owned Agents)

- **Frontend (Browser / React)**: Users connect a wallet sign agent creation/rental/inference intents, and send signed payloads to the backend.
- **Backend (Broker Layer using `@0glabs/0g-serving-broker`)**: Verifies signatures and relays user-signed jobs to the 0G Broker. No key custody, no server-paid gas.
- **0G Network (Broker + Compute Nodes)**: Manages escrow and settles inference costs directly from the user’s wallet; compute nodes execute jobs and return results.

### Benefits
- **Non-custodial**: We don’t hold funds; users pay directly via wallet.
- **Browser-friendly**: Node-only SDK runs server-side; UX stays simple.
- **Clear economics**: Settlement is on-chain; fees are transparent.

## Agent0G: Problem → Solution → Vision

- **The Problem**: AI access is centralized. Cloud incumbents control infra, pricing, and availability—pricing out startups and global innovators.
- **The Solution**: Agent0G combines 0G Compute, 0G Storage, and OG Chain to enable:
  - Visual, no-code agent building (n8n-like workflows)
  - On-chain registry and rental via smart contracts
  - Decentralized GPU compute for low-cost inference
  - Private, verifiable, uncensorable data and logic
- **Vision**: A global, open marketplace where anyone can build, publish, and rent AI agents that run on decentralized compute.
- **Revenue**: Protocol fee of **3%** on all rental transactions.

---

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

## Deployment Details 
AgentRegistry deployed at: 0x02D5C205B3E4F550a7c6D1432E3E12c106A25a9a
AgentRental deployed at: 0xaffd76b978b9F48F3EEbEB20cB1B43C699855Ee3
UsageTracking deployed at: 0x984E73D5F27859b05118205A9C73A3B5e0816B4B
