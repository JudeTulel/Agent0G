import { useState, useCallback, useMemo, useEffect } from 'react'
import { useAccount, useWriteContract, useChainId } from 'wagmi'
import HttpRequestNode from './nodes/HttpRequestNode';
import GoogleSheetsNode from './nodes/GoogleSheetsNode';
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

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'

import TriggerNode from './nodes/TriggerNode'
import ActionNode from './nodes/ActionNode'
import AINode from './nodes/AINode'
import LogicNode from './nodes/LogicNode'
import WorkflowSetupModal from './WorkflowSetupModal'

import useWorkflowStore from '../stores/workflowStore'
import { CONTRACT_ADDRESSES, AGENT_REGISTRY_ABI } from '../lib/blockchain'

import {
  Play,
  Save,
  Download,
  Upload,
  Settings,
  Plus,
  Trash2,
  Copy,
  X,
  RefreshCw,
  Coins,
  Zap
} from 'lucide-react'

// Define nodeTypes outside component to prevent recreation on every render
const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  ai: AINode,
  logic: LogicNode,
  httpRequest: HttpRequestNode,
  googleSheets: GoogleSheetsNode,
}

const nodeCategories = [
  {
    category: 'Triggers',
    icon: '⚡',
    color: 'bg-yellow-500',
    nodes: [
      { type: 'webhook', label: 'Webhook', description: 'HTTP webhook trigger' },
      { type: 'schedule', label: 'Schedule', description: 'Time-based trigger' },
      { type: 'event', label: 'Event', description: 'Blockchain event trigger' },
    ]
  },
  {
    category: 'AI Nodes',
    icon: '🤖',
    color: 'bg-purple-500',
    nodes: [
      { type: 'llm', label: 'LLM', description: 'Large Language Model processing' },
      { type: 'vision', label: 'Vision', description: 'Image analysis and processing' },
      { type: 'embedding', label: 'Embedding', description: 'Text embedding generation' },
    ]
  },
  {
    category: 'Actions',
    icon: '🔧',
    color: 'bg-blue-500',
    nodes: [
      { type: 'http', label: 'HTTP Request', description: 'Make HTTP API calls' },
      { type: 'googleSheets', label: 'Google Sheets', description: 'Read/write Google Sheets data' },
      { type: 'email', label: 'Send Email', description: 'Send email notifications' },
      { type: 'database', label: 'Database', description: 'Database operations' },
      { type: 'storage', label: '0G Storage', description: 'Store data on 0G Storage' },
    ]
  },
  {
    category: 'Logic',
    icon: '🧠',
    color: 'bg-green-500',
    nodes: [
      { type: 'condition', label: 'Condition', description: 'If/else logic' },
      { type: 'loop', label: 'Loop', description: 'Iterate over data' },
      { type: 'variable', label: 'Variable', description: 'Store and manipulate data' },
      { type: 'transform', label: 'Transform', description: 'Data transformation' },
    ]
  }
]

const WorkflowBuilder = () => {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { writeContract } = useWriteContract()

  // Use Zustand store for state management
  const store = useWorkflowStore()
  const {
    nodes,
    edges,
    selectedNode,
    showPropertiesSidebar,
    isRunning,
    availableServices,
    isLoadingServices,
    setNodes,
    setEdges,
    setSelectedNode,
    setShowPropertiesSidebar,
    setAvailableServices,
    setIsLoadingServices,
    addNode,
    deleteNode,
    updateNodeData,
    runWorkflow,
    loadServices
  } = store

  // Modal state
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [showMintModal, setShowMintModal] = useState(false)

  // Draft data state for node editing
  const [draftData, setDraftData] = useState(null)

  // Function to save draft changes
  const saveDraftChanges = useCallback(() => {
    if (selectedNode && draftData) {
      updateNodeData(selectedNode.id, draftData)
    }
  }, [selectedNode, draftData, updateNodeData])

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges)
  const [spreadsheets, setSpreadsheets] = useState([])
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false)

  // State for data flow sidebar
  const [selectedEdge, setSelectedEdge] = useState(null)
  const [dataFlow, setDataFlow] = useState(null)
  const [dataFormat, setDataFormat] = useState('json')

  // Function to fetch spreadsheets
  const fetchSpreadsheets = async () => {
    const accessToken = localStorage.getItem('google_access_token')
    if (!accessToken) {
      alert('Please authenticate with Google first.')
      return
    }

    setLoadingSpreadsheets(true)
    try {
      const response = await fetch(
        'https://www.googleapis.com/drive/v3/files?q=mimeType="application/vnd.google-apps.spreadsheet"&fields=files(id,name)&orderBy=name',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setSpreadsheets(data.files || [])
      } else if (response.status === 401) {
        console.error('Unauthorized: Token may be expired. Please re-authenticate.')
        localStorage.removeItem('google_access_token') // Clear invalid token
        alert('Authentication expired. Please re-authenticate with Google.')
        setSpreadsheets([])
      } else {
        console.error('Failed to fetch spreadsheets:', response.statusText)
        alert('Failed to load spreadsheets. Please try again.')
        setSpreadsheets([])
      }
    } catch (error) {
      console.error('Error fetching spreadsheets:', error)
      alert('Network error. Please check your connection and try again.')
    } finally {
      setLoadingSpreadsheets(false)
    }
  }

  // Function to mint workflow as NFT
  const mintWorkflow = async (agentData) => {
    if (!address) {
      alert('Please connect your wallet first')
      return
    }

    if (!chainId || !CONTRACT_ADDRESSES[chainId]) {
      alert('Unsupported network. Please switch to 0G chain.')
      return
    }

    try {
      const contractAddress = CONTRACT_ADDRESSES[chainId].AgentRegistry

      // Convert price to wei (assuming ETH/OG)
      const pricePerUseWei = BigInt(Math.floor(parseFloat(agentData.pricePerUse || '0') * 1e18))
      const subscriptionPriceWei = BigInt(Math.floor(parseFloat(agentData.subscriptionPrice || '0') * 1e18))

      // Create a workflow hash from the current workflow data
      const workflowData = JSON.stringify({ nodes, edges })
      const workflowHash = btoa(workflowData) // Simple base64 encoding as hash

      await writeContract({
        address: contractAddress,
        abi: AGENT_REGISTRY_ABI,
        functionName: 'registerAgent',
        args: [
          agentData.name || 'Untitled Workflow',
          agentData.description || 'No description provided',
          agentData.category || 'General',
          workflowHash,
          pricePerUseWei,
          subscriptionPriceWei
        ]
      })

      alert('Workflow minted successfully!')
      setShowMintModal(false)
    } catch (error) {
      console.error('Error minting workflow:', error)
      alert('Failed to mint workflow. Please try again.')
    }
  }

  // Function to get data flow for an edge
  const getDataFlow = (edge) => {
    const sourceNode = nodes.find(n => n.id === edge.source)
    const targetNode = nodes.find(n => n.id === edge.target)
    if (sourceNode && targetNode && sourceNode.data.result) {
      return {
        source: sourceNode.data.label || sourceNode.id,
        target: targetNode.data.label || targetNode.id,
        data: sourceNode.data.result
      }
    }
    return null
  }

  // Sync Zustand state with ReactFlow state
  useEffect(() => {
    setRfNodes(nodes)
  }, [nodes, setRfNodes])

  useEffect(() => {
    setRfEdges(edges)
  }, [edges])

  // Load services on component mount
  useEffect(() => {
    if (loadServices && typeof loadServices === 'function') {
      loadServices()
    }
  }, [loadServices])

  // Show setup modal when component mounts if no wallet or no nodes
  useEffect(() => {
    // Only show modal automatically if user is not connected OR if they have no nodes and haven't dismissed it before
    if (!isConnected || (nodes.length === 0 && !localStorage.getItem('workflow-modal-dismissed'))) {
      setShowSetupModal(true)
    }
  }, [isConnected, nodes.length])

  const onConnect = useCallback(
    (params) => {
      const newEdges = addEdge({ ...params, animated: true }, rfEdges)
      setRfEdges(newEdges)
      setEdges(newEdges)
    },
    [rfEdges, setRfEdges, setEdges]
  )

  const closePropertiesSidebar = useCallback(() => {
    setShowPropertiesSidebar(false)
    setSelectedNode(null)
  }, [])

  // Handle creating workflow from template
  const handleCreateWorkflow = useCallback((workflowData) => {
    if (workflowData.nodes && workflowData.nodes.length > 0) {
      setNodes(workflowData.nodes)
      setRfNodes(workflowData.nodes)
    }
    if (workflowData.edges && workflowData.edges.length > 0) {
      setEdges(workflowData.edges)
      setRfEdges(workflowData.edges)
    }
    setShowSetupModal(false)
    // Clear the dismissed flag since user created a workflow
    localStorage.removeItem('workflow-modal-dismissed')
  }, [setNodes, setRfNodes, setEdges, setRfEdges])

  const proOptions = {
    hideAttribution: true,
  }

  // Node Properties Sidebar Component with Draft-based Editing
  const NodePropertiesSidebar = ({ node, onClose }) => {
    // Initialize draft data synchronously with proper defaults
    const [localDraftData, setLocalDraftData] = useState(() => ({
      label: node?.data?.label || '',
      config: node?.data?.config || {},
      result: node?.data?.result,
      lastExecuted: node?.data?.lastExecuted,
      ...node?.data
    }))

    // Update local draft data when node changes
    useEffect(() => {
      if (node?.data) {
        setLocalDraftData({
          label: node.data.label || '',
          config: node.data.config || {},
          result: node.data.result,
          lastExecuted: node.data.lastExecuted,
          ...node.data
        })
      }
    }, [node])

    const handlePropertyChange = (property, value) => {
      const newData = { ...localDraftData }
      if (property.includes('.')) {
        const [parent, child] = property.split('.')
        newData[parent] = { ...newData[parent], [child]: value }
      } else {
        newData[property] = value
      }
      setLocalDraftData(newData)
      setDraftData(newData) // Update parent state
    }

    const handleSave = () => {
      updateNodeData(node.id, localDraftData)
      onClose()
    }

    const handleCancel = () => {
      setLocalDraftData({ ...node.data })
      setDraftData({ ...node.data })
      onClose()
    }

    const renderNodeProperties = () => {
      // Ensure localDraftData is available
      if (!localDraftData) {
        return <div className="p-4 text-muted-foreground">Loading...</div>
      }

      switch (node.type) {
        case 'trigger':
          return (
            <div className="space-y-4">
              <div>
                <Label htmlFor="trigger-label">Label</Label>
                <Input
                  id="trigger-label"
                  value={localDraftData.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter trigger label"
                />
              </div>
              <div>
                <Label htmlFor="trigger-url">Webhook URL</Label>
                <Input
                  id="trigger-url"
                  value={localDraftData.config?.url || ''}
                  onChange={(e) => handlePropertyChange('config.url', e.target.value)}
                  placeholder="https://api.example.com/webhook"
                />
              </div>
              <div>
                <Label htmlFor="trigger-method">HTTP Method</Label>
                <Select
                  value={localDraftData.config?.method || 'POST'}
                  onValueChange={(value) => handlePropertyChange('config.method', value)}
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
          )

        case 'ai':
          return (
            <div className="space-y-4">
              <div>
                <Label htmlFor="ai-label">Label</Label>
                <Input
                  id="ai-label"
                  value={localDraftData.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter AI node label"
                />
              </div>
              <div>
                <Label htmlFor="ai-provider">Provider</Label>
                <Select
                  value={localDraftData.config?.providerAddress || ''}
                  onValueChange={(value) => {
                    const svc = availableServices.find(s => s.providerAddress === value);
                    handlePropertyChange('config.providerAddress', value);
                    if (svc?.model) handlePropertyChange('config.model', svc.model);
                  }}
                  disabled={isLoadingServices}
                >
                  <SelectTrigger className="bg-card text-foreground">
                    <SelectValue placeholder={isLoadingServices ? "Loading providers..." : "Select model/provider"} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-foreground">
                    {availableServices.map((service) => {
                      const short = service.providerAddress
                        ? `${service.providerAddress.slice(0, 6)}...${service.providerAddress.slice(-4)}`
                        : 'unknown';
                      const label = service.model ? `${service.model} (${short})` : short;
                      return (
                        <SelectItem key={service.providerAddress} value={service.providerAddress} className="text-foreground">
                          {label}
                        </SelectItem>
                      );
                    })}
                    {availableServices.length === 0 && !isLoadingServices && (
                      <SelectItem value="" disabled className="text-foreground">
                        No providers available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    loadServices();
                  }}
                  className="mt-2 w-full"
                >
                  Refresh Services
                </Button>
              </div>
              <div>
                <Label htmlFor="ai-prompt">Prompt</Label>
                <Textarea
                  id="ai-prompt"
                  value={localDraftData.config?.prompt || ''}
                  onChange={(e) => handlePropertyChange('config.prompt', e.target.value)}
                  placeholder="Enter your AI prompt here..."
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
              {localDraftData.result && (
                <>
                  <Separator />
                  <div>
                    <Label>Last Execution Result</Label>
                    <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                      <div className="font-medium mb-1">Response:</div>
                      <div className="text-muted-foreground">
                        {localDraftData.result.answer || 'No response'}
                      </div>
                      {localDraftData.lastExecuted && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Executed: {new Date(localDraftData.lastExecuted).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )

        case 'action':
          return (
            <div className="space-y-4">
              <div>
                <Label htmlFor="action-label">Label</Label>
                <Input
                  id="action-label"
                  value={localDraftData.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter action label"
                />
              </div>
              <div>
                <Label htmlFor="action-type">Action Type</Label>
                <Select
                  value={localDraftData.config?.type || ''}
                  onValueChange={(value) => handlePropertyChange('config.type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select action type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP Request</SelectItem>
                    <SelectItem value="email">Send Email</SelectItem>
                    <SelectItem value="database">Database</SelectItem>
                    <SelectItem value="storage">0G Storage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {localDraftData.config?.type === 'http' && (
                <>
                  <div>
                    <Label htmlFor="http-url">URL</Label>
                    <Input
                      id="http-url"
                      value={localDraftData.config?.url || ''}
                      onChange={(e) => handlePropertyChange('config.url', e.target.value)}
                      placeholder="https://api.example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="http-method">Method</Label>
                    <Select
                      value={localDraftData.config?.method || 'GET'}
                      onValueChange={(value) => handlePropertyChange('config.method', value)}
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
                  <div>
                    <Label htmlFor="http-headers">Headers</Label>
                    <Textarea
                      id="http-headers"
                      value={localDraftData.config?.headers ? JSON.stringify(localDraftData.config.headers, null, 2) : ''}
                      onChange={(e) => {
                        try {
                          const headers = JSON.parse(e.target.value);
                          handlePropertyChange('config.headers', headers);
                        } catch (err) {
                          // Invalid JSON, don't update
                        }
                      }}
                      placeholder='{"Content-Type": "application/json"}'
                      rows={3}
                    />
                  </div>
                  {(localDraftData.config?.method === 'POST' || localDraftData.config?.method === 'PUT') && (
                    <div>
                      <Label htmlFor="http-body">Request Body</Label>
                      <Textarea
                        id="http-body"
                        value={localDraftData.config?.body || ''}
                        onChange={(e) => handlePropertyChange('config.body', e.target.value)}
                        placeholder="JSON or text body"
                        rows={4}
                      />
                    </div>
                  )}
                </>
              )}
              {localDraftData.config?.type === 'email' && (
                <>
                  <div>
                    <Label htmlFor="email-to">To</Label>
                    <Input
                      id="email-to"
                      value={localDraftData.config?.to || ''}
                      onChange={(e) => handlePropertyChange('config.to', e.target.value)}
                      placeholder="recipient@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-subject">Subject</Label>
                    <Input
                      id="email-subject"
                      value={localDraftData.config?.subject || ''}
                      onChange={(e) => handlePropertyChange('config.subject', e.target.value)}
                      placeholder="Email subject"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-body">Body</Label>
                    <Textarea
                      id="email-body"
                      value={localDraftData.config?.body || ''}
                      onChange={(e) => handlePropertyChange('config.body', e.target.value)}
                      placeholder="Email body content"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-template">Template</Label>
                    <Select
                      value={localDraftData.config?.template || 'plain'}
                      onValueChange={(value) => handlePropertyChange('config.template', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="plain">Plain Text</SelectItem>
                        <SelectItem value="html">HTML</SelectItem>
                        <SelectItem value="template">Template</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {localDraftData.config?.type === 'database' && (
                <>
                  <div>
                    <Label htmlFor="db-operation">Operation</Label>
                    <Select
                      value={localDraftData.config?.operation || 'select'}
                      onValueChange={(value) => handlePropertyChange('config.operation', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="select">SELECT</SelectItem>
                        <SelectItem value="insert">INSERT</SelectItem>
                        <SelectItem value="update">UPDATE</SelectItem>
                        <SelectItem value="delete">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="db-query">Query</Label>
                    <Textarea
                      id="db-query"
                      value={localDraftData.config?.query || ''}
                      onChange={(e) => handlePropertyChange('config.query', e.target.value)}
                      placeholder="SELECT * FROM table WHERE..."
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="db-connection">Connection String</Label>
                    <Input
                      id="db-connection"
                      type="password"
                      value={localDraftData.config?.connection || ''}
                      onChange={(e) => handlePropertyChange('config.connection', e.target.value)}
                      placeholder="Database connection string"
                    />
                  </div>
                </>
              )}
              {localDraftData.config?.type === 'storage' && (
                <>
                  <div>
                    <Label htmlFor="storage-operation">Operation</Label>
                    <Select
                      value={localDraftData.config?.operation || 'upload'}
                      onValueChange={(value) => handlePropertyChange('config.operation', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upload">Upload File</SelectItem>
                        <SelectItem value="download">Download File</SelectItem>
                        <SelectItem value="list">List Files</SelectItem>
                        <SelectItem value="delete">Delete File</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="storage-path">File Path</Label>
                    <Input
                      id="storage-path"
                      value={localDraftData.config?.path || ''}
                      onChange={(e) => handlePropertyChange('config.path', e.target.value)}
                      placeholder="/path/to/file.txt"
                    />
                  </div>
                  <div>
                    <Label htmlFor="storage-bucket">Bucket/Container</Label>
                    <Input
                      id="storage-bucket"
                      value={localDraftData.config?.bucket || ''}
                      onChange={(e) => handlePropertyChange('config.bucket', e.target.value)}
                      placeholder="my-bucket"
                    />
                  </div>
                </>
              )}
            </div>
          )

        case 'logic':
          return (
            <div className="space-y-4">
              <div>
                <Label htmlFor="logic-label">Label</Label>
                <Input
                  id="logic-label"
                  value={localDraftData.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter logic node label"
                />
              </div>
              <div>
                <Label htmlFor="logic-type">Logic Type</Label>
                <Select
                  value={localDraftData.config?.type || ''}
                  onValueChange={(value) => handlePropertyChange('config.type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select logic type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="condition">Condition</SelectItem>
                    <SelectItem value="loop">Loop</SelectItem>
                    <SelectItem value="variable">Variable</SelectItem>
                    <SelectItem value="transform">Transform</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {localDraftData.config?.type === 'condition' && (
                <div>
                  <Label htmlFor="condition-expression">Condition Expression</Label>
                  <Textarea
                    id="condition-expression"
                    value={localDraftData.config?.expression || ''}
                    onChange={(e) => handlePropertyChange('config.expression', e.target.value)}
                    placeholder="e.g., data.status === 'success'"
                    rows={3}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Use JavaScript syntax. Access input data with 'data' variable.
                  </div>
                </div>
              )}
              {localDraftData.config?.type === 'loop' && (
                <>
                  <div>
                    <Label htmlFor="loop-array">Array Expression</Label>
                    <Input
                      id="loop-array"
                      value={localDraftData.config?.arrayExpression || ''}
                      onChange={(e) => handlePropertyChange('config.arrayExpression', e.target.value)}
                      placeholder="data.items"
                    />
                  </div>
                  <div>
                    <Label htmlFor="loop-variable">Loop Variable</Label>
                    <Input
                      id="loop-variable"
                      value={localDraftData.config?.loopVariable || 'item'}
                      onChange={(e) => handlePropertyChange('config.loopVariable', e.target.value)}
                      placeholder="item"
                    />
                  </div>
                  <div>
                    <Label htmlFor="loop-condition">Loop Condition (Optional)</Label>
                    <Input
                      id="loop-condition"
                      value={localDraftData.config?.condition || ''}
                      onChange={(e) => handlePropertyChange('config.condition', e.target.value)}
                      placeholder="item.active === true"
                    />
                  </div>
                </>
              )}
              {localDraftData.config?.type === 'variable' && (
                <>
                  <div>
                    <Label htmlFor="variable-name">Variable Name</Label>
                    <Input
                      id="variable-name"
                      value={localDraftData.config?.variableName || ''}
                      onChange={(e) => handlePropertyChange('config.variableName', e.target.value)}
                      placeholder="myVariable"
                    />
                  </div>
                  <div>
                    <Label htmlFor="variable-value">Variable Value</Label>
                    <Textarea
                      id="variable-value"
                      value={localDraftData.config?.variableValue || ''}
                      onChange={(e) => handlePropertyChange('config.variableValue', e.target.value)}
                      placeholder="data.result"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="variable-scope">Scope</Label>
                    <Select
                      value={localDraftData.config?.scope || 'workflow'}
                      onValueChange={(value) => handlePropertyChange('config.scope', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="workflow">Workflow</SelectItem>
                        <SelectItem value="global">Global</SelectItem>
                        <SelectItem value="node">Node Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {localDraftData.config?.type === 'transform' && (
                <>
                  <div>
                    <Label htmlFor="transform-input">Input Data</Label>
                    <Textarea
                      id="transform-input"
                      value={localDraftData.config?.inputData || ''}
                      onChange={(e) => handlePropertyChange('config.inputData', e.target.value)}
                      placeholder="data"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="transform-code">Transform Code</Label>
                    <Textarea
                      id="transform-code"
                      value={localDraftData.config?.transformCode || ''}
                      onChange={(e) => handlePropertyChange('config.transformCode', e.target.value)}
                      placeholder="return data.map(item => ({ ...item, processed: true }))"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="transform-output">Output Variable</Label>
                    <Input
                      id="transform-output"
                      value={localDraftData.config?.outputVariable || 'transformedData'}
                      onChange={(e) => handlePropertyChange('config.outputVariable', e.target.value)}
                      placeholder="transformedData"
                    />
                  </div>
                </>
              )}
            </div>
          )

        case 'httpRequest':
          return (
            <div className="space-y-4">
              <div>
                <Label htmlFor="http-label">Label</Label>
                <Input
                  id="http-label"
                  value={localDraftData.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter HTTP request label"
                />
              </div>
              <div>
                <Label htmlFor="http-url">URL</Label>
                <Input
                  id="http-url"
                  value={localDraftData.config?.url || ''}
                  onChange={(e) => handlePropertyChange('config.url', e.target.value)}
                  placeholder="https://api.example.com"
                />
              </div>
              <div>
                <Label htmlFor="http-method">HTTP Method</Label>
                <Select
                  value={localDraftData.config?.method || 'GET'}
                  onValueChange={(value) => handlePropertyChange('config.method', value)}
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
              <div>
                <Label htmlFor="http-body">Request Body</Label>
                <Textarea
                  id="http-body"
                  value={localDraftData.config?.body || ''}
                  onChange={(e) => handlePropertyChange('config.body', e.target.value)}
                  placeholder="JSON or text body"
                  rows={4}
                />
              </div>
            </div>
          )

        case 'googleSheets':
          const isAuthenticated = !!localStorage.getItem('google_access_token')

          return (
            <div className="space-y-4">
              <div>
                <Label htmlFor="sheets-label">Label</Label>
                <Input
                  id="sheets-label"
                  value={localDraftData.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter Google Sheets label"
                />
              </div>

              <div>
                <Label>Authentication Status</Label>
                <div className="mt-2">
                  {isAuthenticated ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      ✓ Connected to Google
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-red-100 text-red-800">
                      ✗ Not Connected
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="sheets-spreadsheet">Spreadsheet</Label>
                <Select
                  value={localDraftData.selectedSpreadsheet || ''}
                  onValueChange={(value) => {
                    handlePropertyChange('selectedSpreadsheet', value)
                    // Optionally fetch sheet names here if needed
                  }}
                  onOpenChange={(open) => {
                    if (open && isAuthenticated && spreadsheets.length === 0 && !loadingSpreadsheets) {
                      fetchSpreadsheets()
                    }
                  }}
                  disabled={!isAuthenticated || loadingSpreadsheets}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !isAuthenticated
                        ? "Authenticate to load spreadsheets"
                        : loadingSpreadsheets
                          ? "Loading spreadsheets..."
                          : spreadsheets.length > 0
                            ? "Select spreadsheet"
                            : "No spreadsheets found"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {spreadsheets.map((sheet) => (
                      <SelectItem key={sheet.id} value={sheet.id}>
                        {sheet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground mt-1">
                  Or enter ID manually below if not listed
                </div>
              </div>

              <div>
                <Label htmlFor="sheets-spreadsheet-id">Spreadsheet ID (Manual)</Label>
                <Input
                  id="sheets-spreadsheet-id"
                  value={localDraftData.selectedSpreadsheet || ''}
                  onChange={(e) => handlePropertyChange('selectedSpreadsheet', e.target.value)}
                  placeholder="Enter spreadsheet ID"
                />
              </div>

              <div>
                <Label htmlFor="sheets-sheet">Sheet Name</Label>
                <Input
                  id="sheets-sheet"
                  value={localDraftData.selectedSheet || ''}
                  onChange={(e) => handlePropertyChange('selectedSheet', e.target.value)}
                  placeholder="Sheet1"
                />
              </div>

              <div>
                <Label htmlFor="sheets-range">Range</Label>
                <Input
                  id="sheets-range"
                  value={localDraftData.range || 'A1:Z100'}
                  onChange={(e) => handlePropertyChange('range', e.target.value)}
                  placeholder="A1:Z100"
                />
              </div>

              <div>
                <Label htmlFor="sheets-operation">Operation</Label>
                <Select
                  value={localDraftData.operation || 'read'}
                  onValueChange={(value) => handlePropertyChange('operation', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Read Data</SelectItem>
                    <SelectItem value="write">Write Data</SelectItem>
                    <SelectItem value="append">Append Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {localDraftData.result && (
                <>
                  <Separator />
                  <div>
                    <Label>Last Execution Result</Label>
                    <div className="mt-2 p-3 bg-muted rounded-md text-sm max-h-64 overflow-y-auto">
                      <div className="font-medium mb-1">Operation: {localDraftData.result.operation}</div>
                      {localDraftData.result.values && (
                        <div className="text-muted-foreground">
                          Rows: {localDraftData.result.values.length}
                        </div>
                      )}
                      {localDraftData.result.success !== undefined && (
                        <div className="text-muted-foreground">
                          Success: {localDraftData.result.success ? 'Yes' : 'No'}
                        </div>
                      )}
                      {localDraftData.lastExecuted && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Executed: {new Date(localDraftData.lastExecuted).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )

        case 'llm':
          return (
            <div className="space-y-4">
              <div>
                <Label htmlFor="llm-label">Label</Label>
                <Input
                  id="llm-label"
                  value={localDraftData.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter LLM node label"
                />
              </div>

              <div>
                <Label htmlFor="llm-model">AI Model</Label>
                <Select
                  value={localDraftData.config?.model || 'gpt-4'}
                  onValueChange={(value) => handlePropertyChange('config.model', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="claude-3">Claude 3</SelectItem>
                    <SelectItem value="llama-2">Llama 2</SelectItem>
                    <SelectItem value="custom">Custom Model</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {localDraftData.config?.model === 'custom' && (
                <div>
                  <Label htmlFor="custom-model-endpoint">Custom Model Endpoint</Label>
                  <Input
                    id="custom-model-endpoint"
                    value={localDraftData.config?.customEndpoint || ''}
                    onChange={(e) => handlePropertyChange('config.customEndpoint', e.target.value)}
                    placeholder="https://api.custom-model.com/v1/chat"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="llm-prompt">Prompt Template</Label>
                <Textarea
                  id="llm-prompt"
                  value={localDraftData.config?.prompt || ''}
                  onChange={(e) => handlePropertyChange('config.prompt', e.target.value)}
                  placeholder="Enter your AI prompt here. Use {{variable}} for dynamic content."
                  rows={6}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Use {{variable}} syntax to insert data from connected nodes.
                </div>
              </div>

              <div>
                <Label htmlFor="llm-temperature">Temperature</Label>
                <Slider
                  value={[localDraftData.config?.temperature || 0.7]}
                  onValueChange={(value) => handlePropertyChange('config.temperature', value[0])}
                  max={2}
                  min={0}
                  step={0.1}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Controls randomness: 0 = deterministic, 2 = very creative
                </div>
              </div>

              <div>
                <Label htmlFor="llm-max-tokens">Max Tokens</Label>
                <Input
                  id="llm-max-tokens"
                  type="number"
                  value={localDraftData.config?.maxTokens || 1000}
                  onChange={(e) => handlePropertyChange('config.maxTokens', parseInt(e.target.value))}
                  min={1}
                  max={4000}
                />
              </div>

              <div>
                <Label htmlFor="llm-system-message">System Message</Label>
                <Textarea
                  id="llm-system-message"
                  value={localDraftData.config?.systemMessage || ''}
                  onChange={(e) => handlePropertyChange('config.systemMessage', e.target.value)}
                  placeholder="You are a helpful assistant..."
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="llm-stream"
                  checked={localDraftData.config?.stream || false}
                  onCheckedChange={(checked) => handlePropertyChange('config.stream', checked)}
                />
                <Label htmlFor="llm-stream">Stream Response</Label>
              </div>

              <div>
                <Label htmlFor="llm-output-format">Output Format</Label>
                <Select
                  value={localDraftData.config?.outputFormat || 'text'}
                  onValueChange={(value) => handlePropertyChange('config.outputFormat', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Plain Text</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {localDraftData.result && (
                <>
                  <Separator />
                  <div>
                    <Label>Last Execution Result</Label>
                    <div className="mt-2 p-3 bg-muted rounded-md text-sm max-h-64 overflow-y-auto">
                      <div className="font-medium mb-1">Model: {localDraftData.config?.model}</div>
                      <div className="text-muted-foreground">
                        {localDraftData.result.response || 'No response data'}
                      </div>
                      {localDraftData.lastExecuted && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Executed: {new Date(localDraftData.lastExecuted).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )

        case 'vision':
          return (
            <div className="space-y-4">
              <div>
                <Label htmlFor="vision-label">Label</Label>
                <Input
                  id="vision-label"
                  value={localDraftData.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter vision node label"
                />
              </div>

              <div>
                <Label htmlFor="vision-model">Vision Model</Label>
                <Select
                  value={localDraftData.config?.model || 'gpt-4-vision'}
                  onValueChange={(value) => handlePropertyChange('config.model', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4-vision">GPT-4 Vision</SelectItem>
                    <SelectItem value="claude-3-vision">Claude 3 Vision</SelectItem>
                    <SelectItem value="custom">Custom Vision Model</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {localDraftData.config?.model === 'custom' && (
                <div>
                  <Label htmlFor="custom-vision-endpoint">Custom Vision Endpoint</Label>
                  <Input
                    id="custom-vision-endpoint"
                    value={localDraftData.config?.customEndpoint || ''}
                    onChange={(e) => handlePropertyChange('config.customEndpoint', e.target.value)}
                    placeholder="https://api.custom-vision.com/v1/analyze"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="vision-prompt">Analysis Prompt</Label>
                <Textarea
                  id="vision-prompt"
                  value={localDraftData.config?.prompt || ''}
                  onChange={(e) => handlePropertyChange('config.prompt', e.target.value)}
                  placeholder="Describe what you want to analyze in the image..."
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="vision-image-source">Image Source</Label>
                <Select
                  value={localDraftData.config?.imageSource || 'url'}
                  onValueChange={(value) => handlePropertyChange('config.imageSource', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url">Image URL</SelectItem>
                    <SelectItem value="upload">File Upload</SelectItem>
                    <SelectItem value="data">From Previous Node</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {localDraftData.config?.imageSource === 'url' && (
                <div>
                  <Label htmlFor="vision-image-url">Image URL</Label>
                  <Input
                    id="vision-image-url"
                    value={localDraftData.config?.imageUrl || ''}
                    onChange={(e) => handlePropertyChange('config.imageUrl', e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="vision-output-format">Output Format</Label>
                <Select
                  value={localDraftData.config?.outputFormat || 'text'}
                  onValueChange={(value) => handlePropertyChange('config.outputFormat', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text Description</SelectItem>
                    <SelectItem value="json">Structured JSON</SelectItem>
                    <SelectItem value="labels">Object Labels</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {localDraftData.result && (
                <>
                  <Separator />
                  <div>
                    <Label>Last Execution Result</Label>
                    <div className="mt-2 p-3 bg-muted rounded-md text-sm max-h-64 overflow-y-auto">
                      <div className="font-medium mb-1">Analysis Complete</div>
                      <div className="text-muted-foreground">
                        {localDraftData.result.analysis || 'No analysis data'}
                      </div>
                      {localDraftData.lastExecuted && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Executed: {new Date(localDraftData.lastExecuted).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )

        case 'embedding':
          return (
            <div className="space-y-4">
              <div>
                <Label htmlFor="embedding-label">Label</Label>
                <Input
                  id="embedding-label"
                  value={localDraftData.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter embedding node label"
                />
              </div>

              <div>
                <Label htmlFor="embedding-model">Embedding Model</Label>
                <Select
                  value={localDraftData.config?.model || 'text-embedding-ada-002'}
                  onValueChange={(value) => handlePropertyChange('config.model', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text-embedding-ada-002">OpenAI Ada-002</SelectItem>
                    <SelectItem value="text-embedding-3-small">OpenAI Embedding 3 Small</SelectItem>
                    <SelectItem value="text-embedding-3-large">OpenAI Embedding 3 Large</SelectItem>
                    <SelectItem value="custom">Custom Embedding Model</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {localDraftData.config?.model === 'custom' && (
                <div>
                  <Label htmlFor="custom-embedding-endpoint">Custom Embedding Endpoint</Label>
                  <Input
                    id="custom-embedding-endpoint"
                    value={localDraftData.config?.customEndpoint || ''}
                    onChange={(e) => handlePropertyChange('config.customEndpoint', e.target.value)}
                    placeholder="https://api.custom-embedding.com/v1/embed"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="embedding-input">Input Text</Label>
                <Textarea
                  id="embedding-input"
                  value={localDraftData.config?.inputText || ''}
                  onChange={(e) => handlePropertyChange('config.inputText', e.target.value)}
                  placeholder="Text to convert to embeddings..."
                  rows={4}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Use {{variable}} syntax to insert data from connected nodes.
                </div>
              </div>

              <div>
                <Label htmlFor="embedding-operation">Operation</Label>
                <Select
                  value={localDraftData.config?.operation || 'embed'}
                  onValueChange={(value) => handlePropertyChange('config.operation', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="embed">Generate Embeddings</SelectItem>
                    <SelectItem value="similarity">Calculate Similarity</SelectItem>
                    <SelectItem value="cluster">Cluster Analysis</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {localDraftData.config?.operation === 'similarity' && (
                <>
                  <div>
                    <Label htmlFor="embedding-compare-text">Compare With Text</Label>
                    <Textarea
                      id="embedding-compare-text"
                      value={localDraftData.config?.compareText || ''}
                      onChange={(e) => handlePropertyChange('config.compareText', e.target.value)}
                      placeholder="Text to compare similarity with..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="embedding-similarity-metric">Similarity Metric</Label>
                    <Select
                      value={localDraftData.config?.similarityMetric || 'cosine'}
                      onValueChange={(value) => handlePropertyChange('config.similarityMetric', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cosine">Cosine Similarity</SelectItem>
                        <SelectItem value="euclidean">Euclidean Distance</SelectItem>
                        <SelectItem value="manhattan">Manhattan Distance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="embedding-output-variable">Output Variable Name</Label>
                <Input
                  id="embedding-output-variable"
                  value={localDraftData.config?.outputVariable || 'embeddings'}
                  onChange={(e) => handlePropertyChange('config.outputVariable', e.target.value)}
                  placeholder="embeddings"
                />
              </div>

              {localDraftData.result && (
                <>
                  <Separator />
                  <div>
                    <Label>Last Execution Result</Label>
                    <div className="mt-2 p-3 bg-muted rounded-md text-sm max-h-64 overflow-y-auto">
                      <div className="font-medium mb-1">Operation: {localDraftData.config?.operation}</div>
                      {localDraftData.result.dimensions && (
                        <div className="text-muted-foreground">
                          Dimensions: {localDraftData.result.dimensions}
                        </div>
                      )}
                      {localDraftData.result.similarity !== undefined && (
                        <div className="text-muted-foreground">
                          Similarity: {localDraftData.result.similarity.toFixed(4)}
                        </div>
                      )}
                      {localDraftData.lastExecuted && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Executed: {new Date(localDraftData.lastExecuted).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )

        default:
          return (
            <div className="space-y-4">
              <div>
                <Label htmlFor="default-label">Label</Label>
                <Input
                  id="default-label"
                  value={localDraftData.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter node label"
                />
              </div>
            </div>
          )
      }
    }

    return (
      <div className="w-80 bg-card border-l flex flex-col h-full min-h-0 overflow-hidden">
        <div className="p-4 border-b bg-card/95 backdrop-blur sticky top-0 z-10 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Node Properties</h3>
            <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-destructive/10">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Node Info Cards */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</span>
              <Badge variant="secondary" className="text-xs">
                {node.type}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ID</span>
              <code className="text-xs bg-background px-2 py-1 rounded font-mono border">
                {node.id}
              </code>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto min-h-0 pb-8">
          <div className="p-4 space-y-6">
            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteNode}
                className="w-full justify-start"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Node
              </Button>
            </div>

            <Separator />

            {/* Node Properties */}
            <div className="space-y-4">
              {renderNodeProperties()}
            </div>
          </div>
        </div>

        {/* Save/Cancel Footer */}
        <div className="p-4 border-t bg-card/95 backdrop-blur">
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </div>
    )
  }

  // Data Flow Sidebar Component
  const DataFlowSidebar = ({ edge, onClose }) => {
    const dataFlow = getDataFlow(edge)

    return (
      <div className="w-80 bg-card border-l flex flex-col h-full min-h-0 overflow-hidden">
        {/* Fixed Header */}
        <div className="p-4 border-b bg-card/95 backdrop-blur sticky top-0 z-10 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Data Flow</h3>
            <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-destructive/10">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Edge Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">From</span>
              <Badge variant="secondary" className="text-xs">
                {dataFlow?.source || edge.source}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To</span>
              <Badge variant="secondary" className="text-xs">
                {dataFlow?.target || edge.target}
              </Badge>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto min-h-0 pb-8">
          <div className="p-4 space-y-6">
            {/* Data Format Toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Data Format</Label>
              <Select value={dataFormat} onValueChange={setDataFormat}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="table">Table</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Data Display */}
            <div className="space-y-4">
              {dataFlow ? (
                dataFormat === 'json' ? (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Data Flow (JSON)</Label>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-96 overflow-y-auto">
                      {JSON.stringify(dataFlow, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Data Flow (Table)</Label>
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left font-medium">Property</th>
                            <th className="p-2 text-left font-medium">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(dataFlow).map(([key, value]) => (
                            <tr key={key} className="border-t">
                              <td className="p-2 font-medium">{key}</td>
                              <td className="p-2 text-muted-foreground">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No data flow available</p>
                  <p className="text-xs mt-1">Execute the source node to see data flow</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex">
      {/* Left Sidebar */}
      <div className="w-80 bg-card border-r overflow-y-auto">
        <div className="p-4">
          {/* Controls */}
          <div className="space-y-2 mb-6">
            <Button
              onClick={() => setShowSetupModal(true)}
              className="w-full"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Workflow
            </Button>

            <Button
              onClick={runWorkflow}
              disabled={isRunning || !isConnected}
              className="w-full"
              variant={isRunning ? "secondary" : "default"}
            >
              <Play className="h-4 w-4 mr-2" />
              {isRunning ? 'Running...' : !isConnected ? 'Connect Wallet to Run' : 'Run Workflow'}
            </Button>

            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={() => {}}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowMintModal(true)}>
                <Coins className="h-4 w-4 mr-1" />
                Mint Agent
              </Button>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-1" />
                Load
              </Button>
            </div>
          </div>

          <Separator className="mb-4" />

          {/* Node Categories */}
          <div className="space-y-4">
            {nodeCategories.map((category) => (
              <Card key={category.category}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <span className="text-lg">{category.icon}</span>
                    <span>{category.category}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {category.nodes.map((node) => (
                      <Button
                        key={node.type}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-auto p-2"
                        onClick={() => {
                          let nodeType = 'action';
                          if (category.category === 'Triggers') nodeType = 'trigger';
                          else if (category.category === 'AI Nodes') nodeType = 'ai';
                          else if (category.category === 'Logic Nodes') nodeType = 'logic';
                          else if (node.type === 'http') nodeType = 'httpRequest';
                          else if (node.type === 'googleSheets') nodeType = 'googleSheets';

                          addNode(nodeType, node.type);
                        }}
                      >
                        <div className="text-left">
                          <div className="font-medium text-xs">{node.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {node.description}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={(params) => {
            const newEdges = addEdge(params, rfEdges)
            setRfEdges(newEdges)
            setEdges(newEdges)
          }}
          onNodeClick={(event, node) => {
            setSelectedNode(node)
            setShowPropertiesSidebar(true)
          }}
          onPaneClick={() => {
            setSelectedNode(null)
            setShowPropertiesSidebar(false)
          }}
          onEdgeClick={(event, edge) => {
            setSelectedEdge(edge)
          }}
          nodeTypes={nodeTypes}
          proOptions={proOptions}
          fitView
          className="bg-background"
        >
          <Background color="#aaa" gap={16} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'trigger': return '#f59e0b'
                case 'ai': return '#8b5cf6'
                case 'action': return '#3b82f6'
                case 'logic': return '#10b981'
                default: return '#6b7280'
              }
            }}
          />

          {/* Top Panel */}
          <Panel position="top-center">
            <Card className="bg-background/95 backdrop-blur">
              <CardContent className="p-3">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="font-medium">AI Agent Workflow</span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="text-sm text-muted-foreground">
                    {nodes.length} nodes, {edges.length} connections
                  </div>
                  {isRunning && (
                    <>
                      <Separator orientation="vertical" className="h-4" />
                      <Badge variant="secondary" className="animate-pulse">
                        Running...
                      </Badge>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right Properties Sidebar */}
      {showPropertiesSidebar && selectedNode && (
        <>
          <NodePropertiesSidebar
            node={selectedNode}
            onClose={closePropertiesSidebar}
          />
          {/* Save Changes Button Below Sidebar */}
          <div className="fixed bottom-4 right-4 z-50">
            <Button
              onClick={saveDraftChanges}
              className="shadow-lg"
              size="lg"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </>
      )}

      {/* Data Flow Sidebar */}
      {selectedEdge && (
        <DataFlowSidebar
          edge={selectedEdge}
          onClose={() => setSelectedEdge(null)}
        />
      )}

      {/* Workflow Setup Modal */}
      <WorkflowSetupModal
        isOpen={showSetupModal}
        onClose={() => {
          setShowSetupModal(false)
          if (nodes.length === 0) {
            localStorage.setItem('workflow-modal-dismissed', 'true')
          }
        }}
        onCreateWorkflow={handleCreateWorkflow}
      />

      {/* Mint Agent Modal */}
      <MintModal
        isOpen={showMintModal}
        onClose={() => setShowMintModal(false)}
        onMint={mintWorkflow}
      />
    </div>
  )
}

export default WorkflowBuilder

// Mint Agent Modal Component
const MintModal = ({ isOpen, onClose, onMint }) => {
  const [agentData, setAgentData] = useState({
    name: '',
    description: '',
    category: 'automation',
    pricePerUse: 0,
    subscriptionPrice: 0
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onMint(agentData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Mint Agent</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="agent-name">Agent Name</Label>
            <Input
              id="agent-name"
              value={agentData.name}
              onChange={(e) => setAgentData({...agentData, name: e.target.value})}
              placeholder="Enter agent name"
              required
            />
          </div>

          <div>
            <Label htmlFor="agent-description">Description</Label>
            <Textarea
              id="agent-description"
              value={agentData.description}
              onChange={(e) => setAgentData({...agentData, description: e.target.value})}
              placeholder="Describe what your agent does"
              required
            />
          </div>

          <div>
            <Label htmlFor="agent-category">Category</Label>
            <Select
              value={agentData.category}
              onValueChange={(value) => setAgentData({...agentData, category: value})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automation">Automation</SelectItem>
                <SelectItem value="data-processing">Data Processing</SelectItem>
                <SelectItem value="ai-assistant">AI Assistant</SelectItem>
                <SelectItem value="web-scraping">Web Scraping</SelectItem>
                <SelectItem value="analytics">Analytics</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="price-per-use">Price Per Use (ETH)</Label>
            <Input
              id="price-per-use"
              type="number"
              step="0.001"
              value={agentData.pricePerUse}
              onChange={(e) => setAgentData({...agentData, pricePerUse: parseFloat(e.target.value) || 0})}
              placeholder="0.01"
            />
          </div>

          <div>
            <Label htmlFor="subscription-price">Subscription Price (ETH/month)</Label>
            <Input
              id="subscription-price"
              type="number"
              step="0.001"
              value={agentData.subscriptionPrice}
              onChange={(e) => setAgentData({...agentData, subscriptionPrice: parseFloat(e.target.value) || 0})}
              placeholder="0.1"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Mint Agent
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

