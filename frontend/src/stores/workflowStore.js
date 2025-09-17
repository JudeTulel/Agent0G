import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

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
            position: { x: 700, y: 100 },
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

        // Actions
        setNodes: (nodes) => set({ nodes }),
        setEdges: (edges) => set({ edges }),
        setSelectedNode: (node) => set({ selectedNode: node }),
        setShowPropertiesSidebar: (show) => set({ showPropertiesSidebar: show }),
        setIsRunning: (running) => set({ isRunning: running }),
        setAvailableServices: (services) => set({ availableServices: services }),
        setIsLoadingServices: (loading) => set({ isLoadingServices: loading }),

        // Load available services from backend
        loadServices: async () => {
          const { setIsLoadingServices, setAvailableServices } = get();
          setIsLoadingServices(true);

          try {
            const response = await fetch('http://localhost:3001/api/services');
            if (response.ok) {
              const services = await response.json();
              setAvailableServices(services);
              console.log('✅ Loaded services:', services.length);
            } else {
              console.error('❌ Failed to load services:', response.statusText);
            }
          } catch (error) {
            console.error('❌ Error loading services:', error);
          } finally {
            setIsLoadingServices(false);
          }
        },

        // Node management
        addNode: (nodeType, nodeSubtype) => {
          const { nodes } = get();
          const newNode = {
            id: `${nodes.length + 1}`,
            type: nodeType,
            position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
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

        updateNodeData: (nodeId, newData) => {
          const { nodes } = get();
          set({
            nodes: nodes.map((node) =>
              node.id === nodeId
                ? { ...node, data: { ...node.data, ...newData } }
                : node
            )
          });
        },

        // Workflow execution
        runWorkflow: async (userAddress, providerAddress) => {
          const { nodes, setIsRunning, setNodes } = get();
          setIsRunning(true);

          try {
            // Find all executable nodes in the workflow
            const aiNodes = nodes.filter(node => node.type === 'ai');
            const httpRequestNodes = nodes.filter(node => node.type === 'httpRequest');
            const googleSheetsNodes = nodes.filter(node => node.type === 'googleSheets');
            for (const sheetsNode of googleSheetsNodes) {
              const config = sheetsNode.data;
              
              if (!config?.selectedSpreadsheet || !config?.selectedSheet) {
                console.warn(`⚠️ Skipping Google Sheets node ${sheetsNode.id}: Missing configuration`);
                continue;
              }

              console.log(`📊 Processing Google Sheets node: ${sheetsNode.data.label || 'Google Sheets'}`);
              
              try {
                const token = localStorage.getItem('google_access_token');
                if (!token) {
                  console.warn(`⚠️ Skipping Google Sheets node ${sheetsNode.id}: Not authenticated`);
                  continue;
                }

                let result = null;

                if (config.operation === 'read') {
                  // Read data from Google Sheets via backend
                  const response = await fetch('http://localhost:3001/api/google-sheets', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      operation: 'read',
                      spreadsheetId: config.selectedSpreadsheet,
                      sheetName: config.selectedSheet,
                      range: config.range,
                      accessToken: token
                    })
                  });

                  if (response.ok) {
                    result = await response.json();
                  }
                } else if (config.operation === 'write' || config.operation === 'append') {
                  // Get input data from connected nodes
                  const inputData = get().getConnectedInputData(sheetsNode.id);
                  
                  if (Object.keys(inputData).length > 0) {
                    // Prepare data for writing
                    const values = [];
                    
                    // Convert input data to sheet format
                    Object.values(inputData).forEach(data => {
                      if (data && typeof data === 'object') {
                        if (Array.isArray(data)) {
                          values.push(...data);
                        } else if (data.values) {
                          values.push(...data.values);
                        } else {
                          // Convert object to array
                          values.push(Object.values(data));
                        }
                      }
                    });

                    const response = await fetch('http://localhost:3001/api/google-sheets', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        operation: config.operation,
                        spreadsheetId: config.selectedSpreadsheet,
                        sheetName: config.selectedSheet,
                        range: config.range,
                        data: values,
                        accessToken: token
                      })
                    });

                    if (response.ok) {
                      result = await response.json();
                    }
                  }
                }

                if (result) {
                  console.log(`✅ Google Sheets node ${sheetsNode.id} completed:`, result);
                  
                  // Store node output data
                  setNodeData(sheetsNode.id, result);
                  
                  // Update node with result
                  setNodes(nodes.map((node) =>
                    node.id === sheetsNode.id
                      ? { 
                          ...node, 
                          data: { 
                            ...node.data, 
                            result: result,
                            lastExecuted: new Date().toISOString()
                          } 
                        }
                      : node
                  ));
                }
              } catch (error) {
                console.error(`❌ Error processing Google Sheets node ${sheetsNode.id}:`, error);
              }
            }

            // Process AI nodes
            for (const aiNode of aiNodes) {
              const config = aiNode.data.config;

              if (!config?.providerAddress || !config?.prompt) {
                console.warn(`⚠️ Skipping AI node ${aiNode.id}: Missing configuration`);
                continue;
              }

              console.log(`🤖 Processing AI node: ${aiNode.data.label}`);

              try {
                const response = await fetch('http://localhost:3001/api/inference', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    providerAddress: config.providerAddress,
                    prompt: config.prompt,
                    userAddress: '0x0000000000000000000000000000000000000000' // Placeholder
                  })
                });

                if (response.ok) {
                  const result = await response.json();
                  console.log(`✅ AI node ${aiNode.id} completed:`, result);

                  // Update node with result
                  setNodes(nodes.map((node) =>
                    node.id === aiNode.id
                      ? {
                          ...node,
                          data: {
                            ...node.data,
                            result: result,
                            lastExecuted: new Date().toISOString()
                          }
                        }
                      : node
                  ));
                } else {
                  const error = await response.text();
                  console.error(`❌ AI node ${aiNode.id} failed:`, error);
                }
              } catch (error) {
                console.error(`❌ Error processing AI node ${aiNode.id}:`, error);
              }
            }

            console.log('✅ Workflow execution completed');
          } catch (error) {
            console.error('❌ Workflow execution failed:', error);
            alert('Workflow execution failed');
          } finally {
            setIsRunning(false);
          }
        },

        // Workflow persistence
        saveWorkflow: async () => {
          const { nodes, edges } = get();
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
              alert(`Workflow saved successfully!\nRoot hash: ${result.rootHash}\nTX: ${result.txHash}`);
            } else {
              const errorText = await response.text();
              console.error('Failed to save workflow:', response.statusText, errorText);
              alert('Failed to save workflow to 0G Storage');
            }
          } catch (error) {
            console.error('Error saving workflow:', error);
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

        // Data flow state
        nodeData: {}, // Store data output from each node
        dataFlow: {}, // Store data flow between connected nodes

        // Data flow actions
        setNodeData: (nodeId, data) => set((state) => ({
          nodeData: { ...state.nodeData, [nodeId]: data }
        })),

        getNodeData: (nodeId) => get().nodeData[nodeId],

        // Get data from connected input nodes
        getConnectedInputData: (nodeId) => {
          const { edges, nodeData } = get();
          const inputEdges = edges.filter(edge => edge.target === nodeId);
          const inputData = {};

          inputEdges.forEach(edge => {
            const sourceData = nodeData[edge.source];
            if (sourceData) {
              inputData[edge.source] = sourceData;
            }
          });

          return inputData;
        },
      }),
      {
        name: 'workflow-storage',
        partialize: (state) => ({
          nodes: state.nodes,
          edges: state.edges
        })
      }
    ),
    {
      name: 'workflow-store'
    }
  )
);

export default useWorkflowStore;
