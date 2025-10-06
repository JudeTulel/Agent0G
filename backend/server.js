require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');
const { Indexer, ZgFile, Batcher, KvClient } = require('@0glabs/0g-ts-sdk');
const OpenAI = require('openai').default;

// --- BigInt Handling Utilities ---
const convertBigIntToString = (data) => {
  if (data === null || data === undefined) return data;
  if (typeof data === 'bigint') return data.toString();
  if (Array.isArray(data)) return data.map(item => convertBigIntToString(item));
  if (typeof data === 'object') {
    const result = {};
    for (const key in data) {
      result[key] = convertBigIntToString(data[key]);
    }
    return result;
  }
  return data;
};

// Small helper to wait between chain operations
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// BigInt middleware for Express responses
const bigintJsonMiddleware = (req, res, next) => {
  const originalJson = res.json;
  res.json = function (obj) {
    try {
      const serializedObj = convertBigIntToString(obj);
      return originalJson.call(this, serializedObj);
    } catch (err) {
      return originalJson.call(this, { error: 'Serialization error', details: String(err) });
    }
  };
  next();
};

// --- Configuration ---
const RPC_URL = process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai';
const INDEXER_RPC = process.env.INDEXER_RPC || 'https://indexer-storage-testnet-turbo.0g.ai';
const KV_NODE_URL = process.env.KV_NODE_URL || 'http://3.101.147.150:6789';

// Initialize providers and wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
provider.getFeeData = async () => ({
  gasPrice: ethers.parseUnits('5', 'gwei'),
  maxFeePerGas: ethers.parseUnits('20', 'gwei'),
  maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
});

const serviceWallet = new ethers.Wallet(process.env.SERVICE_PRIVATE_KEY, provider);

// Nonce management for replacement fee issues
let lastNonce = null;
const getNextNonce = async () => {
  const currentNonce = await provider.getTransactionCount(serviceWallet.address, 'pending');
  if (lastNonce === null || currentNonce > lastNonce) {
    lastNonce = currentNonce;
  } else {
    lastNonce++; // Increment if we have pending transactions
  }
  console.log(`🔢 Using nonce: ${lastNonce}`);
  return lastNonce;
};

// --- Broker Management ---
let broker = null;
let brokerInitialized = false;

// Check for stuck transactions


const initBroker = async () => {
  try {
    console.log('🔄 Initializing 0G Compute broker...');
    console.log('Service wallet address:', serviceWallet.address);

    // Initialize broker (simplified)
    broker = await createZGComputeNetworkBroker(serviceWallet);
    brokerInitialized = true;

    console.log('✅ Compute broker initialized successfully');

    // Check wallet balance first
    const balance = await provider.getBalance(serviceWallet.address);
    console.log(`Service wallet balance: ${ethers.formatEther(balance)} 0G`);
    
    if (balance === 0n) {
      throw new Error('Service wallet has zero balance. Please fund the wallet first.');
    }

    // Initialize broker with minimal parameters to avoid decode issues
    broker = await createZGComputeNetworkBroker(serviceWallet);
    brokerInitialized = true;

    console.log(`✅ Compute broker initialized successfully`);

    // Initialize account with initial funding
    await setupAccount();

    // Try to list services, but don't fail initialization if this fails
    try {
      const services = await broker.inference.listService();
      console.log(`✅ Found ${services.length} compute services`);
    } catch (serviceError) {
      console.log('ℹ️  No services available yet or service listing failed:', serviceError.message);
    }

  } catch (err) {
    console.error('❌ Failed to initialize compute broker:', err?.message || err);
    console.error('Full error details:', err);
    brokerInitialized = false;
  }
};

const setupAccount = async () => {
  const INITIAL_FUNDING_OG = 10; // target top-up when low
  const MIN_BALANCE_OG = 5; // desired minimum available balance

  try {
    console.log('💰 Setting up compute account...');
    console.log(`💰 Target funding: ${INITIAL_FUNDING_OG} OG`);
    console.log(`💰 Minimum balance: ${MIN_BALANCE_OG} OG`);

    // Check if account exists
    try {
  let ledger = await broker.ledger.getLedger();

      // Extract balance information from ledger
      let balance = BigInt(ledger.balance || ledger.totalBalance || ledger[1] || 0);
      let locked = BigInt(ledger.locked || ledger.lockedBalance || ledger[2] || 0);
      let available = balance - locked;
  // Debug: raw ledger object for inspection if needed
  // console.log('Raw ledger:', ledger);
      console.log(`Account balance: ${ethers.formatEther(balance)} OG total, ${ethers.formatEther(locked)} OG locked, ${ethers.formatEther(available)} OG available`);

      // If funds are locked, try to retrieve first
      if (locked > 0n) {
        console.log(`🔄 Found ${ethers.formatEther(locked)} OG locked, retrieving...`);
        try {
          await broker.ledger.retrieveFund('inference');
          console.log('✅ Retrieve submitted, waiting for confirmation...');
          for (let i = 0; i < 6; i++) { // ~30s total
            await sleep(5000);
            ledger = await broker.ledger.getLedger();
            balance = BigInt(ledger.balance || ledger.totalBalance || ledger[1] || 0);
            locked = BigInt(ledger.locked || ledger.lockedBalance || ledger[2] || 0);
            available = balance - locked;
            console.log(`⏳ Post-retrieval check #${i + 1}: ${ethers.formatEther(balance)} OG total, ${ethers.formatEther(locked)} OG locked, ${ethers.formatEther(available)} OG available`);
            if (available >= ethers.parseEther(MIN_BALANCE_OG.toString())) break;
          }
        } catch (retrieveErr) {
          console.log('⚠️ Retrieve failed (will attempt top-up if needed):', retrieveErr?.message || retrieveErr);
        }
      }

      // If still low available, try to top up
      if (available < ethers.parseEther(MIN_BALANCE_OG.toString())) {
        const currentAvailableOG = parseFloat(ethers.formatEther(available));
        const neededOG = Math.max(0, MIN_BALANCE_OG - currentAvailableOG);
        if (neededOG > 0) {
          console.log(`Low available (${currentAvailableOG} OG), attempting to deposit ${neededOG.toFixed(4)} OG...`);
          try {
            await broker.ledger.depositFund(neededOG);
            console.log('✅ Deposit submitted, waiting briefly...');
            await sleep(5000);
          } catch (depositErr) {
            console.log('⚠️ Deposit failed (often expected on testnet or low service wallet):', depositErr?.message || depositErr);
          }
        }
      } else {
        console.log('✅ Account has sufficient available balance');
      }
    } catch (getLedgerErr) {
      console.log('Account not found, creating new account...');
      try {
        await broker.ledger.addLedger(INITIAL_FUNDING_OG);
        console.log('✅ New account created and funded, waiting briefly...');
        await sleep(5000);
      } catch (addLedgerErr) {
        if (String(addLedgerErr?.message || '').toLowerCase().includes('already exists')) {
          console.log('✅ Account already exists, continuing...');
        } else {
          console.log('⚠️ Account creation failed, continuing anyway:', addLedgerErr?.message || addLedgerErr);
        }
      }
    }
  } catch (error) {
    console.error('❌ Account setup warning:', error?.message || error);
    console.log('✅ Continuing despite account setup issues...');
  }
};

// Simplified inference helper aligned with official docs
const performInference = async (providerAddress, prompt, userAddress) => {
  try {
    console.log('🔄 Processing inference request...');
    console.log('Provider:', providerAddress, '(type:', typeof providerAddress, ')');
    console.log('User:', userAddress, '(type:', typeof userAddress, ')');
    console.log('Prompt length:', prompt?.length || 0);
    
    // Ensure broker is initialized
    if (!broker || !brokerInitialized) {
      throw new Error('Broker not initialized. Please wait for initialization to complete.');
    }
    
    // Validate that inputs are strings
    if (!providerAddress || typeof providerAddress !== 'string') {
      throw new Error(`Invalid providerAddress: ${providerAddress} (type: ${typeof providerAddress})`);
    }
    if (!userAddress || typeof userAddress !== 'string') {
      throw new Error(`Invalid userAddress: ${userAddress} (type: ${typeof userAddress})`);
    }
    if (!prompt || typeof prompt !== 'string') {
      throw new Error(`Invalid prompt: ${prompt} (type: ${typeof prompt})`);
    }
    
    // Validate and normalize addresses
    let provider, user;
    try {
      provider = ethers.getAddress(providerAddress);
      user = ethers.getAddress(userAddress);
      console.log('✓ Addresses validated');
    } catch (addrErr) {
      throw new Error(`Invalid address format: ${addrErr.message}`);
    }

    // Ensure account has funds (unlock if needed)
    const MIN_AVAILABLE_FOR_INFERENCE_OG = 0.5;
    const minWei = ethers.parseEther(MIN_AVAILABLE_FOR_INFERENCE_OG.toString());
    try {
  let ledger = await broker.ledger.getLedger();
      let balance = BigInt(ledger.balance || ledger.totalBalance || ledger[1] || 0);
      let locked = BigInt(ledger.locked || ledger.lockedBalance || ledger[2] || 0);
      let available = balance - locked;
  // console.log('Raw ledger after funding:', ledger);
      console.log(`Pre-inference balance: ${ethers.formatEther(available)} OG available, ${ethers.formatEther(locked)} OG locked`);
      if (available < minWei && locked > 0n) {
        console.log('⚠️ Low available balance, attempting retrieve...');
        await broker.ledger.retrieveFund('inference');
        for (let i = 0; i < 6; i++) {
          await sleep(5000);
          ledger = await broker.ledger.getLedger();
          balance = BigInt(ledger.balance || ledger.totalBalance || ledger[1] || 0);
          locked = BigInt(ledger.locked || ledger.lockedBalance || ledger[2] || 0);
          available = balance - locked;
          console.log(`⏳ Availability check #${i + 1}: ${ethers.formatEther(available)} OG available`);
          if (available >= minWei) break;
        }
      }
      if (available < ethers.parseEther('0.01')) {
        throw new Error(`Insufficient available balance: ${ethers.formatEther(available)} OG. Retrieve locked funds or add more funds.`);
      }
    } catch (balErr) {
      console.log('⚠️ Balance preparation warning:', balErr?.message || balErr);
    }

    // Acknowledge provider (simplified)
    try {
      // Ensure providerAddress is a clean string
      const cleanProviderAddress = String(providerAddress).trim();
      console.log('🤝 Acknowledging provider:', cleanProviderAddress);
      console.log('Provider address type:', typeof cleanProviderAddress);
      console.log('Provider address length:', cleanProviderAddress.length);
      
      // Try without gas parameter first (let the provider handle gas pricing)
      await broker.inference.acknowledgeProviderSigner(cleanProviderAddress);
      console.log('✓ Provider acknowledged');
    } catch (err) {
      const errMsg = String(err?.message || '').toLowerCase();
      if (errMsg.includes('already acknowledged') || errMsg.includes('duplicate')) {
        console.log('✓ Provider already acknowledged');
      } else if (errMsg.includes('invalid array value')) {
        console.log('⚠️ Trying with gasPrice parameter...');
        try {
          const cleanProviderAddress = String(providerAddress).trim();
          // Use extremely high gas price to override any pending transactions
          const gasPriceWei = Number(ethers.parseUnits('200', 'gwei')); // Very high gas price
          console.log(`💰 Retrying with extremely high gas: ${gasPriceWei / 1e9} gwei`);
          await broker.inference.acknowledgeProviderSigner(cleanProviderAddress, gasPriceWei);
          console.log('✓ Provider acknowledged with extremely high gas price');
        } catch (retryErr) {
          const retryErrMsg = String(retryErr?.message || '').toLowerCase();
          if (retryErrMsg.includes('replacement')) {
            console.log('⚠️ Still getting replacement fee errors, waiting longer...');
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            console.log('🔄 Final attempt with maximum gas price...');
            try {
              const ultraHighGas = Number(ethers.parseUnits('1000', 'gwei')); // Maximum gas
              await broker.inference.acknowledgeProviderSigner(cleanProviderAddress, ultraHighGas);
              console.log('✓ Provider acknowledged with maximum gas price');
            } catch (finalErr) {
              console.error('❌ Final attempt failed:', finalErr?.message || finalErr);
              throw finalErr;
            }
          } else {
            console.error('❌ Provider acknowledgment failed with high gas:', retryErr?.message || retryErr);
            throw retryErr;
          }
        }
      } else {
        console.error('❌ Provider acknowledgment failed:', err?.message || err);
        throw err;
      }
    }

    // Get service metadata
    const { endpoint, model } = await broker.inference.getServiceMetadata(provider);
    console.log('✓ Service metadata retrieved:', { endpoint, model });

    // Generate request headers
    const headers = await broker.inference.getRequestHeaders(provider, prompt);
    console.log('✓ Request headers generated');

    // Call service using OpenAI SDK (as per official docs)
    const openai = new OpenAI({ baseURL: endpoint, apiKey: '' });
    // Pass headers at request-time to avoid reusing single-use headers
    const completion = await openai.chat.completions.create(
      {
        messages: [{ role: 'user', content: prompt }],
        model,
      },
      { headers }
    );

    const answer = completion.choices[0].message.content;
    const chatId = completion.id;

    console.log('✓ Response received from provider');

    // Process/verify response
    const valid = await broker.inference.processResponse(provider, answer, chatId);
    console.log('✓ Response processed:', valid);

    // Retrieve any unused funds
    try {
      await broker.ledger.retrieveFund('inference');
      console.log('✓ Funds retrieved after inference');
    } catch (retrieveErr) {
      console.log('⚠️ Failed to retrieve funds after inference:', retrieveErr?.message || retrieveErr);
    }

    return {
      response: answer,
      model,
      valid,
      chatId,
      provider,
      user,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Inference failed:', error?.message || error);
    
    // Try to retrieve funds on failure
    try {
      await broker.ledger.retrieveFund('inference');
      console.log('✓ Funds retrieved after failed inference');
    } catch (retrieveErr) {
      console.log('⚠️ Failed to retrieve funds after failure:', retrieveErr?.message || retrieveErr);
    }
    
    throw error;
  }
};

// --- Express App Setup ---
const app = express();
app.use(bigintJsonMiddleware);
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Broker middleware
const requireBroker = (req, res, next) => {
  if (!brokerInitialized || !broker) {
    return res.status(503).json({
      error: 'Compute broker not initialized',
      details: 'Please wait for broker initialization to complete'
    });
  }
  next();
};

// --- API Endpoints ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    services: { compute: brokerInitialized },
    serviceWallet: serviceWallet.address,
    broker: {
      initialized: brokerInitialized,
      status: brokerInitialized ? 'ready' : 'initializing'
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/account-balance', requireBroker, async (req, res) => {
  try {
    const ledger = await broker.ledger.getLedger();

    // Extract and format balance information
    const balance = BigInt(ledger.balance || ledger.totalBalance || ledger[1] || 0);
    const locked = BigInt(ledger.locked || ledger.lockedBalance || ledger[2] || 0);
    const available = balance - locked;

    console.log(`Account balance check: ${ethers.formatEther(balance)} OG (${balance} neuron) total, ${ethers.formatEther(available)} OG (${available} neuron) available`);

    res.json({
      success: true,
      account: {
        total: ethers.formatEther(balance),
        locked: ethers.formatEther(locked),
        available: ethers.formatEther(available),
        unit: 'OG',
        // Also include neuron values for debugging
        neuron: {
          total: balance.toString(),
          locked: locked.toString(),
          available: available.toString()
        }
      }
    });
  } catch (err) {
    console.error('❌ Failed to check account balance:', err?.message || err);
    res.status(500).json({
      error: 'Failed to check account balance',
      details: err?.message || err
    });
  }
});

app.post('/api/fund-account', requireBroker, async (req, res) => {
  try {
    const { amount = 0.1 } = req.body;
    const fundingAmountOG = typeof amount === 'string' ? parseFloat(amount) : amount;
   
    console.log(`🔄 Adding ${fundingAmountOG} OG  to account...`);

    try {
      await broker.ledger.depositFund(fundingAmountOG);
      console.log('✅ Deposit successful');
    } catch (depositErr) {
      throw new Error(`Failed to deposit funds: ${depositErr.message}`);
    }

    // Check updated balance
    const ledger = await broker.ledger.getLedger();
    const balance = BigInt(ledger.balance || ledger.totalBalance || ledger[1] || 0);
    const locked = BigInt(ledger.locked || ledger.lockedBalance || ledger[2] || 0);
    const available = balance - locked;
    console.log(`${ledger}`);

    console.log(`✅ Account funded. New balance: ${ethers.formatEther(balance)} OG (${balance} neuron) total, ${ethers.formatEther(available)} OG (${available} neuron) available`);

    res.json({
      success: true,
      message: `Successfully added ${fundingAmountOG} OG to account`,
      balance: {
        total: ethers.formatEther(balance),
        locked: ethers.formatEther(locked),
        available: ethers.formatEther(available),
        unit: 'OG'
      }
    });
  } catch (err) {
    console.error('❌ Failed to fund account:', err?.message || err);
    res.status(500).json({
      error: 'Failed to fund account',
      details: err?.message || err
    });
  }
});

app.post('/api/refund', requireBroker, async (req, res) => {
  try {
    const { serviceType = "inference", amount } = req.body;
   
    console.log(`🔄 Refunding locked funds for service: ${serviceType}${amount ? `, amount: ${amount} OG` : ''}...`);

    try {
      if (amount && Number(amount) > 0) {
        const neuronAmount = Number(ethers.parseEther(String(amount)));
        await broker.ledger.retrieveFund(serviceType, neuronAmount);
      } else {
        await broker.ledger.retrieveFund(serviceType);
      }
      console.log('✅ Refund successful');
    } catch (refundErr) {
      throw new Error(`Failed to refund funds: ${refundErr.message}`);
    }

    // Check updated balance
    const ledger = await broker.ledger.getLedger();
    const balance = BigInt(ledger.balance || ledger.totalBalance || ledger[1] || 0);
    const locked = BigInt(ledger.locked || ledger.lockedBalance || ledger[2] || 0);
    const available = balance - locked;

    console.log(`✅ Account refunded. New balance: ${ethers.formatEther(balance)} OG (${balance} neuron) total, ${ethers.formatEther(locked)} OG (${locked} neuron) locked, ${ethers.formatEther(available)} OG (${available} neuron) available`);

    res.json({
      success: true,
      message: `Successfully refunded funds for ${serviceType}`,
      serviceType,
      balance: {
        total: ethers.formatEther(balance),
        locked: ethers.formatEther(locked),
        available: ethers.formatEther(available),
        unit: 'OG'
      }
    });
  } catch (err) {
    console.error('❌ Failed to refund account:', err?.message || err);
    res.status(500).json({
      error: 'Failed to refund account',
      details: err?.message || err
    });
  }
});

// Explicitly add and fund a new ledger (one-time setup)
app.post('/api/add-ledger', requireBroker, async (req, res) => {
  try {
    const { amount = 1 } = req.body; // default to 1 OG if not provided
    const ogAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

    console.log(`🧾 Creating/funding ledger with ${ogAmount} OG...`);

    try {
      await broker.ledger.addLedger(ogAmount);
      console.log('✅ Ledger added/funded');
    } catch (addErr) {
      throw new Error(`Failed to add ledger: ${addErr.message}`);
    }

    // Check updated balance
    const ledger = await broker.ledger.getLedger();
    const balance = BigInt(ledger.balance || ledger.totalBalance || ledger[1] || 0);
    const locked = BigInt(ledger.locked || ledger.lockedBalance || ledger[2] || 0);
    const available = balance - locked;

    res.json({
      success: true,
      message: `Ledger initialized with ${ogAmount} OG`,
      balance: {
        total: ethers.formatEther(balance),
        locked: ethers.formatEther(locked),
        available: ethers.formatEther(available),
        unit: 'OG'
      }
    });
  } catch (err) {
    console.error('❌ Failed to add ledger:', err?.message || err);
    res.status(500).json({
      error: 'Failed to add ledger',
      details: err?.message || err
    });
  }
});

app.get('/api/services', requireBroker, async (req, res) => {
  try {
    console.log('📋 Listing available compute services...');
    const services = await broker.inference.listService();
    
    const formattedServices = services.map(service => ({
      providerAddress: service.provider || service[0],
      serviceType: service.serviceType || service[1],
      endpoint: service.url || service[2],
      inputPrice: service.inputPrice || service[3],
      outputPrice: service.outputPrice || service[4],
      updatedAt: service.updatedAt || service[5],
      model: service.model || service[6],
      verifiability: service.verifiability || service[7] || service[8]
    }));
    
    res.json(formattedServices);
  } catch (err) {
    console.error('❌ Error listing services:', err?.message || err);
    res.status(500).json({ error: 'Failed to list services', details: String(err) });
  }
});

app.post('/api/acknowledge', requireBroker, async (req, res) => {
  const { providerAddress } = req.body;
  if (!providerAddress) return res.status(400).json({ error: 'Provider address required' });
  
  try {
    console.log(`🤝 Acknowledging provider: ${providerAddress}`);
    await broker.inference.acknowledgeProviderSigner(ethers.getAddress(providerAddress));
    res.json({ success: true, provider: providerAddress, acknowledgedAt: new Date().toISOString() });
  } catch (err) {
    console.error(`❌ Failed to acknowledge provider:`, err?.message || err);
    res.status(500).json({ error: 'Failed to acknowledge provider', details: String(err) });
  }
});

app.post('/api/inference', requireBroker, async (req, res) => {
  const { providerAddress, prompt, userAddress } = req.body;
  
  if (!providerAddress || !prompt || !userAddress) {
    return res.status(400).json({ 
      error: 'Missing required parameters', 
      details: 'providerAddress, prompt, and userAddress are all required.' 
    });
  }

  try {
    const result = await performInference(providerAddress, prompt, userAddress);
    res.json(result);
  } catch (err) {
    console.error('❌ Inference failed:', err);
    
    let statusCode = 500;
    if (String(err?.message || '').includes('Invalid address')) statusCode = 400;
    else if (String(err?.message || '').includes('Insufficient')) statusCode = 402;

    res.status(statusCode).json({
      error: 'Inference request failed',
      details: String(err?.message || err),
      provider: providerAddress,
      user: userAddress,
      timestamp: new Date().toISOString()
    });
  }
});

// --- Storage Endpoints ---
// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// File upload endpoint
app.post('/api/storage/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;
    
    console.log(`📁 File uploaded: ${fileName} (${req.file.size} bytes)`);

    res.json({
      success: true,
      file: {
        name: fileName,
        originalName: req.file.originalname,
        size: req.file.size,
        path: filePath,
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('❌ File upload failed:', err);
    res.status(500).json({ error: 'File upload failed', details: err.message });
  }
});

// List uploaded files
app.get('/api/storage/files', (req, res) => {
  try {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(uploadDir).map(filename => {
      const filePath = path.join(uploadDir, filename);
      const stats = fs.statSync(filePath);
      return {
        name: filename,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      };
    });

    res.json({ files });
  } catch (err) {
    console.error('❌ Failed to list files:', err);
    res.status(500).json({ error: 'Failed to list files', details: err.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    details: err.message,
    timestamp: new Date().toISOString()
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found', 
    path: req.originalUrl,
    method: req.method
  });
});

// Initialize broker on startup
initBroker();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log('🚀 0G Unified Backend Server Started');
  console.log(`   Port: ${PORT}`);
  console.log(`   Service Wallet: ${serviceWallet.address}`);
  console.log(`   RPC URL: ${RPC_URL}`);
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log('   GET  /api/health');
  console.log('   GET  /api/account-balance');
  console.log('   POST /api/fund-account');
  console.log('   POST /api/refund');
  console.log('   POST /api/add-ledger');
  console.log('   GET  /api/services');
  console.log('   POST /api/acknowledge');
  console.log('   POST /api/inference');
  console.log('   POST /api/storage/upload');
  console.log('   GET  /api/storage/files');
});
