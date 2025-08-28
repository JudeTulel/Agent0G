require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Initialize broker with your service wallet (NOT user's wallet)
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai');
const serviceWallet = new ethers.Wallet(process.env.SERVICE_PRIVATE_KEY, provider);
let broker;
let brokerInitialized = false;

// Initialize broker on startup
const initBroker = async () => {
  try {
    console.log('Initializing 0G broker...');
    console.log('Service wallet address:', serviceWallet.address);
    
    broker = await createZGComputeNetworkBroker(serviceWallet);
    brokerInitialized = true;
    console.log('✅ Broker initialized successfully');
    
    // Check wallet balance
    const balance = await provider.getBalance(serviceWallet.address);
    console.log(`Service wallet balance: ${ethers.formatEther(balance)} ETH`);
    
    // Fund service account if needed (optional)
    try {
      await broker.ledger.addLedger("0.01");
      console.log('✅ Service account funded');
    } catch (err) {
      console.log('ℹ️ Service account funding skipped or already funded:', err.message);
    }
    
    // List available services on startup
    try {
      const services = await broker.inference.listService();
      console.log(`✅ Found ${services.length} available services`);
      services.forEach((service, i) => {
        console.log(`  ${i + 1}. Provider: ${service.provider} | Model: ${service.model}`);
      });
    } catch (err) {
      console.log('⚠️ Could not list services:', err.message);
    }
    
  } catch (err) {
    console.error('❌ Failed to initialize broker:', err.message);
    brokerInitialized = false;
  }
};

// Initialize on startup
initBroker();

// Middleware to check broker status
const requireBroker = (req, res, next) => {
  if (!brokerInitialized || !broker) {
    return res.status(503).json({ 
      error: 'Broker not initialized', 
      details: 'The 0G compute broker is not ready. Please check your configuration and try again.' 
    });
  }
  next();
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    brokerInitialized,
    serviceWallet: serviceWallet.address,
    timestamp: new Date().toISOString()
  });
});

// List available services
app.get('/api/services', requireBroker, async (req, res) => {
  try {
    console.log('📋 Listing available services...');
    const services = await broker.inference.listService();
    console.log(`Found ${services.length} services`);
    res.json(services);
  } catch (err) {
    console.error('❌ Error listing services:', err.message);
    res.status(500).json({ 
      error: 'Failed to list services', 
      details: err.message 
    });
  }
});

// Acknowledge provider (server-side, using service wallet)
app.post('/api/acknowledge', requireBroker, async (req, res) => {
  const { providerAddress } = req.body;
  
  if (!providerAddress) {
    return res.status(400).json({ 
      error: 'Provider address required',
      details: 'Please provide a valid provider address to acknowledge.'
    });
  }

  try {
    console.log(`🤝 Acknowledging provider: ${providerAddress}`);
    await broker.inference.acknowledgeProviderSigner(providerAddress);
    console.log(`✅ Successfully acknowledged provider: ${providerAddress}`);
    res.json({ 
      success: true, 
      provider: providerAddress,
      acknowledgedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(`❌ Failed to acknowledge provider ${providerAddress}:`, err.message);
    res.status(500).json({ 
      error: 'Failed to acknowledge provider', 
      details: err.message,
      provider: providerAddress
    });
  }
});

// Process inference request
app.post('/api/inference', requireBroker, async (req, res) => {
  const { providerAddress, prompt, userAddress } = req.body;
  
  // Validate input
  if (!providerAddress || !prompt || !userAddress) {
    return res.status(400).json({ 
      error: 'Missing required parameters',
      details: 'providerAddress, prompt, and userAddress are all required.',
      received: { 
        providerAddress: !!providerAddress, 
        prompt: !!prompt, 
        userAddress: !!userAddress 
      }
    });
  }

  console.log(`🧠 Processing inference request:`);
  console.log(`   Provider: ${providerAddress}`);
  console.log(`   User: ${userAddress}`);
  console.log(`   Prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);

  try {
    // 1. Get service metadata
    console.log('📡 Getting service metadata...');
    const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
    console.log(`   Endpoint: ${endpoint}`);
    console.log(`   Model: ${model}`);
    
    // 2. Generate headers for the request
    console.log('🔐 Generating request headers...');
    const headers = await broker.inference.getRequestHeaders(providerAddress, prompt);
    console.log(`   Chat ID: ${headers['x-chat-id']}`);
    
    // 3. Make the request to the provider
    console.log('🚀 Making request to provider...');
    const requestBody = {
      messages: [{ role: 'user', content: prompt }],
      model,
    };
    
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        'x-user-address': userAddress // Pass user address for tracking
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Provider API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;
    
    if (!answer) {
      throw new Error('No response content received from provider');
    }
    
    console.log(`   Response length: ${answer.length} characters`);
    
    // 4. Verify response
    console.log('✅ Verifying response...');
    const chatID = headers['x-chat-id'];
    const valid = await broker.inference.processResponse(providerAddress, answer, chatID);
    console.log(`   Verification result: ${valid ? 'VALID' : 'INVALID'}`);

    const result = {
      response: answer,
      model,
      valid,
      chatId: chatID,
      timestamp: new Date().toISOString(),
      provider: providerAddress,
      user: userAddress
    };
    
    console.log('✅ Inference completed successfully');
    res.json(result);

  } catch (err) {
    console.error('❌ Inference failed:', err.message);
    
    // Provide more specific error messages
    let errorDetails = err.message;
    if (err.message.includes('Provider not found')) {
      errorDetails = 'The specified provider address was not found. Please check the address and try again.';
    } else if (err.message.includes('insufficient funds')) {
      errorDetails = 'Insufficient funds in service wallet. Please fund the service account.';
    } else if (err.message.includes('timeout')) {
      errorDetails = 'Request timed out. The provider may be busy or unavailable.';
    }
    
    res.status(500).json({ 
      error: 'Inference request failed', 
      details: errorDetails,
      provider: providerAddress,
      timestamp: new Date().toISOString()
    });
  }
});

// Get provider info
app.get('/api/provider/:address', requireBroker, async (req, res) => {
  const { address } = req.params;
  
  try {
    console.log(`📋 Getting provider info: ${address}`);
    const { endpoint, model } = await broker.inference.getServiceMetadata(address);
    res.json({
      provider: address,
      endpoint,
      model,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error(`❌ Failed to get provider info for ${address}:`, err.message);
    res.status(404).json({ 
      error: 'Provider not found', 
      details: err.message,
      provider: address
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    details: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found', 
    path: req.originalUrl,
    method: req.method
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log('🚀 Backend server started');
  console.log(`   Port: ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Service Wallet: ${serviceWallet.address}`);
  console.log(`   RPC URL: ${process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai'}`);
  console.log('');
  console.log('📋 Available endpoints:');
  console.log('   GET  /api/health');
  console.log('   GET  /api/services');
  console.log('   POST /api/acknowledge');
  console.log('   POST /api/inference');
  console.log('   GET  /api/provider/:address');
  console.log('');
});