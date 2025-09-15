// --- Agent Registry Contract Setup ---
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


    // BigInt middleware for Express responses
    const bigintJsonMiddleware = (req, res, next) => {
      const originalJson = res.json;
      res.json = function (obj) {
        try {
          const serializedObj = convertBigIntToString(obj);
          return originalJson.call(this, serializedObj);
        } catch (err) {
          // Fallback
          return originalJson .call(this, { error: 'Serialization error', details: String(err) });
        }
      };
      next();
    };

    // Inference Helper Functions

    // Enhanced account funding function using correct 0G SDK methods
    async function fundComputeAccount(broker, amount = '0.1') {
      try {
        // Check if broker is properly initialized
        if (!broker || !broker.ledger) {
          throw new Error('Broker not properly initialized or ledger methods not available');
        }

        console.log(`💰 Funding compute account with ${amount} OG tokens...`);

        // Convert amount to number for 0G SDK
        const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        console.log(`Converted amount to number: ${numericAmount} (type: ${typeof numericAmount})`);

        if (isNaN(numericAmount) || numericAmount <= 0) {
          throw new Error(`Invalid amount: ${amount} (converted to ${numericAmount})`);
        }

        // Check if account already exists
        let accountExists = false;
        let currentBalance = '0';
        
        try {
          console.log('Checking if account exists...');
          const currentAccount = await broker.ledger.getLedger();
          
          if (currentAccount) {
            accountExists = true;
            // Safely extract balance value
            const balanceValue = currentAccount.totalbalance ?? currentAccount.balance ?? 0;
            const balanceBigInt = typeof balanceValue === 'string' ? BigInt(balanceValue) :
                                 typeof balanceValue === 'number' ? BigInt(balanceValue) :
                                 typeof balanceValue === 'bigint' ? balanceValue :
                                 BigInt(0);
            currentBalance = ethers.formatEther(balanceBigInt);
            console.log(`✅ Account exists with balance: ${currentBalance} OG`);
          }
        } catch (err) {
          console.log('Account does not exist yet');
          accountExists = false;
        }

        // Use appropriate method based on account existence
        if (accountExists) {
          console.log(`Adding ${numericAmount} OG to existing account using depositFund...`);
          await broker.ledger.depositFund(numericAmount);
          console.log('✅ Successfully deposited funds to existing account');
        } else {
          console.log(`Creating new account with ${numericAmount} OG using addLedger...`);
          await broker.ledger.addLedger(numericAmount);
          console.log('✅ Successfully created new account with initial funds');
        }

        // Wait a moment for the transaction to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check updated compute account balance
        try {
          const updatedAccount = await broker.ledger.getLedger();
          if (updatedAccount) {
            const updatedBalanceValue = updatedAccount.totalbalance ?? updatedAccount.balance ?? 0;
            const updatedBalanceBigInt = typeof updatedBalanceValue === 'string' ? BigInt(updatedBalanceValue) :
                                        typeof updatedBalanceValue === 'number' ? BigInt(updatedBalanceValue) :
                                        typeof updatedBalanceValue === 'bigint' ? updatedBalanceValue :
                                        BigInt(0);
            const updatedBalance = ethers.formatEther(updatedBalanceBigInt);
            console.log(`Updated compute account balance: ${updatedBalance} OG`);
          }
        } catch (err) {
          console.log('Could not retrieve updated balance:', err.message);
        }

        return { success: true, amount: numericAmount };
      } catch (error) {
        console.error('❌ Failed to add funds to compute account:', error.message);
        throw error;
      }
    }

    async function ensureAccountHasFunds(broker) {
      const MIN_BALANCE_OG = 0.01; // A0GI
      const TOP_UP_AMOUNT = 0.05; // A0GI

      try {
        // First, try to get existing account
        console.log('Checking for existing account...');
        const account = await broker.ledger.getLedger();
        
        if (account) {
          console.log('✅ Account exists');
          
          // Normalize fields and use BigInt for comparisons
          const balanceValue = account.balance ?? account.totalbalance ?? 0;
          const lockedValue = account.locked ?? 0;

          const balance = typeof balanceValue === 'string' ? BigInt(balanceValue) :
                         typeof balanceValue === 'number' ? BigInt(balanceValue) :
                         typeof balanceValue === 'bigint' ? balanceValue :
                         BigInt(0);
          const locked = typeof lockedValue === 'string' ? BigInt(lockedValue) :
                        typeof lockedValue === 'number' ? BigInt(lockedValue) :
                        typeof lockedValue === 'bigint' ? lockedValue :
                        BigInt(0);
          const available = balance - locked;

          console.log('Account status:', {
            total: ethers.formatEther(balance),
            locked: ethers.formatEther(locked),
            available: ethers.formatEther(available),
            unit: 'A0GI'
          });

          if (available < ethers.parseEther(MIN_BALANCE_OG.toString())) {
            console.log(`Low balance (${ethers.formatEther(available)} A0GI), adding funds to account...`);
            // For existing accounts, use depositFund to add funds
            console.log(`Depositing ${TOP_UP_AMOUNT} OG to existing account...`);
            const numericAmount = typeof TOP_UP_AMOUNT === 'string' ? parseFloat(TOP_UP_AMOUNT) : TOP_UP_AMOUNT;
            await broker.ledger.depositFund(numericAmount);
            console.log('✅ Successfully deposited funds to existing account');
          } else {
            console.log('✅ Account has sufficient balance');
          }
        } else {
          // Account doesn't exist, create it
          console.log('Creating new account...');
          const numericAmount = typeof TOP_UP_AMOUNT === 'string' ? parseFloat(TOP_UP_AMOUNT) : TOP_UP_AMOUNT;
          await broker.ledger.addLedger(numericAmount);
          console.log(`✅ Created new account with ${TOP_UP_AMOUNT} A0GI`);
        }
      } catch (err) {
        // Handle account creation/funding errors gracefully
        if (String(err?.message || '').toLowerCase().includes('exist')) {
          console.log('✅ Account exists (confirmed by error)');
          // Account exists but we couldn't get info, that's OK
          return;
        }
        console.error('❌ Failed to ensure account has funds:', err?.message || err);
        throw new Error(`Account setup failed: ${err.message || err}`);
      }
    }

    async function acknowledgeProvider(broker, providerAddr) {
      try {
        await broker.inference.acknowledgeProviderSigner(providerAddr);
        console.log('✓ Provider acknowledged');
      } catch (err) {
        if (!String(err?.message || '').toLowerCase().includes('already acknowledged')) throw err;
        console.log('ℹ Provider already acknowledged');
      }
    }

    async function generateHeaders(broker, providerAddr, prompt) {
      try {
        console.log('🔄 Requesting headers from broker...');
        const rawHeaders = await broker.inference.getRequestHeaders(providerAddr, prompt);

        if (!rawHeaders || typeof rawHeaders !== 'object') {
          throw new Error('Invalid headers received from broker');
        }

        console.log('📋 Processing headers with BigInt conversion...');

        const processedHeaders = {};
        for (const [key, value] of Object.entries(rawHeaders)) {
          try {
            if (value === null || value === undefined) {
              processedHeaders[key] = '';
            } else if (typeof value === 'bigint') {
              processedHeaders[key] = value.toString();
            } else if (typeof value === 'object') {
              // JSON stringify with replacer for nested BigInt
              processedHeaders[key] = JSON.stringify(value, (k, v) => typeof v === 'bigint' ? v.toString() : v);
            } else {
              processedHeaders[key] = String(value);
            }
            console.log(`  ✓ ${key}: ${typeof value} -> string`);
          } catch (conversionErr) {
            console.warn(`  ⚠️ Failed to convert header "${key}":`, conversionErr?.message || conversionErr);
            processedHeaders[key] = String(value);
          }
        }

        console.log('✅ Headers processed successfully');
        return processedHeaders;
      } catch (err) {
        throw new Error(`Failed to generate request headers: ${err.message || err}`);
      }
    }

    async function callProvider(endpoint, model, headers, userAddr, prompt) {
      try {
        console.log('🌐 Making request to:', endpoint);

        // Use OpenAI client with custom baseURL as in TypeScript starter
        const openai = new OpenAI({ baseURL: endpoint, apiKey: '' });

        const requestHeaders = {};
        Object.entries(headers || {}).forEach(([key, value]) => {
          if (typeof value === 'string') requestHeaders[key] = value;
        });
        requestHeaders['x-user-address'] = userAddr;

        console.log('📤 Request headers:', Object.keys(requestHeaders));

        // Call chat completions via OpenAI client
        const completion = await openai.chat.completions.create(
          {
            messages: [{ role: 'user', content: prompt }],
            model
          },
          { headers: requestHeaders }
        );

        console.log('📥 Response received from OpenAI client');

        const answer = completion?.choices?.[0]?.message?.content || completion?.choices?.[0]?.text || null;
        const chatId = completion?.id || null;

        if (!answer) throw new Error('No response content received from model');
        return { answer, chatId };
      } catch (err) {
        console.error('❌ Provider call failed:', err?.message || err);
        throw new Error(`Provider API error: ${err?.message || err}`);
      }
    }

    async function validateResponse(broker, providerAddr, answer, chatID) {
      try {
        console.log('✔️ Validating response with broker...');
        const result = await broker.inference.processResponse(providerAddr, answer, chatID || undefined);
        const validationResult = typeof result === 'bigint' ? result.toString() : result;
        console.log('✅ Validation result:', validationResult);
        return validationResult;
      } catch (err) {
        console.error('⚠️ Response validation failed:', err?.message || err);
        return 'validation_failed';
      }
    }

    // --- Express App Setup ---
    const app = express();
    app.use(bigintJsonMiddleware);

    app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Import and mount workflow routes if they exist
      const workflowRouter = require('./routes/workflow');
      app.use('/api/workflow', workflowRouter);


    // --- Configuration ---
    const RPC_URL = (process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai').trim();
    const INDEXER_RPC = (process.env.INDEXER_RPC || 'https://indexer-storage-testnet-turbo.0g.ai').trim();
    const KV_NODE_URL = (process.env.KV_NODE_URL || 'http://3.101.147.150:6789').trim();

  // Flow contract address (can be overridden via env)
  const FLOW_CONTRACT_ADDRESS = process.env.FLOW_CONTRACT_ADDRESS || '0xbD75117F80b4E22698D0Cd7612d92BDb8eaff628';

    // Storage configuration (used by storage endpoints)
    const STORAGE_CONFIG = {
      RPC_URL: RPC_URL,
      INDEXER_RPC: INDEXER_RPC,
      KV_NODE_URL: KV_NODE_URL
    };

    // Ensure uploads directory exists and configure multer
    const uploadsDir = path.join(__dirname, 'uploads');
    try {
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    } catch (e) {
      console.warn('Could not ensure uploads directory:', e?.message || e);
    }

    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
    });

    const upload = multer({ storage });

    // Storage/indexer/batcher instances (lazy initialize)
    let storageIndexer = null;
    let batcher = null;

    const initStorageIndexer = () => {
      if (storageIndexer) return storageIndexer;
      try {
        storageIndexer = new Indexer(STORAGE_CONFIG.INDEXER_RPC);
      } catch (e) {
        try { storageIndexer = new Indexer(); } catch (e2) { storageIndexer = null; }
      }
      return storageIndexer;
    };

    const initBatcher = () => {
      if (batcher) return batcher;
      // Try a few constructor signatures
      try {
        batcher = new Batcher(serviceWallet, STORAGE_CONFIG.RPC_URL);
      } catch (e) {
        try { batcher = new Batcher(STORAGE_CONFIG.RPC_URL); } catch (e2) {
          try { batcher = new Batcher(); } catch (e3) { batcher = null; }
        }
      }
      return batcher;
    };

    const requireStorage = (req, res, next) => {
      const idx = initStorageIndexer();
      if (!idx) return res.status(500).json({ error: 'Storage not available', details: 'Failed to initialize storage indexer' });
      // attach to req for convenience
      req.storageIndexer = idx;
      next();
    };

    const requireBatcher = (req, res, next) => {
      const b = initBatcher();
      if (!b) return res.status(500).json({ error: 'Batcher not available', details: 'Failed to initialize batcher' });
      req.batcher = b;
      next();
    };

    // Initialize providers and clients
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const serviceWallet = new ethers.Wallet(process.env.SERVICE_PRIVATE_KEY, provider);

    // --- Broker Initialization ---
    let broker;
    let brokerInitialized = false;

    const initBroker = async () => {
      try {
        console.log('🔄 Initializing 0G Compute broker...');
        console.log('Service wallet address:', serviceWallet.address);

        broker = await createZGComputeNetworkBroker(serviceWallet);
        brokerInitialized = true;
        console.log('✅ Compute broker initialized successfully');

        const balance = await provider.getBalance(serviceWallet.address);
        console.log(`Service wallet balance: ${ethers.formatEther(balance)} ETH`);

        // Initialize account with funds (idempotent)
        try {
          const addRes = await broker.ledger.addLedger(0.05);
          console.log('addLedger result:', addRes);
          console.log('✅ Created new account with 0.05 A0GI');
        } catch (e) {
          if (/exist/i.test(String(e?.message || ''))) {
            console.log('✅ Account exists, checking if it needs funding...');
            try {
              // Check account balance and fund if needed
              const account = await broker.ledger.getLedger();
              if (account) {
                const balanceValue = account.balance ?? account.totalbalance ?? 0;
                const balance = typeof balanceValue === 'string' ? BigInt(balanceValue) :
                               typeof balanceValue === 'number' ? BigInt(balanceValue) :
                               typeof balanceValue === 'bigint' ? balanceValue :
                               BigInt(0);
                const balanceOG = parseFloat(ethers.formatEther(balance));
                
                if (balanceOG < 0.01) {
                  console.log(`Low balance (${balanceOG} OG), depositing funds...`);
                  await broker.ledger.depositFund(0.05);
                  console.log('✅ Deposited 0.05 OG to existing account');
                } else {
                  console.log(`✅ Account has sufficient balance: ${balanceOG} OG`);
                }
              }
            } catch (balanceError) {
              console.log('Could not check/update balance:', balanceError.message);
            }
          } else {
            throw e;
          }
        }

        const services = await broker.inference.listService();
        console.log(`✅ Found ${services.length} compute services`);
      } catch (err) {
        console.error('❌ Failed to initialize compute broker:', err?.message || err);
        brokerInitialized = false;
      }
    };

    initBroker();

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

    // Test endpoint for funding compute account
    app.post('/api/fund-account', requireBroker, async (req, res) => {
      try {
        const { amount = '0.1' } = req.body;
        console.log(`🔄 Manual funding request for ${amount} OG tokens...`);

        await fundComputeAccount(broker, amount);

        // Check final balance
        const account = await broker.ledger.getLedger();
        const balanceValue = account.totalbalance ?? account.balance ?? 0;
        const balanceBigInt = typeof balanceValue === 'string' ? BigInt(balanceValue) :
                             typeof balanceValue === 'number' ? BigInt(balanceValue) :
                             typeof balanceValue === 'bigint' ? balanceValue :
                             BigInt(0);
        const balance = ethers.formatEther(balanceBigInt);

        res.json({
          success: true,
          message: `Successfully funded compute account with ${amount} OG tokens`,
          balance: balance,
          unit: 'OG (equivalent to A0GI for fees)'
        });
      } catch (err) {
        console.error('❌ Manual funding failed:', err?.message || err);
        res.status(500).json({
          error: 'Failed to fund compute account',
          details: err?.message || err
        });
      }
    });

    // Check account balance endpoint
    app.get('/api/account-balance', requireBroker, async (req, res) => {
      try {
        console.log('🔄 Checking compute account balance...');
        const account = await broker.ledger.getLedger();

        // Safely extract balance values
        const totalValue = account.totalbalance ?? account.balance ?? 0;
        const lockedValue = account.locked ?? 0;

        const totalBigInt = typeof totalValue === 'string' ? BigInt(totalValue) :
                           typeof totalValue === 'number' ? BigInt(totalValue) :
                           typeof totalValue === 'bigint' ? totalValue :
                           BigInt(0);
        const lockedBigInt = typeof lockedValue === 'string' ? BigInt(lockedValue) :
                            typeof lockedValue === 'number' ? BigInt(lockedValue) :
                            typeof lockedValue === 'bigint' ? lockedValue :
                            BigInt(0);

        const balance = ethers.formatEther(totalBigInt);
        const locked = ethers.formatEther(lockedBigInt);
        const available = ethers.formatEther(totalBigInt - lockedBigInt);

        res.json({
          success: true,
          account: {
            total: balance,
            locked: locked,
            available: available,
            unit: 'OG (A0GI equivalent)'
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

    app.get('/api/services', requireBroker, async (req, res) => {
      try {
        console.log('📋 Listing available compute services...');
        const services = await broker.inference.listService();
        
        // Transform the raw service data into a more readable format
        const formattedServices = services.map(service => ({
          providerAddress: service[0],
          serviceType: service[1],
          endpoint: service[2],
          inputPrice: service[3],
          outputPrice: service[4],
          updatedAt: service[5],
          model: service[6],
          provider: service[7],
          signature: service[8]
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
        await broker.inference.acknowledgeProviderSigner(providerAddress);
        res.json({ success: true, provider: providerAddress, acknowledgedAt: new Date().toISOString() });
      } catch (err) {
        console.error(`❌ Failed to acknowledge provider:`, err?.message || err);
        res.status(500).json({ error: 'Failed to acknowledge provider', details: String(err) });
      }
    });

app.post('/api/inference', requireBroker, async (req, res) => {
  const { providerAddress, prompt, userAddress } = req.body;
  if (!providerAddress || !prompt || !userAddress) return res.status(400).json({ error: 'Missing required parameters', details: 'providerAddress, prompt, and userAddress are all required.' });

  console.log('🔄 Processing inference request:', { provider: providerAddress, user: userAddress, promptLength: prompt.length });

  try {
    const formattedProviderAddress = ethers.getAddress(providerAddress);
    const formattedUserAddress = ethers.getAddress(userAddress);
    console.log('✅ Addresses validated');

    console.log('💰 Checking account funds...');
    await ensureAccountHasFunds(broker);

    console.log('🤝 Acknowledging provider...');
    await acknowledgeProvider(broker, formattedProviderAddress);

    console.log('📋 Getting service metadata...');
    const metadata = await broker.inference.getServiceMetadata(formattedProviderAddress);
    const { endpoint, model } = metadata;
    console.log('✅ Got metadata:', { endpoint, model });

    console.log('📝 Generating request headers...');
    const headers = await generateHeaders(broker, formattedProviderAddress, prompt);
    console.log('✅ Headers generated successfully');

    console.log('🚀 Calling provider endpoint...');
    const { answer, chatId } = await callProvider(endpoint, model, headers, formattedUserAddress, prompt);
    console.log('✅ Got response from provider:', { responseLength: answer.length, chatId: chatId });

    console.log('✔️ Validating response...');
    const validationResult = await validateResponse(broker, formattedProviderAddress, answer, chatId);
    console.log('✅ Response validated:', validationResult);

    const responseData = { response: answer, model, valid: validationResult, chatId, timestamp: new Date().toISOString(), provider: formattedProviderAddress, user: formattedUserAddress, metadata: { endpoint, promptLength: prompt.length, responseLength: answer.length } };

    console.log('✅ Inference completed successfully');
    res.json(responseData);
  } catch (err) {
    console.error('❌ Inference failed:', err);
    let statusCode = 500;
    if (String(err?.message || '').includes('Provider API error: 4')) statusCode = 400;
    else if (String(err?.message || '').includes('Invalid address')) statusCode = 400;
    else if (String(err?.message || '').includes('Insufficient balance')) statusCode = 402;

    const errorResponse = { error: 'Inference request failed', details: String(err?.message || err), type: err?.name, provider: providerAddress, user: userAddress, timestamp: new Date().toISOString() };
    if (process.env.NODE_ENV === 'development') errorResponse.debug = { stack: err?.stack };
    res.status(statusCode).json(errorResponse);
  }
});

app.use((err, req, res) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: String(err?.message || err), timestamp: new Date().toISOString() });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl, method: req.method });
});


// ==================== STORAGE ENDPOINTS ====================

// Upload file to 0G Storage
app.post('/api/storage/upload', requireStorage, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file provided',
      details: 'Please provide a file to upload'
    });
  }

  const filePath = req.file.path;
  console.log(`📤 Uploading file: ${req.file.originalname} (${req.file.size} bytes)`);

  try {
    // Create ZgFile from uploaded file
    const file = await ZgFile.fromFilePath(filePath);
    
    // Generate Merkle tree
    const [tree, treeErr] = await file.merkleTree();
    if (treeErr !== null) {
      throw new Error(`Error generating Merkle tree: ${treeErr}`);
    }
    
    const rootHash = tree?.rootHash();
    console.log(`📋 File root hash: ${rootHash}`);
    
    // Upload to 0G Storage network
    const [tx, uploadErr] = await storageIndexer.upload(
      file, 
      STORAGE_CONFIG.RPC_URL, 
      serviceWallet
    );
    
    if (uploadErr !== null) {
      throw new Error(`Upload error: ${uploadErr}`);
    }
    
    console.log(`✅ Upload successful! TX: ${tx}`);
    
    // Clean up temporary file
    await file.close();
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      rootHash,
      txHash: tx,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ Upload failed:', err.message);
    
    // Clean up temporary file on error
    try {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupErr) {
      console.error('Failed to clean up temp file:', cleanupErr.message);
    }
    
    res.status(500).json({
      error: 'File upload failed',
      details: err.message
    });
  }
});

// Download file from 0G Storage
app.get('/api/storage/download/:rootHash', requireStorage, async (req, res) => {
  const { rootHash } = req.params;
  const { filename = 'download' } = req.query;
  
  console.log(`📥 Downloading file with root hash: ${rootHash}`);
  
  try {
    // Create temporary download path
    const downloadDir = './downloads';
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    
    const outputPath = path.join(downloadDir, `${Date.now()}-${filename}`);
    
    // Download from 0G Storage (with proof verification)
    const downloadErr = await storageIndexer.download(rootHash, outputPath, true);
    if (downloadErr !== null) {
      throw new Error(`Download error: ${downloadErr}`);
    }
    
    console.log(`✅ Download successful: ${outputPath}`);
    
    // Stream file to client
    res.download(outputPath, filename, (err) => {
      // Clean up downloaded file after sending
      try {
        fs.unlinkSync(outputPath);
      } catch (cleanupErr) {
        console.error('Failed to clean up download file:', cleanupErr.message);
      }
      
      if (err && !res.headersSent) {
        console.error('❌ Error sending file:', err.message);
        res.status(500).json({
          error: 'Failed to send file',
          details: err.message
        });
      }
    });

  } catch (err) {
    console.error('❌ Download failed:', err.message);
    res.status(500).json({
      error: 'File download failed',
      details: err.message,
      rootHash
    });
  }
});

// Store key-value data in 0G-KV
app.post('/api/storage/kv/store', requireStorage, requireBatcher, async (req, res) => {
  const { streamId, key, value } = req.body;
  
  if (!streamId || !key || !value) {
    return res.status(400).json({
      error: 'Missing required parameters',
      details: 'streamId, key, and value are all required'
    });
  }

  console.log(`🔑 Storing KV data: ${key} in stream ${streamId}`);

  try {
    const keyBytes = Uint8Array.from(Buffer.from(key, 'utf-8'));
    const valueBytes = Uint8Array.from(Buffer.from(value, 'utf-8'));

    // Submit via Batcher (proper durable storage)
    const result = await batcher.submitSetData(streamId, keyBytes, valueBytes);
    if (result.error) {
      throw new Error(`Batcher submit error: ${result.error}`);
    }

    console.log(`✅ KV data submitted. BatchTx: ${result.batchTxHash}`);

    res.json({
      success: true,
      streamId,
      key,
      valueLength: value.length,
      batchTxHash: result.batchTxHash,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ KV store failed:', err.message);
    res.status(500).json({
      error: 'Failed to store key-value data',
      details: err.message
    });
  }
});

// Retrieve key-value data from 0G-KV
app.get('/api/storage/kv/:streamId/:key', requireStorage, async (req, res) => {
  const { streamId, key } = req.params;
  
  console.log(`🔍 Retrieving KV data: ${key} from stream ${streamId}`);

  try {
    const kvClient = new KvClient(STORAGE_CONFIG.KV_NODE_URL);
    const keyBytes = ethers.encodeBase64(Uint8Array.from(Buffer.from(key, 'utf-8')));
    const value = await kvClient.getValue(streamId, keyBytes);

    if (!value || value === '0x') {
      return res.status(404).json({
        error: 'Key not found or empty',
        streamId,
        key
      });
    }

    // Decode hex string to UTF-8
    let stringValue = value;
    try {
      if (value.startsWith('0x')) {
        stringValue = Buffer.from(value.slice(2), 'hex').toString('utf-8');
      }
    } catch (decodeErr) {
      stringValue = value; // fallback
    }

    res.json({
      success: true,
      streamId,
      key,
      value: stringValue,
      rawValue: value,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ KV retrieve failed:', err.message);
    res.status(500).json({
      error: 'Failed to retrieve key-value data',
      details: err.message
    });
  }
});

// Get file info by root hash
app.get('/api/storage/info/:rootHash', requireStorage, async (req, res) => {
  const { rootHash } = req.params;
  
  try {
    const fileInfo = await storageIndexer.getFileInfo(rootHash);
    if (!fileInfo || fileInfo.blockNumber === 0) {
      return res.status(404).json({
        error: 'File not found on 0G Storage',
        rootHash
      });
    }

    res.json({
      rootHash,
      status: 'stored',
      fileSize: fileInfo.fileSize,
      blockNumber: fileInfo.blockNumber,
      owner: fileInfo.owner,
      timestamp: new Date(Number(fileInfo.timestamp) * 1000).toISOString(),
      txHash: fileInfo.txHash
    });
  } catch (err) {
    console.error('❌ Failed to get file info:', err.message);
    res.status(500).json({
      error: 'Failed to get file information',
      details: err.message
    });
  }
});

// ==================== HTTP REQUEST ENDPOINT ====================

// Execute HTTP request
app.post('/api/http-request', async (req, res) => {
  const { method, url, headers = [], body, authType, authData } = req.body;

  if (!method || !url) {
    return res.status(400).json({
      error: 'Missing required parameters',
      details: 'method and url are required'
    });
  }

  console.log(`🌐 Making ${method} request to: ${url}`);

  try {
    // Prepare request options
    const requestOptions = {
      method: method.toUpperCase(),
      headers: {
        'User-Agent': 'Agent0G-Workflow/1.0',
        'Content-Type': 'application/json',
        ...Object.fromEntries(headers.filter(h => h.key && h.value).map(h => [h.key, h.value]))
      }
    };

    // Add authentication
    if (authType === 'basic' && authData?.username && authData?.password) {
      const credentials = Buffer.from(`${authData.username}:${authData.password}`).toString('base64');
      requestOptions.headers['Authorization'] = `Basic ${credentials}`;
    } else if (authType === 'bearer' && authData?.token) {
      requestOptions.headers['Authorization'] = `Bearer ${authData.token}`;
    } else if (authType === 'apiKey' && authData?.apiKey && authData?.headerName) {
      requestOptions.headers[authData.headerName] = authData.apiKey;
    }

    // Add body for non-GET requests
    if (method.toUpperCase() !== 'GET' && body) {
      requestOptions.body = body;
    }

    console.log('📤 Request options prepared');

    // Make the HTTP request
    const response = await fetch(url, requestOptions);

    // Get response data
    const responseText = await response.text();
    let responseJson = null;

    try {
      responseJson = JSON.parse(responseText);
    } catch (parseErr) {
      // Response is not JSON, keep as text
    }

    const responseData = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseJson || responseText,
      url: response.url,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ HTTP request completed: ${response.status} ${response.statusText}`);

    res.json(responseData);

  } catch (err) {
    console.error('❌ HTTP request failed:', err.message);
    res.status(500).json({
      error: 'HTTP request failed',
      details: err.message,
      url,
      method,
      timestamp: new Date().toISOString()
    });
  }
});

// Execute Google Sheets operation
app.post('/api/google-sheets', async (req, res) => {
  const { operation, spreadsheetId, sheetName, range, data, accessToken } = req.body;

  if (!operation || !spreadsheetId || !accessToken) {
    return res.status(400).json({
      error: 'Missing required parameters',
      details: 'operation, spreadsheetId, and accessToken are required'
    });
  }

  console.log(`📊 Making ${operation} request to Google Sheets: ${spreadsheetId}`);

  try {
    let result = null;

    if (operation === 'read') {
      // Read data from Google Sheets
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!${range || 'A1:Z100'}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        result = await response.json();
      } else {
        throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
      }
    } else if (operation === 'write' || operation === 'append') {
      // Write/append data to Google Sheets
      const requestBody = {
        values: data,
        majorDimension: 'ROWS'
      };

      const sheetRange = operation === 'append' 
        ? `${sheetName}!A:A` 
        : `${sheetName}!${range || 'A1'}`;

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetRange}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (response.ok) {
        result = { 
          success: true, 
          operation: operation, 
          updatedRange: sheetRange,
          updatedRows: data.length 
        };
      } else {
        throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
      }
    }

    console.log(`✅ Google Sheets ${operation} completed successfully`);
    res.json(result);

  } catch (err) {
    console.error('❌ Google Sheets operation failed:', err.message);
    res.status(500).json({
      error: 'Google Sheets operation failed',
      details: err.message,
      operation,
      spreadsheetId
    });
  }
});

// ==================== WEB SCRAPING ENDPOINTS ====================

// Google Search endpoint
app.post('/api/google-search', async (req, res) => {
  const { query, numResults = 10, language = 'en', region = 'us', safeSearch = 'moderate' } = req.body;

  if (!query) {
    return res.status(400).json({
      error: 'Missing required parameters',
      details: 'query is required'
    });
  }

  console.log(`🔍 Performing Google search: "${query}"`);

  try {
    // Using Google Custom Search API (requires API key and search engine ID)
    const apiKey = process.env.GOOGLE_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !searchEngineId) {
      throw new Error('Google API credentials not configured. Please set GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID environment variables.');
    }

    const searchUrl = new URL('https://www.googleapis.com/customsearch/v1');
    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('cx', searchEngineId);
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('num', Math.min(numResults, 10).toString());
    searchUrl.searchParams.set('hl', language);
    searchUrl.searchParams.set('gl', region);
    searchUrl.searchParams.set('safe', safeSearch);

    const response = await fetch(searchUrl.toString());
    
    if (!response.ok) {
      throw new Error(`Google Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    const results = data.items?.map(item => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      displayLink: item.displayLink,
      formattedUrl: item.formattedUrl
    })) || [];

    console.log(`✅ Found ${results.length} search results`);

    res.json({
      success: true,
      query,
      results,
      searchInformation: {
        totalResults: data.searchInformation?.totalResults,
        searchTime: data.searchInformation?.searchTime
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ Google search failed:', err.message);
    res.status(500).json({
      error: 'Google search failed',
      details: err.message,
      query
    });
  }
});

// Web Scraper endpoint
app.post('/api/web-scraper', async (req, res) => {
  const { 
    url, 
    extractionMode = 'text', 
    selectors, 
    includeImages = false, 
    includeLinks = false, 
    includeMetadata = true,
    timeout = 30,
    userAgent = 'default',
    followRedirects = true
  } = req.body;

  if (!url) {
    return res.status(400).json({
      error: 'Missing required parameters',
      details: 'url is required'
    });
  }

  console.log(`🕷️ Scraping web page: ${url}`);

  try {
    // Use Puppeteer 
    const puppeteer = require('puppeteer');
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set user agent
    const userAgents = {
      default: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      bot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    };

    await page.setUserAgent(userAgents[userAgent] || userAgents.default);

    // Set timeout
    page.setDefaultTimeout(timeout * 1000);

    // Navigate to page
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: timeout * 1000
    });

    let extractedData = {};

    // Extract content based on mode
    if (extractionMode === 'text') {
      extractedData.content = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        return document.body.innerText;
      });
    } else if (extractionMode === 'markdown') {
      // Convert HTML to markdown (basic implementation)
      extractedData.content = await page.evaluate(() => {
        const content = document.querySelector('main, article, .content, #content, .post, .entry') || document.body;
        return content.innerText;
      });
    } else if (extractionMode === 'html') {
      extractedData.content = await page.content();
    } else if (extractionMode === 'structured') {
      extractedData.content = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
          tag: h.tagName.toLowerCase(),
          text: h.innerText
        }));
        
        const paragraphs = Array.from(document.querySelectorAll('p')).map(p => p.innerText);
        
        return { headings, paragraphs };
      });
    } else if (extractionMode === 'custom' && selectors) {
      extractedData.content = await page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        return Array.from(elements).map(el => el.innerText);
      }, selectors);
    }

    // Extract metadata
    if (includeMetadata) {
      extractedData.metadata = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
        keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content'),
        author: document.querySelector('meta[name="author"]')?.getAttribute('content'),
        ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
        ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content')
      }));
    }

    // Extract images
    if (includeImages) {
      extractedData.images = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt,
          title: img.title
        }));
      });
    }

    // Extract links
    if (includeLinks) {
      extractedData.links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]')).map(link => ({
          href: link.href,
          text: link.innerText,
          title: link.title
        }));
      });
    }

    await browser.close();

    console.log(`✅ Successfully scraped content from ${url}`);

    res.json({
      success: true,
      url,
      data: extractedData,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ Web scraping failed:', err.message);
    res.status(500).json({
      error: 'Web scraping failed',
      details: err.message,
      url
    });
  }
});

// Data Formatter endpoint
app.post('/api/data-formatter', async (req, res) => {
  const { 
    data, 
    promptTemplate, 
    formatType = 'research',
    includeMetadata = true,
    includeUrls = true,
    cleanText = true,
    maxLength = 'auto'
  } = req.body;

  if (!data || !promptTemplate) {
    return res.status(400).json({
      error: 'Missing required parameters',
      details: 'data and promptTemplate are required'
    });
  }

  console.log(`📝 Formatting data with template type: ${formatType}`);

  try {
    let formattedData = [];

    // Process each data item
    if (Array.isArray(data)) {
      formattedData = data.map(item => formatSingleItem(item, promptTemplate, {
        includeMetadata,
        includeUrls,
        cleanText,
        maxLength
      }));
    } else {
      formattedData = [formatSingleItem(data, promptTemplate, {
        includeMetadata,
        includeUrls,
        cleanText,
        maxLength
      })];
    }

    console.log(`✅ Formatted ${formattedData.length} data items`);

    res.json({
      success: true,
      formattedData,
      count: formattedData.length,
      formatType,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ Data formatting failed:', err.message);
    res.status(500).json({
      error: 'Data formatting failed',
      details: err.message
    });
  }
});

// Helper function for data formatting
function formatSingleItem(item, template, options) {
  let formatted = template;

  // Replace template variables
  const replacements = {
    '{{title}}': item.metadata?.title || item.title || 'Untitled',
    '{{url}}': item.url || item.link || '',
    '{{content}}': item.content || item.snippet || '',
    '{{description}}': item.metadata?.description || item.snippet || '',
    '{{keywords}}': item.metadata?.keywords || '',
    '{{author}}': item.metadata?.author || '',
    '{{date}}': new Date().toLocaleDateString()
  };

  // Apply text cleaning if requested
  if (options.cleanText && replacements['{{content}}']) {
    replacements['{{content}}'] = replacements['{{content}}']
      .replace(/\s+/g, ' ')
      .replace(/\n\n+/g, '\n\n')
      .trim();
  }

  // Apply length limits
  if (options.maxLength !== 'auto' && options.maxLength !== 'full') {
    const limits = {
      short: 1000,
      medium: 2500,
      long: 5000
    };
    
    const limit = limits[options.maxLength] || 2500;
    if (replacements['{{content}}'] && replacements['{{content}}'].length > limit) {
      replacements['{{content}}'] = replacements['{{content}}'].substring(0, limit) + '...';
    }
  }

  // Replace all template variables
  for (const [variable, value] of Object.entries(replacements)) {
    formatted = formatted.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value || '');
  }

  return formatted;
}

// Markdown Generator endpoint
app.post('/api/markdown-generator', async (req, res) => {
  const { 
    data, 
    fileName = 'research-report',
    includeTimestamp = true,
    includeToC = true,
    includeMetadata = true,
    templateStyle = 'professional',
    headerTemplate,
    footerTemplate
  } = req.body;

  if (!data) {
    return res.status(400).json({
      error: 'Missing required parameters',
      details: 'data is required'
    });
  }

  console.log(`📄 Generating markdown report: ${fileName}`);

  try {
    let markdown = '';
    const timestamp = new Date();
    const dateStr = timestamp.toLocaleDateString();
    const timestampStr = timestamp.toISOString();

    // Generate header
    if (headerTemplate) {
      markdown += headerTemplate
        .replace(/{{date}}/g, dateStr)
        .replace(/{{timestamp}}/g, timestampStr)
        .replace(/{{query}}/g, data.query || 'Research Query')
        .replace(/{{sourceCount}}/g, Array.isArray(data.results) ? data.results.length : '1');
    }

    // Generate table of contents if requested
    if (includeToC && Array.isArray(data.results) && data.results.length > 1) {
      markdown += '\n## Table of Contents\n\n';
      data.results.forEach((item, index) => {
        const title = item.title || item.metadata?.title || `Source ${index + 1}`;
        const anchor = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        markdown += `${index + 1}. [${title}](#${anchor})\n`;
      });
      markdown += '\n---\n\n';
    }

    // Generate main content
    if (Array.isArray(data.results)) {
      data.results.forEach((item, index) => {
        const title = item.title || item.metadata?.title || `Source ${index + 1}`;
        markdown += `## ${title}\n\n`;
        
        if (includeMetadata && item.url) {
          markdown += `**Source:** [${item.url}](${item.url})\n\n`;
        }
        
        if (item.content) {
          markdown += `${item.content}\n\n`;
        }
        
        if (index < data.results.length - 1) {
          markdown += '---\n\n';
        }
      });
    } else {
      // Single item
      if (data.title) {
        markdown += `## ${data.title}\n\n`;
      }
      if (includeMetadata && data.url) {
        markdown += `**Source:** [${data.url}](${data.url})\n\n`;
      }
      if (data.content) {
        markdown += `${data.content}\n\n`;
      }
    }

    // Generate footer
    if (footerTemplate) {
      markdown += footerTemplate
        .replace(/{{timestamp}}/g, timestampStr)
        .replace(/{{date}}/g, dateStr);
    }

    const fileNameWithExt = fileName.endsWith('.md') ? fileName : `${fileName}.md`;

    console.log(`✅ Generated markdown report: ${fileNameWithExt}`);

    res.json({
      success: true,
      fileName: fileNameWithExt,
      content: markdown,
      contentLength: markdown.length,
      timestamp: timestampStr
    });

  } catch (err) {
    console.error('❌ Markdown generation failed:', err.message);
    res.status(500).json({
      error: 'Markdown generation failed',
      details: err.message
    });
  }
});

// ==================== WORKFLOW EXECUTION ENDPOINT ====================

// Execute workflow with support for web scraping nodes
app.post('/api/execute-workflow', requireBroker, async (req, res) => {
  const { nodes, edges, userAddress, providerAddress } = req.body;

  if (!nodes || !edges || !userAddress) {
    return res.status(400).json({
      error: 'Missing required parameters',
      details: 'nodes, edges, and userAddress are required'
    });
  }

  console.log(`🔄 Executing workflow with ${nodes.length} nodes and ${edges.length} edges`);

  try {
    const workflowResults = {
      startTime: new Date().toISOString(),
      nodeResults: {},
      executionOrder: [],
      status: 'running'
    };

    // Simple execution: process nodes in topological order
    const processedNodes = new Set();
    const nodeResults = {};

    // Helper function to check if all dependencies are satisfied
    const canExecuteNode = (nodeId) => {
      const incomingEdges = edges.filter(edge => edge.target === nodeId);
      return incomingEdges.every(edge => processedNodes.has(edge.source));
    };

    // Helper function to execute a single node
    const executeNode = async (node) => {
      console.log(`🔄 Executing node: ${node.id} (${node.type})`);
      workflowResults.executionOrder.push(node.id);

      try {
        let result = null;

        switch (node.type) {
          case 'googleSearch':
            const searchQuery = node.data.query || 'default search';
            const numResults = node.data.numResults || 5;
            
            const searchResponse = await fetch(`${req.protocol}://${req.get('host')}/api/google-search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                query: searchQuery, 
                numResults,
                language: node.data.language || 'en',
                region: node.data.region || 'us',
                safeSearch: node.data.safeSearch || 'moderate'
              })
            });

            if (searchResponse.ok) {
              result = await searchResponse.json();
            } else {
              throw new Error(`Google search failed: ${searchResponse.statusText}`);
            }
            break;

          case 'webScraper':
            // Get URLs from previous Google Search node
            const searchNode = nodes.find(n => n.type === 'googleSearch');
            const searchResults = nodeResults[searchNode?.id]?.results || [];
            
            if (searchResults.length === 0) {
              throw new Error('No URLs to scrape - Google Search node must run first');
            }

            const scrapePromises = searchResults.slice(0, 3).map(async (searchResult) => {
              try {
                const scrapeResponse = await fetch(`${req.protocol}://${req.get('host')}/api/web-scraper`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    url: searchResult.link,
                    extractionMode: node.data.extractionMode || 'text',
                    includeMetadata: node.data.includeMetadata || true,
                    timeout: Array.isArray(node.data.timeout) ? node.data.timeout[0] : (node.data.timeout || 30)
                  })
                });

                if (scrapeResponse.ok) {
                  const scrapeData = await scrapeResponse.json();
                  return {
                    ...searchResult,
                    scrapedData: scrapeData.data
                  };
                } else {
                  console.warn(`Failed to scrape ${searchResult.link}`);
                  return {
                    ...searchResult,
                    scrapedData: { content: searchResult.snippet || '' }
                  };
                }
              } catch (err) {
                console.warn(`Error scraping ${searchResult.link}:`, err.message);
                return {
                  ...searchResult,
                  scrapedData: { content: searchResult.snippet || '' }
                };
              }
            });

            const scrapedResults = await Promise.all(scrapePromises);
            result = { scrapedData: scrapedResults };
            break;

          case 'dataFormatter':
            // Get data from previous web scraper node
            const scraperNode = nodes.find(n => n.type === 'webScraper');
            const scrapedData = nodeResults[scraperNode?.id]?.scrapedData || [];

            const formatResponse = await fetch(`${req.protocol}://${req.get('host')}/api/data-formatter`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                data: scrapedData,
                promptTemplate: node.data.promptTemplate || 'Summarize: {{content}}',
                formatType: node.data.formatType || 'research',
                includeMetadata: node.data.includeMetadata !== false,
                includeUrls: node.data.includeUrls !== false,
                cleanText: node.data.cleanText !== false,
                maxLength: node.data.maxLength || 'auto'
              })
            });

            if (formatResponse.ok) {
              result = await formatResponse.json();
            } else {
              throw new Error(`Data formatting failed: ${formatResponse.statusText}`);
            }
            break;

          case 'ai':
            // Get formatted data from previous formatter node
            const formatterNode = nodes.find(n => n.type === 'dataFormatter');
            const formattedData = nodeResults[formatterNode?.id]?.formattedData || [];

            if (!providerAddress) {
              throw new Error('Provider address required for AI node execution');
            }

            const combinedPrompt = formattedData.join('\n\n---\n\n');

            const aiResponse = await fetch(`${req.protocol}://${req.get('host')}/api/inference`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                providerAddress,
                prompt: combinedPrompt,
                userAddress
              })
            });

            if (aiResponse.ok) {
              result = await aiResponse.json();
            } else {
              throw new Error(`AI inference failed: ${aiResponse.statusText}`);
            }
            break;

          case 'markdownGenerator':
            // Get AI analysis from previous AI node
            const aiNode = nodes.find(n => n.type === 'ai');
            const aiAnalysis = nodeResults[aiNode?.id]?.response || 'No analysis available';

            // Get original search query
            const originalSearchNode = nodes.find(n => n.type === 'googleSearch');
            const searchQuery2 = originalSearchNode?.data?.query || 'Research Query';

            const markdownResponse = await fetch(`${req.protocol}://${req.get('host')}/api/markdown-generator`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                data: {
                  query: searchQuery2,
                  analysis: aiAnalysis,
                  results: nodeResults[nodes.find(n => n.type === 'webScraper')?.id]?.scrapedData || []
                },
                fileName: node.data.fileName || 'workflow-report',
                includeTimestamp: node.data.includeTimestamp !== false,
                includeToC: node.data.includeToC !== false,
                includeMetadata: node.data.includeMetadata !== false,
                templateStyle: node.data.templateStyle || 'professional',
                headerTemplate: node.data.headerTemplate,
                footerTemplate: node.data.footerTemplate
              })
            });

            if (markdownResponse.ok) {
              result = await markdownResponse.json();
            } else {
              throw new Error(`Markdown generation failed: ${markdownResponse.statusText}`);
            }
            break;

          default:
            console.warn(`Unknown node type: ${node.type}`);
            result = { message: `Node type ${node.type} not implemented` };
        }

        nodeResults[node.id] = result;
        workflowResults.nodeResults[node.id] = {
          nodeType: node.type,
          status: 'completed',
          result,
          timestamp: new Date().toISOString()
        };

        console.log(`✅ Node ${node.id} completed successfully`);
        return true;

      } catch (error) {
        console.error(`❌ Node ${node.id} failed:`, error.message);
        workflowResults.nodeResults[node.id] = {
          nodeType: node.type,
          status: 'failed',
          error: error.message,
          timestamp: new Date().toISOString()
        };
        throw error;
      }
    };

    // Execute nodes in dependency order
    while (processedNodes.size < nodes.length) {
      const readyNodes = nodes.filter(node => 
        !processedNodes.has(node.id) && canExecuteNode(node.id)
      );

      if (readyNodes.length === 0) {
        throw new Error('Workflow has circular dependencies or no ready nodes');
      }

      // Execute ready nodes (could be done in parallel, but sequential for now)
      for (const node of readyNodes) {
        await executeNode(node);
        processedNodes.add(node.id);
      }
    }

    workflowResults.endTime = new Date().toISOString();
    workflowResults.status = 'completed';

    // If there's a markdown generator, provide download link
    const markdownNode = nodes.find(n => n.type === 'markdownGenerator');
    if (markdownNode && workflowResults.nodeResults[markdownNode.id]?.result?.content) {
      const content = workflowResults.nodeResults[markdownNode.id].result.content;
      const fileName = workflowResults.nodeResults[markdownNode.id].result.fileName || 'report.md';
      workflowResults.downloadUrl = `/api/download-report/${Buffer.from(content).toString('base64')}/${fileName}`;
    }

    console.log(`✅ Workflow execution completed successfully`);

    res.json({
      success: true,
      workflow: workflowResults
    });

  } catch (err) {
    console.error('❌ Workflow execution failed:', err.message);
    res.status(500).json({
      error: 'Workflow execution failed',
      details: err.message
    });
  }
});

// Execute complete web scraping research workflow (kept for compatibility)
app.post('/api/execute-research-workflow', async (req, res) => {
  const { query, userAddress, providerAddress, numResults = 5 } = req.body;

  if (!query || !userAddress || !providerAddress) {
    return res.status(400).json({
      error: 'Missing required parameters',
      details: 'query, userAddress, and providerAddress are required'
    });
  }

  console.log(`🔬 Executing research workflow for query: "${query}"`);

  try {
    const workflowResults = {
      query,
      startTime: new Date().toISOString(),
      steps: []
    };

    // Step 1: Google Search
    console.log('🔍 Step 1: Performing Google search...');
    const searchResponse = await fetch(`${req.protocol}://${req.get('host')}/api/google-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, numResults })
    });

    if (!searchResponse.ok) {
      throw new Error(`Google search failed: ${searchResponse.statusText}`);
    }

    const searchData = await searchResponse.json();
    workflowResults.steps.push({
      step: 1,
      name: 'Google Search',
      status: 'completed',
      data: searchData,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Found ${searchData.results?.length || 0} search results`);

    // Step 2: Web Scraping (process first few results)
    console.log('🕷️ Step 2: Scraping web pages...');
    const scrapePromises = searchData.results?.slice(0, Math.min(numResults, 3)).map(async (result, index) => {
      try {
        const scrapeResponse = await fetch(`${req.protocol}://${req.get('host')}/api/web-scraper`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url: result.link,
            extractionMode: 'text',
            includeMetadata: true,
            timeout: 20
          })
        });

        if (scrapeResponse.ok) {
          const scrapeData = await scrapeResponse.json();
          return {
            ...result,
            scrapedContent: scrapeData.data
          };
        } else {
          console.warn(`Failed to scrape ${result.link}: ${scrapeResponse.statusText}`);
          return {
            ...result,
            scrapedContent: { content: result.snippet }
          };
        }
      } catch (err) {
        console.warn(`Error scraping ${result.link}:`, err.message);
        return {
          ...result,
          scrapedContent: { content: result.snippet }
        };
      }
    }) || [];

    const scrapedResults = await Promise.all(scrapePromises);
    workflowResults.steps.push({
      step: 2,
      name: 'Web Scraping',
      status: 'completed',
      data: { results: scrapedResults },
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Scraped ${scrapedResults.length} web pages`);

    // Step 3: Data Formatting
    console.log('📝 Step 3: Formatting data for AI analysis...');
    const formatResponse = await fetch(`${req.protocol}://${req.get('host')}/api/data-formatter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: scrapedResults,
        promptTemplate: `Analyze and summarize the following research data about "${query}":

Title: {{title}}
Source: {{url}}
Content: {{content}}

Please provide:
1. Key insights and findings related to "${query}"
2. Main topics and themes covered
3. Important facts, statistics, or data points
4. Notable quotes or expert opinions
5. How this information relates to the research query

Format your response as a clear, structured analysis.`,
        formatType: 'research',
        includeMetadata: true,
        includeUrls: true,
        cleanText: true,
        maxLength: 'medium'
      })
    });

    if (!formatResponse.ok) {
      throw new Error(`Data formatting failed: ${formatResponse.statusText}`);
    }

    const formatData = await formatResponse.json();
    workflowResults.steps.push({
      step: 3,
      name: 'Data Formatting',
      status: 'completed',
      data: formatData,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Formatted ${formatData.formattedData?.length || 0} data items`);

    // Step 4: AI Analysis
    console.log('🤖 Step 4: AI analysis and summarization...');
    const combinedPrompt = `Research Query: "${query}"

Please analyze the following research data and create a comprehensive summary:

${formatData.formattedData?.join('\n\n---\n\n') || ''}

Based on this research, please provide:

1. **Executive Summary**: A brief overview of key findings about "${query}"
2. **Main Insights**: The most important discoveries and insights
3. **Key Facts & Statistics**: Important data points and statistics found
4. **Different Perspectives**: Various viewpoints or approaches mentioned
5. **Conclusions**: Your analysis and conclusions about "${query}"
6. **Recommendations**: Practical recommendations or next steps

Format your response in clear, well-structured markdown with appropriate headings and bullet points.`;

    const aiResponse = await fetch(`${req.protocol}://${req.get('host')}/api/inference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerAddress,
        prompt: combinedPrompt,
        userAddress
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI analysis failed: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    workflowResults.steps.push({
      step: 4,
      name: 'AI Analysis',
      status: 'completed',
      data: aiData,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ AI analysis completed (${aiData.response?.length || 0} characters)`);

    // Step 5: Markdown Generation
    console.log('📄 Step 5: Generating markdown report...');
    const markdownResponse = await fetch(`${req.protocol}://${req.get('host')}/api/markdown-generator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          query,
          results: scrapedResults,
          analysis: aiData.response
        },
        fileName: `research-${query.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
        includeTimestamp: true,
        includeToC: true,
        includeMetadata: true,
        templateStyle: 'professional',
        headerTemplate: `# Research Report: ${query}

**Generated on:** {{date}}  
**Research Query:** "${query}"  
**Sources Analyzed:** {{sourceCount}} websites  
**Analysis Provider:** AI-powered research assistant  

---

## Executive Summary

${aiData.response}

## Detailed Analysis

`,
        footerTemplate: `

## Sources

${scrapedResults.map((result, index) => `${index + 1}. [${result.title}](${result.link})`).join('\n')}

---

*This research report was automatically generated by Agent0G Web Research Platform*  
*Generated on: {{timestamp}}*  
*Query: "${query}"*`
      })
    });

    if (!markdownResponse.ok) {
      throw new Error(`Markdown generation failed: ${markdownResponse.statusText}`);
    }

    const markdownData = await markdownResponse.json();
    workflowResults.steps.push({
      step: 5,
      name: 'Markdown Generation',
      status: 'completed',
      data: markdownData,
      timestamp: new Date().toISOString()
    });

    workflowResults.endTime = new Date().toISOString();
    workflowResults.status = 'completed';
    workflowResults.finalReport = markdownData;

    console.log(`✅ Research workflow completed successfully for query: "${query}"`);

    res.json({
      success: true,
      workflow: workflowResults,
      downloadUrl: `/api/download-report/${Buffer.from(markdownData.content).toString('base64')}/${markdownData.fileName}`
    });

  } catch (err) {
    console.error('❌ Research workflow failed:', err.message);
    res.status(500).json({
      error: 'Research workflow failed',
      details: err.message,
      query
    });
  }
});

// Download generated report
app.get('/api/download-report/:content/:filename', (req, res) => {
  try {
    const { content, filename } = req.params;
    const decodedContent = Buffer.from(content, 'base64').toString('utf-8');
    
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(decodedContent);
  } catch (err) {
    res.status(400).json({ error: 'Invalid download request' });
  }
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res) => {
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

// ==================== SERVER INITIALIZATION ====================

async function initializeServer() {
  try {
    console.log('🚀 Initializing Agent0G server...');

    // Wait for broker to be initialized
    if (!brokerInitialized) {
      console.log('⏳ Waiting for broker initialization...');
      let attempts = 0;
      while (!brokerInitialized && attempts < 30) { // Wait up to 30 seconds
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        if (attempts % 5 === 0) {
          console.log(`Still waiting for broker... (${attempts}s)`);
        }
      }

      if (!brokerInitialized) {
        throw new Error('Broker failed to initialize within timeout');
      }
    }

    console.log('✅ Broker initialized, checking/funding compute account...');
    await ensureAccountHasFunds(broker);

    console.log('✅ Server initialized successfully');
  } catch (error) {
    console.error('❌ Server initialization failed:', error.message);
    // Don't exit process, just log the error - server can still start
  }
}

// ==================== SERVER STARTUP ====================

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  console.log('🚀 0G Unified Backend Server Started');
  console.log(`   Port: ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Service Wallet: ${serviceWallet.address}`);
  console.log(`   Flow Contract: ${FLOW_CONTRACT_ADDRESS}`);
  console.log(`   RPC URL: ${STORAGE_CONFIG.RPC_URL}`);
  console.log(`   Storage Indexer: ${STORAGE_CONFIG.INDEXER_RPC}`);
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log('   === General ===');
  console.log('   GET  /api/health');
  console.log('   POST /api/fund-account');
  console.log('   GET  /api/account-balance');
  console.log('');
  console.log('   === Compute ===');
  console.log('   GET  /api/services');
  console.log('   POST /api/acknowledge');
  console.log('   POST /api/inference');
  console.log('');
  console.log('   === Storage ===');
  console.log('   POST /api/storage/upload');
  console.log('   GET  /api/storage/download/:rootHash');
  console.log('   POST /api/storage/kv/store');
  console.log('   GET  /api/storage/kv/:streamId/:key');
  console.log('   GET  /api/storage/info/:rootHash');
  console.log('');
  console.log('   === HTTP Requests ===');
  console.log('   POST /api/http-request');
  console.log('   POST /api/google-sheets');
  console.log('');

  // Initialize server after startup
  await initializeServer();
});