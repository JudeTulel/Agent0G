require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');
const { ZgFile, Indexer, Batcher, KvClient } = require('@0glabs/0g-ts-sdk');

const app = express();

// Trim and validate all configuration URLs
const RPC_URL = (process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai').trim();
const INDEXER_RPC = (process.env.INDEXER_RPC || 'https://indexer-storage-testnet-turbo.0g.ai').trim();
const KV_NODE_URL = (process.env.KV_NODE_URL || 'http://3.101.147.150:6789').trim();
const FLOW_CONTRACT_ADDRESS = process.env.FLOW_CONTRACT_ADDRESS || '0xbD75117F80b4E22698D0Cd7612d92BDb8eaff628'; // From 0G documentation [[3]]

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Use original filename with timestamp to avoid conflicts
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Initialize providers and clients
const provider = new ethers.JsonRpcProvider(RPC_URL);
const serviceWallet = new ethers.Wallet(process.env.SERVICE_PRIVATE_KEY, provider);

// 0G Storage configuration
const STORAGE_CONFIG = {
  RPC_URL,
  INDEXER_RPC,
  KV_NODE_URL,
  FLOW_CONTRACT_ADDRESS
};

let broker;
let brokerInitialized = false;
let storageIndexer;
let storageInitialized = false;
let batcher;
let batcherInitialized = false;
let selectedNodes = [];

// Initialize 0G Compute broker
const initBroker = async () => {
  try {
    console.log('🔄 Initializing 0G Compute broker...');
    console.log('Service wallet address:', serviceWallet.address);
    
    broker = await createZGComputeNetworkBroker(serviceWallet);
    brokerInitialized = true;
    console.log('✅ Compute broker initialized successfully');
    
    const balance = await provider.getBalance(serviceWallet.address);
    console.log(`Service wallet balance: ${ethers.formatEther(balance)} ETH`);
    
    try {
      await broker.ledger.addLedger("0.01");
      console.log('✅ Service account funded');
    } catch (err) {
      console.log('ℹ️ Service account funding skipped:', err.message);
    }
    
    const services = await broker.inference.listService();
    console.log(`✅ Found ${services.length} compute services`);
    
  } catch (err) {
    console.error('❌ Failed to initialize compute broker:', err.message);
    brokerInitialized = false;
  }
};

// Initialize 0G Storage indexer
const initStorage = async () => {
  try {
    console.log('🔄 Initializing 0G Storage...');
    storageIndexer = new Indexer(STORAGE_CONFIG.INDEXER_RPC);
    storageInitialized = true;
    console.log('✅ Storage indexer initialized successfully');
  } catch (err) {
    console.error('❌ Failed to initialize storage:', err.message);
    storageInitialized = false;
  }
};

// Initialize Batcher for KV operations
const initBatcher = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔄 Initializing Batcher (attempt ${i+1}/${retries})...`);
      console.log('Using Flow contract:', FLOW_CONTRACT_ADDRESS);
      
      // Select nodes for storage (3 for redundancy)
      const [nodes, nodeErr] = await storageIndexer.selectNodes(3);
      if (nodeErr) throw new Error(`Failed to select nodes: ${nodeErr}`);
      
      selectedNodes = nodes;
      console.log(`✅ Selected ${nodes.length} storage nodes:`, nodes.map(n => n.url));
      
      // Initialize Batcher with service wallet
      batcher = new Batcher(
        1, // batch size
        nodes,
        FLOW_CONTRACT_ADDRESS,
        provider,
        serviceWallet
      );
      
      batcherInitialized = true;
      console.log('✅ Batcher initialized successfully');
      return;
    } catch (err) {
      console.error(`❌ Batcher initialization failed (attempt ${i+1}):`, err.message);
      if (i === retries - 1) {
        batcherInitialized = false;
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
};

// Initialize all services on startup
const initServices = async () => {
  try {
    await initBroker();
    await initStorage();
    
    if (storageInitialized) {
      await initBatcher().catch(err => {
        console.error('⚠️ Batcher initialization failed, KV operations may be limited:', err.message);
        batcherInitialized = false;
      });
    }
  } catch (err) {
    console.error('❌ Critical error during service initialization:', err.message);
  }
};

initServices();

// Middleware to check service status
const requireBroker = (req, res, next) => {
  if (!brokerInitialized || !broker) {
    return res.status(503).json({ 
      error: 'Compute broker not initialized'
    });
  }
  next();
};

const requireStorage = (req, res, next) => {
  if (!storageInitialized || !storageIndexer) {
    return res.status(503).json({ 
      error: 'Storage not initialized'
    });
  }
  next();
};

const requireBatcher = (req, res, next) => {
  if (!batcherInitialized || !batcher) {
    return res.status(503).json({ 
      error: 'Batcher not initialized - KV operations unavailable'
    });
  }
  next();
};

// ==================== EXISTING COMPUTE ENDPOINTS ====================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    services: {
      compute: brokerInitialized,
      storage: storageInitialized,
      batcher: batcherInitialized
    },
    serviceWallet: serviceWallet.address,
    flowContract: FLOW_CONTRACT_ADDRESS,
    timestamp: new Date().toISOString()
  });
});

// List available compute services
app.get('/api/services', requireBroker, async (req, res) => {
  try {
    console.log('📋 Listing available compute services...');
    const services = await broker.inference.listService();
    res.json(services);
  } catch (err) {
    console.error('❌ Error listing services:', err.message);
    res.status(500).json({ 
      error: 'Failed to list services', 
      details: err.message 
    });
  }
});

// Acknowledge provider
app.post('/api/acknowledge', requireBroker, async (req, res) => {
  const { providerAddress } = req.body;
  
  if (!providerAddress) {
    return res.status(400).json({ 
      error: 'Provider address required'
    });
  }

  try {
    console.log(`🤝 Acknowledging provider: ${providerAddress}`);
    await broker.inference.acknowledgeProviderSigner(providerAddress);
    res.json({ 
      success: true, 
      provider: providerAddress,
      acknowledgedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(`❌ Failed to acknowledge provider:`, err.message);
    res.status(500).json({ 
      error: 'Failed to acknowledge provider', 
      details: err.message
    });
  }
});

// Process inference request
app.post('/api/inference', requireBroker, async (req, res) => {
  const { providerAddress, prompt, userAddress } = req.body;
  
  if (!providerAddress || !prompt || !userAddress) {
    return res.status(400).json({ 
      error: 'Missing required parameters',
      details: 'providerAddress, prompt, and userAddress are all required.'
    });
  }

  console.log(`🧠 Processing inference request for ${userAddress}`);

  try {
    const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
    const headers = await broker.inference.getRequestHeaders(providerAddress, prompt);
    
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        'x-user-address': userAddress
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        model,
      }),
    });

    if (!response.ok) {
      throw new Error(`Provider API error: ${response.status}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;
    
    if (!answer) {
      throw new Error('No response content received');
    }
    
    const chatID = headers['x-chat-id'];
    const valid = await broker.inference.processResponse(providerAddress, answer, chatID);

    res.json({
      response: answer,
      model,
      valid,
      chatId: chatID,
      timestamp: new Date().toISOString(),
      provider: providerAddress,
      user: userAddress
    });

  } catch (err) {
    console.error('❌ Inference failed:', err.message);
    res.status(500).json({ 
      error: 'Inference request failed', 
      details: err.message
    });
  }
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

// ==================== ERROR HANDLING ====================

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

// ==================== SERVER STARTUP ====================

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
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
});