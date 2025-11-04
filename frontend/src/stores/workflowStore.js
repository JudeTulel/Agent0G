import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { getServices as apiGetServices, inference as apiInference, buildApiUrl } from '../lib/compute';
import { registerAgent as contractRegisterAgent } from '../lib/agentRegistry';
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';

// Helper function to execute sandboxed JavaScript for logic nodes
const executeLogic = (code, inputData) => {
  return new Promise((resolve, reject) => {
    // Create a sandboxed environment using a Web Worker
    const workerCode = `
      self.onmessage = function(e) {
        const { code, inputData } = e.data;
        try {
          // User code has access to 'data' and should return a result.
          const func = new Function('data', code);
          const result = func(inputData);
          self.postMessage({ success: true, result });
        } catch (error) {
          self.postMessage({ success: false, error: error.message });
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = (e) => {
      if (e.data.success) {
        resolve(e.data.result);
      } else {
        reject(new Error(e.data.error));
      }
      worker.terminate();
    };

    worker.onerror = (e) => {
      reject(new Error(`Logic execution error: ${e.message}`));
      worker.terminate();
    };

    worker.postMessage({ code, inputData });
  });
};

// Helper function to add timeout to async operations
const withTimeout = (promise, timeoutMs, operation = 'Operation') => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

// Helper function to format execution time
const formatExecutionTime = (startTime) => {
  const elapsed = Date.now() - startTime;
  return elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(2)}s`;
};


const useWorkflowStore = create(
  devtools(
    persist(
      (set, get) => ({
        // Workflow state
        nodes: [
  {
    id: '1',
    type: 'trigger',
            position: { x: 100, y: 100 },
    data: {
      label: 'Webhook Trigger',
      type: 'webhook',
      config: {
        url: 'https://api.example.com/webhook',
        method: 'POST'
      }
    },
  },
  {
    id: '2',
    type: 'ai',
            position: { x: 400, y: 100 },
    data: {
      label: 'LLM Processing',
      type: 'llm',
      config: {
        model: 'llama-3-8b',
        prompt: 'Analyze the incoming data and extract key insights',
        temperature: 0.7
      }
    },
  },
  {
    id: '3',
    type: 'action',
    position: { x: 900, y: 300 },
    data: {
      label: 'Send Email',
      type: 'email',
      config: {
        to: 'user@example.com',
        subject: 'AI Analysis Complete',
        template: 'analysis_complete'
      }
    },
  },
        ],
        edges: [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3', animated: true },
        ],

        // UI state
        selectedNode: null,
        showPropertiesSidebar: false,
        isRunning: false,
        availableServices: [],
        isLoadingServices: false,
        reactFlowInstance: null,
        executionLogs: [],
        isLogPanelOpen: false,
        nodeRuntimeData: {},
        nodeExecutionState: {}, // Track execution state per node: 'pending', 'running', 'completed', 'error'
        lastWorkflowHash: null, // Store the most recent workflow hash from save operation
        isContractMinting: false, // Track contract minting state

        // Actions
        setNodes: (nodes) => set({ nodes }),
        setEdges: (edges) => set({ edges }),
        setReactFlowInstance: (instance) => set({ reactFlowInstance: instance }),
        
        // View control
        centerOnFirstNode: () => {
          const { nodes, reactFlowInstance } = get();
          if (nodes.length > 0 && reactFlowInstance) {
            // Find the first node (usually a trigger node)
            const firstNode = nodes[0];
            reactFlowInstance.setCenter(firstNode.position.x, firstNode.position.y, { zoom: 1, duration: 800 });
          }
        },

        onNodesChange: (changes) => {
            set({
              nodes: applyNodeChanges(changes, get().nodes),
            });
          },
          onEdgesChange: (changes) => {
            set({
              edges: applyEdgeChanges(changes, get().edges),
            });
          },
          onConnect: (connection) => {
            set({
              edges: addEdge({ ...connection, animated: true }, get().edges),
            });
          },

        setSelectedNode: (node) => set({ selectedNode: node }),
        setShowPropertiesSidebar: (show) => set({ showPropertiesSidebar: show }),
        setIsRunning: (running) => set({ isRunning: running }),
        setAvailableServices: (services) => set({ availableServices: services }),
        setIsLoadingServices: (loading) => set({ isLoadingServices: loading }),
        setExecutionLogs: (logs) => set({ executionLogs: logs }),
        addLog: (log) => set((state) => ({ executionLogs: [...state.executionLogs, { message: log, timestamp: new Date() }] })),
        clearLogs: () => set({ executionLogs: [] }),
        setIsLogPanelOpen: (isOpen) => set({ isLogPanelOpen: isOpen }),
        setNodeRuntimeData: (nodeId, data) => set(state => ({
          nodeRuntimeData: {
            ...state.nodeRuntimeData,
            [nodeId]: data,
          }
        })),
        
        // Node execution state management
        setNodeExecutionState: (nodeId, state) => set(currentState => ({
          nodeExecutionState: {
            ...currentState.nodeExecutionState,
            [nodeId]: state,
          }
        })),
        
        clearNodeExecutionStates: () => set({ nodeExecutionState: {} }),
        
        // Workflow hash management
        setLastWorkflowHash: (hash) => set({ lastWorkflowHash: hash }),
        setIsContractMinting: (minting) => set({ isContractMinting: minting }),
        
        // View control
        centerOnFirstNode: () => {
          const { nodes, reactFlowInstance } = get();
          if (nodes.length > 0 && reactFlowInstance) {
            // Find the first node (usually a trigger node)
            const firstNode = nodes[0];
            reactFlowInstance.setCenter(firstNode.position.x, firstNode.position.y, { zoom: 1, duration: 800 });
          }
        },

        // Node management
        addNode: (nodeType, nodeSubtype) => {
          const { nodes } = get();
          
          // Calculate position based on existing nodes
          let maxX = 100;
          let maxY = 100;
          
          if (nodes.length > 0) {
            maxX = Math.max(...nodes.map(n => n.position.x)) + 250;
            maxY = Math.max(...nodes.map(n => n.position.y));
          }
          
          const newNode = {
            id: `${nodes.length + 1}`,
            type: nodeType,
            position: { x: maxX, y: maxY },
            data: {
              label: `New ${nodeSubtype}`,
              type: nodeSubtype,
              config: {}
            },
          };
          set({ nodes: [...nodes, newNode] });
        },

        deleteNode: () => {
          const { selectedNode, nodes, edges } = get();
          if (selectedNode) {
            set({
              nodes: nodes.filter((node) => node.id !== selectedNode.id),
              edges: edges.filter((edge) =>
                edge.source !== selectedNode.id && edge.target !== selectedNode.id
              ),
              selectedNode: null,
              showPropertiesSidebar: false
            });
          }
        },

        // This function is used to update the data of a node in the store
        updateNodeData: (nodeId, newData) => {
          set((state) => ({
            nodes: state.nodes.map((node) =>
              node.id === nodeId
                ? { ...node, data: { ...node.data, ...newData } }
                : node
            ),
          }));
        },

        // Data flow state
        nodeData: {}, // Store data output from each node

        // Data flow actions
        setNodeData: (nodeId, data) => {
          set((state) => ({
            nodeData: { ...state.nodeData, [nodeId]: data },
            nodes: state.nodes.map((node) =>
              node.id === nodeId
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      result: data,
                      lastExecuted: new Date().toISOString(),
                    },
                  }
                : node
            ),
          }));
        },

        getNodeData: (nodeId) => get().nodeData[nodeId],

        // Get data from connected input nodes
        getConnectedInputData: (nodeId) => {
          const { edges, nodeData, nodeRuntimeData } = get();
          const inputEdges = edges.filter((edge) => edge.target === nodeId);
          const inputData = {};

          inputEdges.forEach((edge) => {
            const sourceData = nodeRuntimeData[edge.source] || nodeData[edge.source];
            if (sourceData) {
              // A simple merge, could be more sophisticated
              Object.assign(inputData, sourceData);
            }
          });

          return inputData;
        },

        // Load available AI services
        loadServices: async () => {
          const { setIsLoadingServices, setAvailableServices, addLog } = get();
          setIsLoadingServices(true);
          addLog('Fetching available AI services...');
          try {
            const services = await apiGetServices();
            setAvailableServices(services || []);
            addLog(`Found ${services?.length || 0} services.`);
          } catch (error) {
            console.error('Failed to load services:', error);
            addLog(`Error fetching services: ${error.message}`);
            setAvailableServices([]);
          } finally {
            setIsLoadingServices(false);
          }
        },

        // Workflow execution
        runWorkflow: async (startNodeId) => {
          const {
            nodes,
            edges,
            setIsRunning,
            setNodeData,
            getConnectedInputData,
            addLog,
            clearLogs,
            setIsLogPanelOpen,
            setNodeRuntimeData,
            setNodeExecutionState,
            clearNodeExecutionStates
          } = get();
          
          // Default to first trigger node or first node if startNodeId is missing
          if (!startNodeId) {
            const triggerNode = nodes.find(n => n.type === 'trigger');
            const firstNode = nodes[0];
            startNodeId = triggerNode?.id || firstNode?.id;
            
            if (!startNodeId) {
              addLog('❌ Error: No nodes found in workflow');
              return;
            }
            
            addLog(`🎯 Auto-selected start node: ${startNodeId} (${triggerNode ? 'trigger' : 'first available'})`);
          }
          
          clearLogs();
          clearNodeExecutionStates();
          setIsLogPanelOpen(true);
          
          const workflowStartTime = Date.now();
          addLog(`🚀 Workflow execution started from node ${startNodeId}`);
          addLog(`📊 Total nodes: ${nodes.length}, Total edges: ${edges.length}`);
          addLog(`⏱️  Execution started at ${new Date().toLocaleTimeString()}`);
          
          setIsRunning(true);
          set({ nodeRuntimeData: {} });

          const executionQueue = [startNodeId];
          const executedNodes = new Set();
          const nodeTimeouts = new Map(); // Track timeouts per node type

          // Configure timeouts per node type (in milliseconds)
          const TIMEOUTS = {
            'ai': 30000,        // 30s for AI inference
            'googleSheets': 15000, // 15s for Google Sheets operations
            'httpRequest': 10000,  // 10s for HTTP requests
            'logic': 5000,         // 5s for logic execution
            'default': 8000        // 8s default timeout
          };

          while (executionQueue.length > 0) {
            const currentNodeId = executionQueue.shift();
            if (executedNodes.has(currentNodeId)) continue;

            const node = nodes.find((n) => n.id === currentNodeId);
            if (!node) {
              addLog(`❌ Error: Node ${currentNodeId} not found`);
              continue;
            }
            
            const nodeStartTime = Date.now();
            const nodeLabel = node.data.label || node.id;
            const nodeType = node.type;
            
            setNodeExecutionState(currentNodeId, 'running');
            addLog(`▶️  [${currentNodeId}] Starting execution: "${nodeLabel}" (type: ${nodeType})`);
            
            const inputData = getConnectedInputData(node.id);
            if (Object.keys(inputData).length > 0) {
              addLog(`📥 [${currentNodeId}] Input data: ${JSON.stringify(inputData).substring(0, 100)}${JSON.stringify(inputData).length > 100 ? '...' : ''}`);
            } else {
              addLog(`📥 [${currentNodeId}] No input data`);
            }
            
            let outputData = null;
            const timeout = TIMEOUTS[nodeType] || TIMEOUTS.default;

            try {
              switch (node.type) {
                case 'trigger':
                  addLog(`🔔 [${currentNodeId}] Executing trigger...`);
                  if (node.data.type === 'manual') {
                    outputData = { trigger: 'manual', timestamp: new Date().toISOString() };
                    addLog(`✅ [${currentNodeId}] Manual trigger fired`);
                  }
                  break;
                
                case 'googleSheets':
                  const config = node.data;
                  const token = localStorage.getItem('google_access_token');
                  if (config.operation === 'read' && token) {
                    addLog(`📊 [${currentNodeId}] Reading from Google Sheet: ${config.selectedSheet}`);
                    
                    const spreadsheetId = config.selectedSpreadsheet;
                    const range = config.range || 'A1:Z100';
                    const sheetName = config.selectedSheet || 'Sheet1';
                    
                    const sheetsOperation = fetch(
                      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!${range}`,
                      {
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        }
                      }
                    );
                    
                    const response = await withTimeout(sheetsOperation, timeout, `Google Sheets read for node ${currentNodeId}`);
                    
                    if (response.ok) {
                      const data = await response.json();
                      outputData = {
                        operation: 'read',
                        values: data.values || [],
                        range: data.range,
                        success: true
                      };
                      addLog(`✅ [${currentNodeId}] Successfully read ${outputData?.values?.length || 0} rows from Google Sheet`);
                    } else {
                      const errorText = await response.text();
                      addLog(`❌ [${currentNodeId}] Failed to read from Google Sheet: ${response.statusText} - ${errorText}`);
                    }
                  } else {
                    addLog(`⚠️  [${currentNodeId}] Google Sheets: Missing token or invalid operation`);
                  }
                  break;

                case 'logic':
                  if (node.data.config?.type === 'transform' && node.data.config?.script) {
                    addLog(`🧠 [${currentNodeId}] Executing JavaScript logic...`);
                    const logicOperation = executeLogic(node.data.config.script, inputData);
                    const result = await withTimeout(logicOperation, timeout, `Logic execution for node ${currentNodeId}`);
                    outputData = result;
                    addLog(`✅ [${currentNodeId}] JavaScript execution completed, output type: ${typeof result}`);
                  }
                  break;

                case 'ai':
                  const aiConfig = node.data.config;
                  if (aiConfig?.providerAddress && aiConfig?.prompt) {
                    addLog(`🤖 [${currentNodeId}] Starting AI inference with provider: ${aiConfig.providerAddress}`);
                    const prompt = Object.values(inputData).reduce(
                      (p, data) => p.replace(/\{\{.*\}\}/, JSON.stringify(data)),
                      aiConfig.prompt
                    );
                    addLog(`📝 [${currentNodeId}] Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);

                    const aiOperation = apiInference(
                      aiConfig.providerAddress,
                      prompt,
                      '0x0000000000000000000000000000000000000000'
                    );
                    
                    outputData = await withTimeout(aiOperation, timeout, `AI inference for node ${currentNodeId}`);
                    addLog(`✅ [${currentNodeId}] AI inference completed successfully`);
                  } else {
                    addLog(`⚠️  [${currentNodeId}] AI node: Missing provider address or prompt`);
                  }
                  break;
                  
                default:
                  addLog(`⚠️  [${currentNodeId}] Unknown node type: ${node.type}`);
              }

              const executionTime = formatExecutionTime(nodeStartTime);
              
              if (outputData) {
                setNodeData(node.id, outputData); // For display on node
                setNodeRuntimeData(node.id, outputData); // For passing to next nodes
                addLog(`📤 [${currentNodeId}] Output generated (${executionTime}): ${JSON.stringify(outputData).substring(0, 100)}${JSON.stringify(outputData).length > 100 ? '...' : ''}`);
              } else {
                addLog(`📤 [${currentNodeId}] No output generated (${executionTime})`);
              }
              
              setNodeExecutionState(currentNodeId, 'completed');
              executedNodes.add(node.id);

              const outgoingEdges = edges.filter((e) => e.source === currentNodeId);
              if (outgoingEdges.length > 0) {
                addLog(`🔗 [${currentNodeId}] Queuing ${outgoingEdges.length} downstream node(s): ${outgoingEdges.map(e => e.target).join(', ')}`);
                outgoingEdges.forEach((edge) => {
                  if (!executedNodes.has(edge.target)) {
                    executionQueue.push(edge.target);
                    setNodeExecutionState(edge.target, 'pending');
                  }
                });
              } else {
                addLog(`🏁 [${currentNodeId}] No downstream nodes, execution path complete`);
              }

            } catch (error) {
              const executionTime = formatExecutionTime(nodeStartTime);
              setNodeExecutionState(currentNodeId, 'error');
              addLog(`❌ [${currentNodeId}] Error after ${executionTime}: ${error.message}`);
              console.error(`Error executing node ${node.id}:`, error);
              setIsRunning(false);
              return; // Stop execution on error
            }
          }

          const totalExecutionTime = formatExecutionTime(workflowStartTime);
          setIsRunning(false);
          addLog(`🎉 Workflow execution finished successfully in ${totalExecutionTime}`);
          addLog(`📈 Executed ${executedNodes.size} node(s) total`);
        },

        // Workflow persistence
        saveWorkflow: async () => {
          const { nodes, edges, addLog, setLastWorkflowHash } = get();
          addLog('Saving workflow to 0G Storage...');
          const workflow = {
            nodes,
            edges,
            metadata: {
              name: 'My Workflow',
              description: 'A sample AI agent workflow',
              version: '1.0.0',
              createdAt: new Date().toISOString()
            }
          };

          try {
            // Create a file blob from the workflow JSON
            const workflowBlob = new Blob([JSON.stringify(workflow, null, 2)], {
              type: 'application/json'
            });

            // Create FormData to send as file upload
            const formData = new FormData();
            formData.append('file', workflowBlob, `workflow-${Date.now()}.json`);

            const response = await fetch(buildApiUrl('/api/storage/upload'), {
              method: 'POST',
              body: formData
            });

            if (response.ok) {
              const result = await response.json();
              console.log('Workflow saved to 0G Storage:', result);
              const rootHash = result.file?.rootHash || result.rootHash || result.rootHashFormatted;
              
              // Store the hash for minting
              setLastWorkflowHash(rootHash);
              
              addLog(`Workflow saved! Root Hash: ${rootHash}`);
              // Return the root hash so callers (UI) can show a modal
              return rootHash;
            } else {
              const errorText = await response.text();
              console.error('Failed to save workflow:', response.statusText, errorText);
              addLog(`Failed to save workflow: ${errorText}`);
              alert('Failed to save workflow to 0G Storage');
            }
          } catch (error) {
            console.error('Error saving workflow:', error);
            addLog(`Error saving workflow: ${error.message}`);
            alert('Error saving workflow to 0G Storage');
          }
        },

        mintWorkflow: async (agentData) => {
          const { nodes, edges, lastWorkflowHash, addLog, setIsContractMinting } = get();
          
          try {
            setIsContractMinting(true);
            addLog('🔄 Starting agent minting process...');

            // Check if we have a recent workflow hash
            let workflowHash = lastWorkflowHash;
            
            if (!workflowHash) {
              addLog('📦 No recent workflow hash found, saving workflow first...');
              
              // Save workflow first to get hash
              const workflow = {
                nodes,
                edges,
                metadata: {
                  name: agentData.name || 'My Workflow',
                  description: agentData.description || 'AI agent workflow',
                  version: '1.0.0',
                  createdAt: new Date().toISOString()
                }
              };

              const workflowBlob = new Blob([JSON.stringify(workflow, null, 2)], {
                type: 'application/json'
              });

              const formData = new FormData();
              formData.append('file', workflowBlob, `workflow-${Date.now()}.json`);

              const storageResponse = await fetch(buildApiUrl('/api/storage/upload'), {
                method: 'POST',
                body: formData
              });

              if (!storageResponse.ok) {
                throw new Error('Failed to save workflow to storage');
              }

              const storageResult = await storageResponse.json();
              workflowHash = storageResult.file?.rootHash || storageResult.rootHash || storageResult.rootHashFormatted;
              
              if (!workflowHash) {
                throw new Error('Failed to get workflow hash from storage');
              }
              
              addLog(`✅ Workflow saved with hash: ${workflowHash}`);
            } else {
              addLog(`✅ Using existing workflow hash: ${workflowHash}`);
            }

            // Register agent on blockchain using the workflow hash
            addLog('🔗 Registering agent on blockchain...');
            
            const contractData = {
              name: agentData.name,
              description: agentData.description,
              category: agentData.category,
              workflowHash: workflowHash,
              pricePerUse: agentData.pricePerUse || '0',
              subscriptionPrice: agentData.subscriptionPrice || '0'
            };

            const result = await contractRegisterAgent(contractData);
            
            addLog(`🎉 Agent registered successfully!`);
            addLog(`📋 Agent ID: ${result.agentId}`);
            addLog(`📄 Transaction: ${result.txHash}`);
            
            // Show success message to user
            alert(`Agent registered successfully!\nAgent ID: ${result.agentId}\nTransaction Hash: ${result.txHash}`);
            
            return result;

          } catch (error) {
            console.error('Error minting workflow:', error);
            addLog(`❌ Minting failed: ${error.message}`);
            alert(`Failed to mint agent: ${error.message}`);
            throw error;
          } finally {
            setIsContractMinting(false);
          }
        },
      }),
      {
        name: 'workflow-storage',
        partialize: (state) => ({
          nodes: state.nodes,
          edges: state.edges,
        }),
      }
    )
  )
);

export default useWorkflowStore;
