const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');
const router = express.Router();

// Configure multer for workflow file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../workflow-uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Helper to process workflow nodes
const processWorkflowNode = async (node, broker, uploadedFiles) => {
  switch (node.type) {
    case 'trigger':
      // Handle trigger node (e.g., schedule, webhook, etc)
      return {
        ...node,
        status: 'configured'
      };

    case 'compute':
      // Handle compute/inference node
      if (!node.providerAddress) {
        throw new Error('Provider address required for compute node');
      }

      // Get provider metadata
      const { endpoint, model } = await broker.inference.getServiceMetadata(node.providerAddress);
      return {
        ...node,
        endpoint,
        model,
        status: 'ready'
      };

    case 'storage':
      // Handle storage operations
      if (node.operation === 'upload' && uploadedFiles?.[node.fileKey]) {
        const file = uploadedFiles[node.fileKey];
        return {
          ...node,
          filePath: file.path,
          fileName: file.originalname,
          status: 'uploaded'
        };
      }
      return node;

    default:
      return node;
  }
};

// Submit workflow endpoint
router.post('/submit', upload.array('files'), async (req, res) => {
  const { workflow, providerAddress } = req.body;
  const files = req.files;

  if (!workflow) {
    return res.status(400).json({
      error: 'Workflow data required'
    });
  }

  try {
    // Parse workflow JSON if needed
    const workflowData = typeof workflow === 'string' ? JSON.parse(workflow) : workflow;

    // Map uploaded files by their keys
    const uploadedFiles = {};
    if (files) {
      files.forEach(file => {
        uploadedFiles[file.fieldname] = file;
      });
    }

    // Process each node in the workflow
    const processedNodes = await Promise.all(
      workflowData.nodes.map(node => 
        processWorkflowNode(node, req.app.locals.broker, uploadedFiles)
      )
    );

// Store workflow in KV storage for tracking
const timestamp = Date.now().toString();
const workflowId = ethers.id(timestamp);
await req.app.locals.batcher.submitSetData(
  'workflows',
  Buffer.from(timestamp),
  Buffer.from(JSON.stringify({
    ...workflowData,
    id: workflowId,
    nodes: processedNodes,
    status: 'submitted',
    timestamp: Date.now()
  }))
);    res.json({
      success: true,
      workflowId,
      nodes: processedNodes,
      message: 'Workflow submitted successfully'
    });

  } catch (err) {
    console.error('Workflow submission failed:', err);
    
    // Clean up any uploaded files
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupErr) {
          console.error('Failed to clean up file:', cleanupErr);
        }
      });
    }

    res.status(500).json({
      error: 'Failed to submit workflow',
      details: err.message
    });
  }
});

// Get workflow status endpoint
router.get('/:workflowId', async (req, res) => {
  const { workflowId } = req.params;

  try {
    const kvClient = req.app.locals.kvClient;
    const value = await kvClient.getValue(
      'workflows',
      ethers.encodeBase64(Buffer.from(workflowId))
    );

    if (!value || value === '0x') {
      return res.status(404).json({
        error: 'Workflow not found',
        workflowId
      });
    }

    // Decode workflow data
    const workflowData = JSON.parse(
      Buffer.from(value.slice(2), 'hex').toString('utf-8')
    );

    res.json({
      workflowId,
      ...workflowData
    });

  } catch (err) {
    console.error('Failed to get workflow status:', err);
    res.status(500).json({
      error: 'Failed to get workflow status',
      details: err.message
    });
  }
});

module.exports = router;
