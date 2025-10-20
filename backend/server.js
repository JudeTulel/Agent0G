require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises; // Use promises for async file ops
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
const INDEXER_RPC = process.env.INDEXER_RPC || 'https://indexer-storage-testnet-standard.0g.ai';
const KV_NODE_URL = process.env.KV_NODE_URL || 'http://3.101.147.150:6789';
const PRIVATE_KEY = process.env.SERVICE_PRIVATE_KEY;

// Initialize providers and wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
// Removed recursive getFeeData override; use native method with fallback
const getFeeData = async () => {
  try {
    const feeData = await provider.getFeeData();
    return {
      gasPrice: feeData.gasPrice || ethers.parseUnits('5', 'gwei'),
      maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei'),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei')
    };
  } catch (err) {
    console.error('⚠️ Failed to fetch fee data:', err.message);
    return {
      gasPrice: ethers.parseUnits('5', 'gwei'),
      maxFeePerGas: ethers.parseUnits('20', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
    };
  }
};

const serviceWallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Nonce management for replacement fee issues
let lastNonce = null;
const getNextNonce = async () => {
  try {
    const currentNonce = await provider.getTransactionCount(serviceWallet.address, 'pending');
    if (lastNonce === null || currentNonce > lastNonce) {
      lastNonce = currentNonce;
    } else {
      lastNonce++;
    }
    console.log(`🔢 Using nonce: ${lastNonce}`);
    return lastNonce;
  } catch (err) {
    console.error('⚠️ Failed to get nonce:', err.message);
    throw new Error(`Nonce fetch failed: ${err.message}`);
  }
};

// --- Broker and Storage Management ---
let broker = null;
let brokerInitialized = false;
let storageInitialized = false;
let indexer = null;
let batcher = null;
let zgFile = null;
let kvClient = null;

// Initialize Storage SDK
const initStorage = async () => {
  try {
    console.log('🔄 Initializing 0G Storage SDK...');
    indexer = new Indexer(INDEXER_RPC);
    batcher = new Batcher(indexer);
    zgFile = new ZgFile(batcher);
    kvClient = new KvClient(KV_NODE_URL);
    storageInitialized = true;
    console.log('✅ 0G Storage SDK initialized successfully');
  } catch (err) {
    console.error('❌ Failed to initialize storage SDK:', err?.message || err);
    storageInitialized = false;
  }
};

// Check for stuck transactions
const initBroker = async () => {
  try {
    console.log('🔄 Initializing 0G Compute broker...');
    console.log('Service wallet address:', serviceWallet.address);

    // Check wallet balance first
    const balance = await provider.getBalance(serviceWallet.address);
    console.log(`Service wallet balance: ${ethers.formatEther(balance)} 0G`);

    if (balance === 0n) {
      throw new Error('Service wallet has zero balance. Please fund the wallet first.');
    }

    // Initialize broker (single call, aligned with sample)
    broker = await createZGComputeNetworkBroker(serviceWallet);
    brokerInitialized = true;

    console.log('✅ Compute broker initialized successfully');

    // Initialize account with initial funding
    await setupAccount();

    // Try to list services
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
  const INITIAL_FUNDING_OG = 0.01; // Aligned with sample default
  const MIN_BALANCE_OG = 0.005; // Adjusted for minimal ops

  try {
    console.log('💰 Setting up compute account...');
    console.log(`💰 Target funding: ${INITIAL_FUNDING_OG} OG`);
    console.log(`💰 Minimum balance: ${MIN_BALANCE_OG} OG`);

    // Check if account exists
    try {
      let ledger = await broker.ledger.getLedger();

      // Extract balance information from ledger (aligned with sample ledgerInfo array)
      let balance = BigInt(ledger.ledgerInfo?.[0] || ledger.balance || ledger.totalBalance || ledger[1] || 0);
      let locked = BigInt(ledger.locked || ledger.lockedBalance || ledger[2] || 0);
      let available = balance - locked;
      console.log(`Account balance: ${ethers.formatEther(balance)} OG total, ${ethers.formatEther(locked)} OG locked, ${ethers.formatEther(available)} OG available`);

      // If still low available, try to top up
      if (available < ethers.parseEther(MIN_BALANCE_OG.toString())) {
        const currentAvailableOG = parseFloat(ethers.formatEther(available));
        const neededOG = Math.max(0, MIN_BALANCE_OG - currentAvailableOG);
        if (neededOG > 0) {
          console.log(`Low available (${currentAvailableOG} OG), attempting to deposit ${neededOG.toFixed(4)} OG...`);
          const feeData = await getFeeData();
          const txOptions = {
            gasPrice: feeData.gasPrice,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
            nonce: await getNextNonce()
          };
          try {
            // const depositWei = ethers.parseEther(neededOG.toFixed(18)); // Convert to wei
            await broker.ledger.depositFund(neededOG);
            console.log('✅ Deposit submitted, waiting briefly...');
            await sleep(5000);
          } catch (depositErr) {
            console.error('⚠️ Deposit failed:', depositErr?.message || depositErr);
            throw depositErr;
          }
        }
      } else {
        console.log('✅ Account has sufficient available balance');
      }
    } catch (getLedgerErr) {
      console.log('Account not found, creating new account...');
      try {
        const feeData = await getFeeData();
        const txOptions = {
          gasPrice: feeData.gasPrice,
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          nonce: await getNextNonce()
        };

        await broker.ledger.addLedger(INITIAL_FUNDING_OG);
        console.log('✅ New account created and funded, waiting briefly...');
        await sleep(5000);
      } catch (addLedgerErr) {
        if (String(addLedgerErr?.message || '').toLowerCase().includes('already exists')) {
          console.log('✅ Account already exists, continuing...');
        } else {
          console.error('⚠️ Account creation failed:', addLedgerErr?.message || addLedgerErr);
          throw addLedgerErr;
        }
      }
    }
  } catch (error) {
    console.error('❌ Account setup failed:', error?.message || error);
    throw error;
  }
};

// Aligned inference helper with sample (uses 'query' instead of 'prompt', adds fallbackFee)
const performInference = async (providerAddress, query, fallbackFee = 0.01) => {
  try {
    console.log('🔄 Processing inference request...');
    console.log('Provider:', providerAddress, '(type:', typeof providerAddress, ')');
    console.log('Query length:', query?.length || 0);
    console.log('Fallback fee:', fallbackFee);

    // Ensure broker is initialized
    if (!broker || !brokerInitialized) {
      throw new Error('Broker not initialized. Please wait for initialization to complete.');
    }

    // Validate inputs
    if (!providerAddress || typeof providerAddress !== 'string') {
      throw new Error(`Invalid providerAddress: ${providerAddress} (type: ${typeof providerAddress})`);
    }
    if (!query || typeof query !== 'string') {
      throw new Error(`Invalid query: ${query} (type: ${typeof query})`);
    }

    // Validate and normalize addresses
    let provider;
    try {
      provider = ethers.getAddress(providerAddress);
      console.log('✓ Address validated');
    } catch (addrErr) {
      throw new Error(`Invalid address format: ${addrErr.message}`);
    }

    // Ensure account has funds
    const MIN_AVAILABLE_FOR_INFERENCE_OG = 0.005;
    try {
      let ledger = await broker.ledger.getLedger();
      let balance = BigInt(ledger.ledgerInfo?.[0] || ledger.balance || ledger.totalBalance || ledger[1] || 0);
      let locked = BigInt(ledger.locked || ledger.lockedBalance || ledger[2] || 0);
      let available = balance - locked;
      console.log(`Pre-inference balance: ${ethers.formatEther(available)} OG available, ${ethers.formatEther(locked)} OG locked`);
      if (available < ethers.parseEther('0.001')) {
        throw new Error(`Insufficient available balance: ${ethers.formatEther(available)} OG. Retrieve locked funds or add more funds.`);
      }
    } catch (balErr) {
      console.log('⚠️ Balance preparation warning:', balErr?.message || balErr);
    }

    // Acknowledge provider (with retry logic)
    try {
      const cleanProviderAddress = String(providerAddress).trim();
      console.log('🤝 Acknowledging provider:', cleanProviderAddress);
      const feeData = await getFeeData();
      await broker.inference.acknowledgeProviderSigner(cleanProviderAddress, {
        gasPrice: feeData.gasPrice,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        nonce: await getNextNonce()
      });
      console.log('✓ Provider acknowledged');
    } catch (err) {
      const errMsg = String(err?.message || '').toLowerCase();
      if (errMsg.includes('already acknowledged') || errMsg.includes('duplicate')) {
        console.log('✓ Provider already acknowledged');
      } else if (errMsg.includes('invalid array value') || errMsg.includes('replacement')) {
        console.log('⚠️ Retrying with high gas...');
        await sleep(5000);
        try {
          const highGas = Number(ethers.parseUnits('200', 'gwei'));
          await broker.inference.acknowledgeProviderSigner(cleanProviderAddress, { gasPrice: highGas, nonce: await getNextNonce() });
          console.log('✓ Provider acknowledged with high gas');
        } catch (retryErr) {
          console.error('❌ Provider acknowledgment failed:', retryErr?.message || retryErr);
          throw retryErr;
        }
      } else {
        throw err;
      }
    }

    // Get service metadata
    const { endpoint, model } = await broker.inference.getServiceMetadata(provider);
    console.log('✓ Service metadata retrieved:', { endpoint, model });

    // Generate request headers
    const headers = await broker.inference.getRequestHeaders(provider, query);
    console.log('✓ Request headers generated');

    // Call service using OpenAI SDK
    const openai = new OpenAI({ baseURL: endpoint, apiKey: '' });
    const completion = await openai.chat.completions.create(
      {
        messages: [{ role: 'user', content: query }],
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

    return {
      success: true,
      response: {
        content: answer,
        metadata: {
          model,
          isValid: valid,
          provider,
          chatId
        }
      },
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Inference failed:', error?.message || error);
    throw error;
  }
};

// --- Express App Setup ---
const app = express();
app.use(bigintJsonMiddleware);
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Broker and Storage middleware
const requireBroker = (req, res, next) => {
  if (!brokerInitialized || !broker) {
    return res.status(503).json({
      error: 'Compute broker not initialized',
      details: 'Please wait for broker initialization to complete'
    });
  }
  next();
};

const requireStorage = (req, res, next) => {
  if (!storageInitialized) {
    return res.status(503).json({
      error: 'Storage SDK not initialized',
      details: 'Please wait for storage initialization to complete'
    });
  }
  next();
};

// --- API Endpoints ---

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    services: {
      compute: brokerInitialized,
      storage: storageInitialized
    },
    serviceWallet: serviceWallet.address,
    timestamp: new Date().toISOString()
  });
});

// Account Management (Aligned with sample endpoints)
app.get('/api/account/info', requireBroker, async (req, res) => {
  try {
    const ledger = await broker.ledger.getLedger();

    // Align with sample: ledgerInfo as array, add infers and fines as empty
    const balance = BigInt(ledger.ledgerInfo?.[0] || ledger.balance || ledger.totalBalance || ledger[1] || 0);
    const locked = BigInt(ledger.locked || ledger.lockedBalance || ledger[2] || 0);
    const available = balance - locked;

    res.json({
      success: true,
      accountInfo: {
        ledgerInfo: [balance.toString()], // Aligned with sample array format
        infers: [],
        fines: [],
        // Additional details for compatibility
        total: ethers.formatEther(balance),
        locked: ethers.formatEther(locked),
        available: ethers.formatEther(available),
        unit: 'OG'
      }
    });
  } catch (err) {
    console.error('❌ Failed to get account info:', err?.message || err);
    res.status(500).json({
      success: false,
      error: 'Failed to get account info',
      details: err?.message || err
    });
  }
});

app.post('/api/account/deposit', requireBroker, async (req, res) => {
  try {
    const { amount = 0.1 } = req.body;
    const depositAmountOG = typeof amount === 'string' ? parseFloat(amount) : amount;

    console.log(`🔄 Depositing ${depositAmountOG} OG to account...`);
    const feeData = await getFeeData();
    const depositAmountWei = ethers.parseEther(depositAmountOG.toString());
    await broker.ledger.depositFund(depositAmountWei, {
      gasPrice: feeData.gasPrice,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      nonce: await getNextNonce()
    });
    console.log('✅ Deposit successful');

    const ledger = await broker.ledger.getLedger();
    const balance = BigInt(ledger.ledgerInfo?.[0] || ledger.balance || ledger.totalBalance || ledger[1] || 0);
    const locked = BigInt(ledger.locked || ledger.lockedBalance || ledger[2] || 0);
    const available = balance - locked;

    res.json({
      success: true,
      message: `Deposit successful`,
      balance: {
        total: ethers.formatEther(balance),
        locked: ethers.formatEther(locked),
        available: ethers.formatEther(available),
        unit: 'OG'
      }
    });
  } catch (err) {
    console.error('❌ Failed to deposit:', err?.message || err);
    res.status(500).json({
      success: false,
      error: 'Failed to deposit',
      details: err?.message || err
    });
  }
});

app.post('/api/account/refund', requireBroker, async (req, res) => {
  try {
    const { amount } = req.body;

    console.log(`🔄 Refunding ${amount || 'all'} funds...`);
    const feeData = await getFeeData();
    const txOptions = {
      gasPrice: feeData.gasPrice,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      nonce: await getNextNonce()
    };
    if (amount && Number(amount) > 0) {
      const neuronAmount = Number(ethers.parseEther(String(amount)));
      await broker.ledger.retrieveFund('inference', neuronAmount, txOptions);
    } else {
      await broker.ledger.retrieveFund('inference', undefined, txOptions);
    }
    console.log('✅ Refund successful');

    const ledger = await broker.ledger.getLedger();
    const balance = BigInt(ledger.ledgerInfo?.[0] || ledger.balance || ledger.totalBalance || ledger[1] || 0);
    const locked = BigInt(ledger.locked || ledger.lockedBalance || ledger[2] || 0);
    const available = balance - locked;

    res.json({
      success: true,
      message: `Refund successful`,
      balance: {
        total: ethers.formatEther(balance),
        locked: ethers.formatEther(locked),
        available: ethers.formatEther(available),
        unit: 'OG'
      }
    });
  } catch (err) {
    console.error('❌ Failed to refund:', err?.message || err);
    res.status(500).json({
      success: false,
      error: 'Failed to refund',
      details: err?.message || err
    });
  }
});


app.get('/api/services', requireBroker, async (req, res) => {
  try {
    console.log('📋 Listing available compute services...');
    const services = await broker.inference.listService();

    const formattedServices = services.map(service => ({
      provider: service.provider || service[0],
      model: service.model || service[6],
      serviceType: service.serviceType || service[1],
      url: service.url || service[2],
      inputPrice: service.inputPrice || service[3],
      outputPrice: service.outputPrice || service[4],
      verifiability: service.verifiability || service[7] || service[8] || 'TeeML',
      isOfficial: ['0xf07240Efa67755B5311bc75784a061eDB47165Dd', '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3'].includes(service.provider || service[0]),
      isVerifiable: true
    }));

    res.json({ success: true, services: formattedServices });
  } catch (err) {
    console.error('❌ Error listing services:', err?.message || err);
    res.status(500).json({
      success: false,
      error: 'Failed to list services',
      details: String(err)
    });
  }
});

app.post('/api/services/acknowledge-provider', requireBroker, async (req, res) => {
  const { providerAddress } = req.body;
  if (!providerAddress) return res.status(400).json({ success: false, error: 'Provider address required' });

  try {
    console.log(`🤝 Acknowledging provider: ${providerAddress}`);
    const feeData = await getFeeData();
    await broker.inference.acknowledgeProviderSigner(ethers.getAddress(providerAddress), {
      gasPrice: feeData.gasPrice,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      nonce: await getNextNonce()
    });
    res.json({
      success: true,
      provider: providerAddress,
      acknowledgedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(`❌ Failed to acknowledge provider:`, err?.message || err);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge provider',
      details: String(err)
    });
  }
});

app.post('/api/services/query', requireBroker, async (req, res) => {
  const { providerAddress, query, fallbackFee = 0.01 } = req.body;

  if (!providerAddress || !query) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters',
      details: 'providerAddress and query are required.'
    });
  }

  try {
    const result = await performInference(providerAddress, query, fallbackFee);
    res.json(result);
  } catch (err) {
    console.error('❌ Query failed:', err);

    let statusCode = 500;
    if (String(err?.message || '').includes('Invalid address')) statusCode = 400;
    else if (String(err?.message || '').includes('Insufficient')) statusCode = 402;

    res.status(statusCode).json({
      success: false,
      error: 'Query request failed',
      details: String(err?.message || err),
      provider: providerAddress,
      timestamp: new Date().toISOString()
    });
  }
});


// --- Storage Endpoints (Aligned with 0G Storage SDK) ---
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'temp-uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|txt|json/;
    if (allowedTypes.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPEG, PNG, PDF, TXT, JSON'));
    }
  }
});

// Upload file to 0G Storage
app.post('/api/storage/upload', requireStorage, upload.single('file'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    filePath = req.file.path;
    const fileName = req.file.filename;
    const fileSize = req.file.size;

    console.log(`📁 Uploading file to 0G Storage: ${fileName} (${fileSize} bytes)`);

    // Create ZgFile instance from file path
    let zgFileInstance;
    try {
      zgFileInstance = await ZgFile.fromFilePath(filePath);
      console.log(`✓ ZgFile created from path: ${filePath}`);
    } catch (createErr) {
      throw new Error(`Failed to create ZgFile: ${createErr.message}`);
    }
    
    // Generate merkle tree and get root hash
    const [tree, treeErr] = await zgFileInstance.merkleTree();
    if (treeErr) {
      throw new Error(`Failed to generate Merkle tree: ${treeErr.message}`);
    }
    
    const rootHash = tree?.rootHash();
    if (!rootHash) {
      throw new Error('Failed to generate root hash');
    }

    console.log(`✓ Root hash generated: ${rootHash}`);

    // Get gas pricing
    const feeData = await getFeeData();
    const txOptions = {
      gasPrice: feeData.gasPrice,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      nonce: await getNextNonce()
    };

    console.log('🔄 Uploading to 0G Storage network...');

    let uploadTx;
    try {
      // Use indexer.upload - returns [tx, uploadErr] tuple per documentation
      const [tx, uploadErr] = await indexer.upload(zgFileInstance, RPC_URL, serviceWallet);
      
      if (uploadErr !== null) {
        throw new Error(`Upload error: ${uploadErr}`);
      }

      // Handle tx object and extract hash
      uploadTx = typeof tx === 'object' ? tx.hash || tx.transactionHash : tx;

      if (!uploadTx) {
        throw new Error('No transaction hash returned from upload');
      }

      console.log(`✓ Upload transaction hash: ${uploadTx}`);

    } catch (uploadErr) {
      console.error('❌ Upload error:', uploadErr);
      throw uploadErr;
    }

    // Close the file when done
    try {
      await zgFileInstance.close();
      console.log('✓ File closed');
    } catch (closeErr) {
      console.log('⚠️ Close warning:', closeErr.message);
    }

    // Clean up temp file
    try {
      await fs.unlink(filePath);
      console.log('✓ Temp file cleaned up');
    } catch (cleanupErr) {
      console.log('⚠️ Cleanup warning:', cleanupErr.message);
    }

    console.log(`✅ File successfully uploaded to 0G Storage`);

    res.json({
      success: true,
      file: {
        name: fileName,
        originalName: req.file.originalname,
        size: fileSize,
        rootHash,
        rootHashFormatted: rootHash.startsWith('0x') ? rootHash : `0x${rootHash}`,
        transactionHash: uploadTx,
        uploadedAt: new Date().toISOString()
      },
      // Add metadata for frontend modal
      modal: {
        title: 'File Upload Successful',
        message: 'Your file has been successfully uploaded to 0G Storage.',
        details: [
          {
            label: 'Root Hash',
            value: rootHash.startsWith('0x') ? rootHash : `0x${rootHash}`,
            copyable: true
          },
          {
            label: 'Transaction Hash',
            value: uploadTx,
            copyable: true
          }
        ]
      }
    });

  } catch (err) {
    console.error('❌ File upload failed:', err.message);
    
    // Cleanup on error
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (cleanupErr) {
        console.error('⚠️ Cleanup failed:', cleanupErr);
      }
    }

    res.status(500).json({
      success: false,
      error: 'File upload failed',
      details: err.message
    });
  }
});

// Download/Retrieve file from 0G Storage
app.get('/api/storage/download/:rootHash', requireStorage, async (req, res) => {
  try {
    const { rootHash } = req.params;
    if (!rootHash) {
      return res.status(400).json({ success: false, error: 'rootHash required' });
    }

    console.log(`📥 Downloading file from 0G Storage: ${rootHash}`);

    const outputPath = path.join(__dirname, 'temp-uploads', `download-${rootHash}-${Date.now()}`);

    // Download using zgFile
    const downloadErr = await zgFile.downloadByRoot(rootHash, outputPath);
    
    if (downloadErr) {
      throw new Error(`Download failed: ${downloadErr.message}`);
    }

    // Verify file integrity
    const downloadedFileData = await fs.readFile(outputPath);
    const verifyZgFile = new ZgFile(1024, downloadedFileData);
    const [verifyTree, verifyErr] = await verifyZgFile.merkleTree();
    
    if (verifyErr || verifyTree?.rootHash() !== rootHash) {
      throw new Error('Downloaded file verification failed');
    }

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="downloaded-${rootHash}"`,
      'Content-Length': downloadedFileData.length
    });
    res.send(downloadedFileData);

    // Clean up
    await fs.unlink(outputPath);
  } catch (err) {
    console.error('❌ File download failed:', err);
    res.status(500).json({
      success: false,
      error: 'File download failed',
      details: err.message
    });
  }
});

// List files (local temp or via KV if indexed)
app.get('/api/storage/files', requireStorage, async (req, res) => {
  try {
    // For demo, list local temp files; in prod, use KVClient to list indexed files
    const tempDir = path.join(__dirname, 'temp-uploads');
    let files = [];
    try {
      const entries = await fs.readdir(tempDir);
      files = await Promise.all(entries.map(async (filename) => {
        const filePath = path.join(tempDir, filename);
        const stats = await fs.stat(filePath);
        return {
          name: filename,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime
        };
      }));
    } catch (dirErr) {
      // Dir may not exist
      files = [];
    }

    // Optionally, query KV for stored file IDs
    // const storedFiles = await kvClient.get('stored_files'); // If indexed

    res.json({ success: true, files });
  } catch (err) {
    console.error('❌ Failed to list files:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to list files',
      details: err.message
    });
  }
});

// KV Store Example Endpoint
app.post('/api/storage/kv/set', requireStorage, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ success: false, error: 'key and value required' });
    }

    await kvClient.set(key, value);
    res.json({ success: true, message: `KV set: ${key}` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'KV set failed', details: err.message });
  }
});

app.get('/api/storage/kv/get/:key', requireStorage, async (req, res) => {
  try {
    const { key } = req.params;
    const value = await kvClient.get(key);
    res.json({ success: true, key, value });
  } catch (err) {
    res.status(500).json({ success: false, error: 'KV get failed', details: err.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: err.message,
    timestamp: new Date().toISOString()
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Initialize on startup
Promise.all([initBroker(), initStorage()]).then(() => {
  const PORT = process.env.PORT || 3001; // Updated to match your logs
  app.listen(PORT, () => {
    console.log('🚀 0G Unified Backend Server Started');
    console.log(`   Port: ${PORT}`);
    console.log(`   Service Wallet: ${serviceWallet.address}`);
    console.log(`   RPC URL: ${RPC_URL}`);
    console.log(`   Storage Initialized: ${storageInitialized}`);
    console.log('');
    console.log('📋 Available Endpoints:');
    console.log('   GET  /api/health');
    console.log('   GET  /api/account/info');
    console.log('   POST /api/account/deposit');
    console.log('   POST /api/account/refund');
    console.log('   GET  /api/services/list');
    console.log('   POST /api/services/acknowledge-provider');
    console.log('   POST /api/services/query');
    console.log('   POST /api/services/settle-fee');
    console.log('   POST /api/storage/upload');
    console.log('   GET  /api/storage/download/:rootHash');
    console.log('   GET  /api/storage/files');
    console.log('   POST /api/storage/kv/set');
    console.log('   GET  /api/storage/kv/get/:key');
  });
}).catch(err => {
  console.error('❌ Startup failed:', err);
  process.exit(1);
});