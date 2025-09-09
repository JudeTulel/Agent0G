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