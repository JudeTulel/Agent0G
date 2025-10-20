import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { getServices as apiGetServices, inference as apiInference } from '../lib/compute';
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
            setNodeRuntimeData
          } = get();
          
          clearLogs();
          setIsLogPanelOpen(true);
          addLog(`Workflow execution started from node ${startNodeId}.`);
          setIsRunning(true);
          set({ nodeRuntimeData: {} });

          const executionQueue = [startNodeId];
          const executedNodes = new Set();

          while (executionQueue.length > 0) {
            const currentNodeId = executionQueue.shift();
            if (executedNodes.has(currentNodeId)) continue;

            const node = nodes.find((n) => n.id === currentNodeId);
            if (!node) {
              addLog(`Error: Node ${currentNodeId} not found.`);
              continue;
            }
            
            addLog(`Executing node: ${node.data.label || node.id} (Type: ${node.type})`);
            executedNodes.add(currentNodeId);

            const inputData = getConnectedInputData(node.id);
            addLog(`Node ${node.id} received input: ${JSON.stringify(inputData)}`);
            let outputData = null;

            try {
              switch (node.type) {
                case 'trigger':
                  if (node.data.type === 'manual') {
                    outputData = { trigger: 'manual', timestamp: new Date().toISOString() };
                    addLog("Manual trigger fired.");
                  }
                  break;
                
                case 'googleSheets':
                  const config = node.data;
                  const token = localStorage.getItem('google_access_token');
                  if (config.operation === 'read' && token) {
                    addLog(`Reading from Google Sheet: ${config.selectedSheet}`);
                    const response = await fetch('http://localhost:3001/api/google-sheets', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        operation: 'read',
                        spreadsheetId: config.selectedSpreadsheet,
                        sheetName: config.selectedSheet,
                        range: config.range,
                        accessToken: token,
                      }),
                    });
                    if (response.ok) {
                      outputData = await response.json();
                      addLog("Successfully read data from Google Sheet.");
                    } else {
                      addLog(`Failed to read from Google Sheet: ${response.statusText}`);
                    }
                  }
                  break;

                case 'logic':
                  if (node.data.config?.type === 'transform' && node.data.config?.script) {
                    addLog("Executing JavaScript logic...");
                    const result = await executeLogic(node.data.config.script, inputData);
                    outputData = result; // The script is expected to return the data
                    addLog(`JavaScript execution completed. Output: ${JSON.stringify(result)}`);
                  }
                  break;

                case 'ai':
                  const aiConfig = node.data.config;
                  if (aiConfig?.providerAddress && aiConfig?.prompt) {
                    addLog("Sending data to AI node for inference...");
                    const prompt = Object.values(inputData).reduce(
                      (p, data) => p.replace(/\{\{.*\}\}/, JSON.stringify(data)),
                      aiConfig.prompt
                    );

                    outputData = await apiInference(
                      aiConfig.providerAddress,
                      prompt,
                      '0x0000000000000000000000000000000000000000'
                    );
                    addLog("AI inference successful.");
                  }
                  break;
              }

              if (outputData) {
                setNodeData(node.id, outputData); // For display on node
                setNodeRuntimeData(node.id, outputData); // For passing to next nodes
              }
              executedNodes.add(node.id);

              const outgoingEdges = edges.filter((e) => e.source === currentNodeId);
              outgoingEdges.forEach((edge) => {
                if (!executedNodes.has(edge.target)) {
                  executionQueue.push(edge.target);
                }
              });

            } catch (error) {
              addLog(`Error executing node ${node.id}: ${error.message}`);
              console.error(`Error executing node ${node.id}:`, error);
              setIsRunning(false);
              return; // Stop execution on error
            }
          }

          setIsRunning(false);
          addLog('Workflow execution finished.');
        },

        // Workflow persistence
        saveWorkflow: async () => {
          const { nodes, edges, addLog } = get();
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

            const response = await fetch('http://localhost:3001/api/storage/upload', {
              method: 'POST',
              body: formData
            });

            if (response.ok) {
              const result = await response.json();
              console.log('Workflow saved to 0G Storage:', result);
              addLog(`Workflow saved! Root Hash: ${result.rootHash}`);
              alert(`Workflow saved successfully!\nRoot hash: ${result.rootHash}`);
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
          const { nodes, edges } = get();
          const workflow = {
            nodes,
            edges,
            metadata: {
              name: agentData.name,
              description: agentData.description,
              version: '1.0.0',
              createdAt: new Date().toISOString()
            }
          };

          try {
            // First save to storage to get the hash
            const workflowBlob = new Blob([JSON.stringify(workflow, null, 2)], {
              type: 'application/json'
            });

            const formData = new FormData();
            formData.append('file', workflowBlob, `workflow-${Date.now()}.json`);

            const storageResponse = await fetch('http://localhost:3001/api/storage/upload', {
              method: 'POST',
              body: formData
            });

            if (!storageResponse.ok) {
              throw new Error('Failed to save workflow to storage');
            }

            const storageResult = await storageResponse.json();
            const workflowHash = storageResult.rootHash;

            // Now register the agent on the contract
            const registerResponse = await fetch('http://localhost:3001/api/contracts/agents', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                name: agentData.name,
                description: agentData.description,
                category: agentData.category,
                workflowHash: workflowHash,
                pricePerUse: agentData.pricePerUse || 0,
                subscriptionPrice: agentData.subscriptionPrice || 0
              })
            });

            if (registerResponse.ok) {
              const result = await registerResponse.json();
              console.log('Agent registered:', result);
              alert(`Agent registered successfully!\nAgent ID: ${result.agentId}\nTX: ${result.txHash}`);
            } else {
              const errorText = await registerResponse.text();
              console.error('Failed to register agent:', registerResponse.statusText, errorText);
              alert('Failed to register agent on contract');
            }
          } catch (error) {
            console.error('Error minting workflow:', error);
            alert('Error registering agent');
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
