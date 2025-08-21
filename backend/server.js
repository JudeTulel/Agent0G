// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize broker with your service wallet (NOT user's wallet)
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai');
const serviceWallet = new ethers.Wallet(process.env.SERVICE_PRIVATE_KEY, provider);
let broker;

// Initialize broker on startup
const initBroker = async () => {
  try {
    broker = await createZGComputeNetworkBroker(serviceWallet);
    console.log('Broker initialized successfully');
    
    // Fund service account (optional - for your service operations)
    try {
      await broker.ledger.addLedger("0.01");
      console.log('Service account funded');
    } catch (err) {
      console.log('Service account funding skipped or already funded');
    }
  } catch (err) {
    console.error('Failed to initialize broker:', err);
  }
};

initBroker();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', brokerInitialized: !!broker });
});

// List available services
app.get('/api/services', async (req, res) => {
  if (!broker) return res.status(500).json({ error: 'Broker not initialized' });
  
  try {
    const services = await broker.inference.listService();
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Acknowledge provider (server-side, using service wallet)
app.post('/api/acknowledge', async (req, res) => {
  const { providerAddress } = req.body;
  if (!broker) return res.status(500).json({ error: 'Broker not initialized' });
  if (!providerAddress) return res.status(400).json({ error: 'Provider address required' });

  try {
    await broker.inference.acknowledgeProviderSigner(providerAddress);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process inference request (user pays for their own usage)
app.post('/api/inference', async (req, res) => {
  const { providerAddress, prompt, userAddress } = req.body;
  if (!broker) return res.status(500).json({ error: 'Broker not initialized' });
  if (!providerAddress || !prompt || !userAddress) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // 1. Get service metadata
    const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
    
    // 2. Generate headers - this is where user's address is used
    // The broker will handle payment from the service wallet first,
    // then you can charge the user separately
    const headers = await broker.inference.getRequestHeaders(providerAddress, prompt);
    
    // 3. Make the request to the provider
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        ...headers,
        'x-user-address': userAddress // Pass user address for tracking
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        model,
      }),
    });

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;
    
    // 4. Verify response
    const chatID = headers['x-chat-id'];
    const valid = await broker.inference.processResponse(providerAddress, answer, chatID);

    res.json({
      response: answer,
      model,
      valid,
      chatId: chatID
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});