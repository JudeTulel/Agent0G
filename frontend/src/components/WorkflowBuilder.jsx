import { useState, useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'

// UI Components
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Wallet Integration
import { useAccount, useSignMessage } from 'wagmi'
import { InjectedConnector } from 'wagmi/connectors/injected'

// Icons
import { Play, Save, Zap, Trash2, AlertCircle, CheckCircle2, Wallet, ChevronRight, ChevronLeft } from 'lucide-react'

// Custom Nodes
import TriggerNode from './nodes/TriggerNode'
import ActionNode from './nodes/ActionNode'
import AINode from './nodes/AINode'
import LogicNode from './nodes/LogicNode'

// --- 🔧 Node Types & Default Configs ---
const NODE_DEFAULTS = {
  trigger: {
    webhook: {
      label: 'Webhook Trigger',
      config: {
        url: 'https://api.example.com/webhook',
        method: 'POST',
      },
    },
    schedule: {
      label: 'Schedule Trigger',
      config: {
        cron: '0 * * * *', // hourly
      },
    },
  },
  ai: {
    llm: {
      label: 'LLM Task',
      config: {
        provider: '',
        prompt: 'Summarize the input data.',
        model: '',
        temperature: 0.7,
        acknowledged: false,
      },
    },
  },
  action: {
    email: {
      label: 'Send Email',
      config: {
        to: '',
        subject: 'Workflow Alert',
      },
    },
    http: {
      label: 'HTTP Request',
      config: {
        url: '',
        method: 'GET',
      },
    },
  },
  logic: {
    condition: {
      label: 'Condition',
      config: {
        condition: 'input.value > 10',
      },
    },
  },
}

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  ai: AINode,
  logic: LogicNode,
}

const nodeCategories = [
  {
    category: 'Triggers',
    icon: '⚡',
    nodes: [
      { type: 'webhook', label: 'Webhook', description: 'Listen for HTTP requests' },
      { type: 'schedule', label: 'Schedule', description: 'Run on a time interval' },
    ],
  },
  {
    category: 'AI Nodes',
    icon: '🤖',
    nodes: [
      { type: 'llm', label: 'LLM', description: 'Query 0G Compute LLMs' },
    ],
  },
  {
    category: 'Actions',
    icon: '🔧',
    nodes: [
      { type: 'http', label: 'HTTP Request', description: 'Call external APIs' },
      { type: 'email', label: 'Send Email', description: 'Notify via email' },
    ],
  },
  {
    category: 'Logic',
    icon: '🧠',
    nodes: [
      { type: 'condition', label: 'Condition', description: 'Branch logic' },
    ],
  },
]

// Initial nodes use defaults
const initialNodes = [
  {
    id: '1',
    type: 'trigger',
    position: { x: 100, y: 100 },
    // FIXED: Added missing 'data:' property
    data: {
      ...NODE_DEFAULTS.trigger.webhook,
      type: 'webhook',
    },
  },
  {
    id: '2',
    type: 'ai',
    position: { x: 400, y: 100 },
    // FIXED: Added space between 'data:' and '{'
    data: {
      ...NODE_DEFAULTS.ai.llm,
      type: 'llm',
    },
  },
  {
    id: '3',
    type: 'action',
    position: { x: 700, y: 100 },
    // FIXED: Added space between 'data:' and '{'
    data: {
      ...NODE_DEFAULTS.action.email,
      type: 'email',
    },
  },
]

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3', animated: true },
]

const WorkflowBuilder = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesState] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(true)
  
  // --- 🔌 Wallet Integration ---
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  
  // --- 🌐 Backend API State ---
  const [backendConnected, setBackendConnected] = useState(false)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inferenceResult, setInferenceResult] = useState(null)

  // --- 💡 Check Backend Connection ---
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('/api/health')
        const data = await response.json()
        setBackendConnected(data.status === 'ok')
        
        if (data.status === 'ok') {
          // Load available services
          const servicesRes = await fetch('/api/services')
          const servicesData = await servicesRes.json()
          setServices(servicesData)
        }
      } catch (err) {
        setError('Cannot connect to backend API')
      }
    }
    
    checkBackend()
    
    // Set up polling to keep connection status updated
    const interval = setInterval(checkBackend, 30000)
    return () => clearInterval(interval)
  }, [])

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node)
    setInferenceResult(null)
    setDrawerOpen(true)
    if (node.type === 'ai' && node.data.config.acknowledged) {
      setInferenceResult(prev => prev)
    }
  }, [])

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  )

  // --- ➕ Add Node with Default Config ---
  const addNode = useCallback((nodeType, subtype) => {
    const defaults = NODE_DEFAULTS[nodeType]?.[subtype]
    if (!defaults) return

    const newNode = {
      id: (nodes.length + 1).toString(),
      type: nodeType,
      position: { x: Math.random() * 400 + 200, y: Math.random() * 400 + 100 },
      data: {
        label: defaults.label,
        type: subtype,
        config: { ...defaults.config },
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [nodes.length])

  const deleteNode = useCallback(() => {
    if (!selectedNode) return
    setNodes((nds) => nds.filter(n => n.id !== selectedNode.id))
    setEdges((eds) => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id))
    setSelectedNode(null)
  }, [selectedNode])

  const runWorkflow = useCallback(() => {
    setIsRunning(true)
    setTimeout(() => setIsRunning(false), 3000)
  }, [])

  const saveWorkflow = useCallback(() => {
    const workflow = {
      nodes,
      edges,
      metadata: {
        name: 'My Workflow',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
      },
    }
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'workflow.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, edges])

  // --- 🧩 Update Node Data (Generic) ---
  const updateNodeData = (fields) => {
    if (!selectedNode) return
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? {
              ...n,
              data: {
                ...n.data,
                ...fields,
              },
            }
          : n
      )
    )
  }

  // --- 🚀 Acknowledge Provider ---
  const acknowledgeProvider = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first')
      return
    }
    
    if (!selectedNode.data.config.provider) return
    setLoading(true)
    try {
      // Acknowledge provider via backend API
      const response = await fetch('/api/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          providerAddress: selectedNode.data.config.provider 
        }),
      })
      
      const data = await response.json()
      if (response.ok) {
        updateNodeData({
          config: { ...selectedNode.data.config, acknowledged: true },
        })
      } else {
        throw new Error(data.error || 'Failed to acknowledge provider')
      }
    } catch (err) {
      setError(`Ack failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // --- 🔮 Run Inference ---
  const runInference = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first')
      return
    }
    
    if (!backendConnected) {
      setError('Backend API not available')
      return
    }
    
    if (!selectedNode.data.config.provider) return
    setLoading(true)
    setError('')
    try {
      // Sign a message to prove user ownership
      const prompt = selectedNode.data.config.prompt || 'Hello'
      const message = `Requesting inference for prompt: "${prompt.substring(0, 50)}..."`
      const signature = await signMessageAsync({ message })
      
      // Send inference request to backend API
      const response = await fetch('/api/inference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          providerAddress: selectedNode.data.config.provider,
          prompt,
          userAddress: address,
          signature
        }),
      })
      
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Inference request failed')
      }
      
      // Update node config with model
      const service = services.find(s => s.provider === selectedNode.data.config.provider)
      const model = service ? service.model : data.model
      
      updateNodeData({
        config: {
          ...selectedNode.data.config,
          model,
          acknowledged: true
        }
      })
      
      setInferenceResult({
        response: data.response,
        model: model,
        valid: data.valid,
        cost: `~0.005 OG`, // This would come from your billing system
      })
    } catch (err) {
      setInferenceResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  const proOptions = { hideAttribution: true }

  return (
    <div className="h-screen flex">
      {/* Left Sidebar - Node Palette */}
      <div className="w-80 bg-card border-r overflow-y-auto">
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">Workflow Builder</h2>

          {/* Wallet */}
          <Button
            onClick={() => {
              // This would be handled by wagmi's connect functionality
            }}
            disabled={isConnected || loading}
            className="w-full mb-4"
            variant={isConnected ? 'secondary' : 'default'}
          >
            <Wallet className="h-4 w-4 mr-2" />
            {isConnected ? `Wallet Connected: ${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect Wallet'}
          </Button>
          
          {error && <p className="text-xs text-red-500 mb-4">{error}</p>}

          {/* Controls */}
          <div className="space-y-2 mb-4">
            <Button onClick={runWorkflow} disabled={isRunning} className="w-full">
              <Play className="h-4 w-4 mr-2" />
              {isRunning ? 'Running...' : 'Run Workflow'}
            </Button>
            <Button variant="outline" size="sm" onClick={saveWorkflow} className="w-full">
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>

          <Separator className="mb-4" />

          {/* Node Types */}
          {nodeCategories.map((cat) => (
            <Card key={cat.category} className="mb-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center space-x-2">
                  <span className="text-lg">{cat.icon}</span>
                  <span>{cat.category}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {cat.nodes.map((n) => (
                  <Button
                    key={n.type}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-auto p-2"
                    onClick={() => addNode(cat.category.toLowerCase().replace(' ', ''), n.type)}
                  >
                    <div className="text-left">
                      <div className="font-medium text-xs">{n.label}</div>
                      <div className="text-xs text-muted-foreground">{n.description}</div>
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Canvas Container - Now the positioning context for the drawer */}
      <div className="flex-1 relative">
        {/* Canvas */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesState}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          proOptions={proOptions}
          fitView
          className="h-full"
        >
          <Background color="#aaa" gap={16} />
          <Controls />
          <MiniMap nodeColor="#8b5cf6" />
          <Panel position="top-center">
            <Card className="bg-background/90 backdrop-blur">
              <CardContent className="p-2">
                <div className="flex items-center space-x-4">
                  <span className="font-medium flex items-center">
                    <Zap className="h-4 w-4 text-primary mr-1" />
                    AI Workflow
                  </span>
                  <Separator orientation="vertical" className="h-4" />
                  <span>{nodes.length} nodes</span>
                  {isRunning && <Badge variant="secondary">Running...</Badge>}
                </div>
              </CardContent>
            </Card>
          </Panel>
        </ReactFlow>

        {/* --- ✅ RIGHT SIDEBAR: PROPERTIES DRAWER (attached to canvas) --- */}
        <div 
          className={`absolute right-0 top-0 h-full bg-card border-l overflow-y-auto shadow-lg transition-all duration-300 z-50 ${
            drawerOpen ? 'w-80' : 'w-0 overflow-hidden'
          }`}
          style={{ 
            boxShadow: drawerOpen ? '0 0 20px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          {drawerOpen && (
            <div className="h-full">
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute -left-8 top-4 z-50 rounded-full shadow-md"
                onClick={() => setDrawerOpen(false)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {selectedNode ? (
                <div className="p-4 space-y-6 h-full">
                  {/* Title */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Node Properties</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={deleteNode}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* --- Common Fields (label, type badge) --- */}
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={selectedNode.data.label}
                      onChange={(e) => updateNodeData({ label: e.target.value })}
                    />
                  </div>

                  <div className="text-sm">
                    <Badge variant="outline">Type: {selectedNode.data.type}</Badge>
                  </div>

                  <Separator />

                  {/* --- LLM Node Config --- */}
                  {selectedNode.type === 'ai' && selectedNode.data.type === 'llm' && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label>Provider Address</Label>
                        <Input
                          placeholder="0x..."
                          value={selectedNode.data.config.provider || ''}
                          onChange={(e) =>
                            updateNodeData({
                              config: {
                                ...selectedNode.data.config,
                                provider: e.target.value.trim(),
                                acknowledged: false,
                              },
                            })
                          }
                        />
                        {selectedNode.data.config.provider &&
                          !selectedNode.data.config.acknowledged && (
                            <Button
                              size="sm"
                              className="w-full mt-2"
                              onClick={acknowledgeProvider}
                              disabled={loading || !isConnected}
                            >
                              Acknowledge Provider
                            </Button>
                          )}
                        {selectedNode.data.config.acknowledged && (
                          <Badge className="bg-green-500 text-white mt-2">
                            Acknowledged ✅
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Prompt</Label>
                        <Textarea
                          value={selectedNode.data.config.prompt || ''}
                          onChange={(e) =>
                            updateNodeData({
                              config: { ...selectedNode.data.config, prompt: e.target.value },
                            })
                          }
                          rows={4}
                        />
                      </div>

                      <Button
                        size="sm"
                        className="w-full"
                        onClick={runInference}
                        disabled={!isConnected || !selectedNode.data.config.provider || loading}
                      >
                        Run Inference
                      </Button>

                      {inferenceResult && (
                        <Card className="p-3 mt-2 bg-muted text-xs">
                          {inferenceResult.error ? (
                            <div className="text-red-500">
                              <AlertCircle className="h-4 w-4 inline mr-1" />
                              {inferenceResult.error}
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />
                                <strong>Success</strong>
                              </div>
                              <div>
                                <strong>Model:</strong> {inferenceResult.model}
                              </div>
                              <div>
                                <strong>Cost:</strong> {inferenceResult.cost}
                              </div>
                              <p className="mt-2 italic">{inferenceResult.response}</p>
                            </>
                          )}
                        </Card>
                      )}
                    </div>
                  )}

                  {/* --- Webhook Node Config --- */}
                  {selectedNode.type === 'trigger' && selectedNode.data.type === 'webhook' && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label>Endpoint URL</Label>
                        <Input
                          type="url"
                          value={selectedNode.data.config.url || ''}
                          onChange={(e) =>
                            updateNodeData({
                              config: { ...selectedNode.data.config, url: e.target.value },
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>HTTP Method</Label>
                        <Select
                          value={selectedNode.data.config.method}
                          onValueChange={(method) =>
                            updateNodeData({
                              config: { ...selectedNode.data.config, method },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground h-full flex flex-col items-center justify-center">
                  <Zap className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Select a node to edit properties</p>
                </div>
              )}
            </div>
          )}
          
          {/* Open Button (when drawer is closed) */}
          {!drawerOpen && (
            <Button
              variant="default"
              size="icon"
              className="absolute -left-10 top-1/2 -translate-y-1/2 z-50 rounded-l-none shadow-lg"
              onClick={() => setDrawerOpen(true)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
        {/* --- END PROPERTIES DRAWER --- */}
      </div>
    </div>
  )
}

export default WorkflowBuilder