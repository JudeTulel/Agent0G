# Agent0G Frontend

A browser-based React application for building and renting user-owned AI agents on the 0G network.

## Purpose
- Provide a no-code, visual builder (n8n-like) for composing AI agent workflows.
- Let users discover, review, and rent agents listed on-chain.
- Enable non-custodial, user-signed interactions with 0G smart contracts.

## Role in the Hybrid Architecture
1) Wallet-first UX (MetaMask, WalletConnect, TON Connect if on TON).  
2) When a user creates an agent or requests inference, the app:
   - Prepares the request payload (model ID, prompt, session params).
   - Asks the user to sign the payload with their wallet (proves user intent).
   - Sends the signed payload to the Backend Broker API.  
3) Users pay gas/inference cost directly with their wallet. The transaction targets the 0G contracts; the frontend never holds user funds.

## Key Features
- Agent creation and publishing to on-chain registry.
- Agent marketplace browsing with reviews/ratings.
- Rental flows: pay-per-use or subscription (escrow-backed).
- Signed inference requests routed via the Backend Broker.

## Getting Started

### Prerequisites
- Node.js LTS, pnpm or npm
- A web3 wallet (MetaMask recommended) in your browser

### Install
```bash
cd frontend
pnpm install # or npm install
```

### Configure
Create `.env` (or `.env.local`) with:
```
VITE_RPC_URL=
VITE_CHAIN_ID=
VITE_AGENT_REGISTRY_ADDRESS=
VITE_AGENT_RENTAL_ADDRESS=
VITE_BACKEND_API_URL=
```

### Run
```bash
pnpm dev # or npm run dev
```

## Integration Notes
- Use the wallet to sign all critical user intents (create, rent, inference).
- Do NOT send private keys to the backend. The backend relays the user-signed intent.
- Keep revert messages/UI in sync with contracts for clear error surfaces.

## Why This Matters (VC Lens)
- Non-custodial, pay-as-you-go UX lowers risk and support burden.
- Browser-native onboarding; wallet abstracts payments and identity.
- Frontend focuses on growth and UX while compute, payment, and trust are verifiable on-chain.
