# Agent0G Backend (Broker Layer)

Node-based broker layer that verifies user-signed intents and submits compute jobs to the 0G network using `@0glabs/0g-serving-broker`.

## Purpose
- Verify signatures from the frontend so only real user requests execute.
- Relay user-signed intents to the 0G Broker (no server wallet custody).
- Track job status and stream results back to the frontend.

## Role in the Hybrid Architecture
1) Receives signed payloads from the Frontend (model ID, prompt, params, signature).  
2) Verifies the signature against the user’s wallet address.  
3) Uses `@0glabs/0g-serving-broker` to submit the job to 0G Compute.  
4) Returns job ID, status, and results to the Frontend.  

Important: The backend does not hold private keys or pay gas. It relays the user’s signed intent so the broker/chain can settle costs directly with the user.

## API Sketch
- POST `/api/infer` — verify signature, submit job, return jobId
- GET `/api/jobs/:jobId` — fetch job status/result

## Getting Started

### Prerequisites
- Node.js LTS
- pnpm or npm

### Install
```bash
cd backend
npm install
```

### Configure
Create `.env` with broker and chain endpoints:
```
BROKER_BASE_URL=
RPC_URL=
CHAIN_ID=
CORS_ORIGIN=
```

### Run
```bash
npm run dev
```

still a work in progress though
