import { useState, useCallback, useMemo, useEffect } from 'react'
import { useAccount } from 'wagmi'
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

import {
  Play,
  Save,
  Download,
  Upload,
  Zap,
  Settings,
  Plus,
  Trash2,
  Copy,
  X
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
    setIsRunning,
    setAvailableServices,
    setIsLoadingServices,
    addNode,
    deleteNode,
    updateNodeData,
    runWorkflow,
    saveWorkflow,
    loadServices
  } = store

  // Modal state
  const [showSetupModal, setShowSetupModal] = useState(false)

  // ReactFlow state management
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges)

  // Sync Zustand state with ReactFlow state
  useEffect(() => {
    setRfNodes(nodes)
  }, [nodes, setRfNodes])

  useEffect(() => {
    setRfEdges(edges)
  }, [edges, setRfEdges])

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

  // Node Properties Sidebar Component
  const NodePropertiesSidebar = ({ node, onClose }) => {
    if (!node) return null

    const handlePropertyChange = (property, value) => {
      const newData = { ...node.data }
      if (property.includes('.')) {
        const [parent, child] = property.split('.')
        newData[parent] = { ...newData[parent], [child]: value }
      } else {
        newData[property] = value
      }
      updateNodeData(node.id, newData)
    }

    const renderNodeProperties = () => {
      switch (node.type) {
        case 'trigger':
          return (
            <div className="space-y-4">
              <div>
                <Label htmlFor="trigger-label">Label</Label>
                <Input
                  id="trigger-label"
                  value={node.data.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter trigger label"
                />
              </div>
              <div>
                <Label htmlFor="trigger-type">Trigger Type</Label>
                <Select
                  value={node.data.config?.type || ''}
                  onValueChange={(value) => handlePropertyChange('config.type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select trigger type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="schedule">Schedule</SelectItem>
                    <SelectItem value="event">Blockchain Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {node.data.config?.type === 'webhook' && (
                <>
                  <div>
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <Input
                      id="webhook-url"
                      value={node.data.config?.url || ''}
                      onChange={(e) => handlePropertyChange('config.url', e.target.value)}
                      placeholder="https://api.example.com/webhook"
                      className="font-mono"
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      The URL that will trigger this workflow when called
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="webhook-method">HTTP Method</Label>
                      <Select
                        value={node.data.config?.method || 'POST'}
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
                          <SelectItem value="PATCH">PATCH</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="webhook-timeout">Timeout (seconds)</Label>
                      <Input
                        id="webhook-timeout"
                        type="number"
                        min="1"
                        max="300"
                        value={node.data.config?.timeout || 30}
                        onChange={(e) => handlePropertyChange('config.timeout', parseInt(e.target.value) || 30)}
                        placeholder="30"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="webhook-headers">Headers</Label>
                    <Textarea
                      id="webhook-headers"
                      value={node.data.config?.headers ? JSON.stringify(node.data.config.headers, null, 2) : ''}
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
                  <div>
                    <Label htmlFor="webhook-secret">Webhook Secret</Label>
                    <Input
                      id="webhook-secret"
                      type="password"
                      value={node.data.config?.secret || ''}
                      onChange={(e) => handlePropertyChange('config.secret', e.target.value)}
                      placeholder="Optional webhook verification secret"
                    />
                  </div>
                </>
              )}
              {node.data.config?.type === 'schedule' && (
                <>
                  <div>
                    <Label htmlFor="schedule-timer">Timer Interval (seconds)</Label>
                    <Input
                      id="schedule-timer"
                      type="number"
                      min="1"
                      value={node.data.config?.timer || ''}
                      onChange={(e) => handlePropertyChange('config.timer', parseInt(e.target.value) || 0)}
                      placeholder="60"
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      Run every X seconds (leave empty to use cron expression)
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="schedule-cron">Cron Expression</Label>
                    <Input
                      id="schedule-cron"
                      value={node.data.config?.cron || ''}
                      onChange={(e) => handlePropertyChange('config.cron', e.target.value)}
                      placeholder="0 0 * * * (daily at midnight)"
                      disabled={node.data.config?.timer > 0}
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      Use cron format: minute hour day month day-of-week
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="schedule-timezone">Timezone</Label>
                    <Select
                      value={node.data.config?.timezone || 'UTC'}
                      onValueChange={(value) => handlePropertyChange('config.timezone', value)}
                      disabled={node.data.config?.timer > 0}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        <SelectItem value="Europe/London">London</SelectItem>
                        <SelectItem value="Europe/Paris">Paris</SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="schedule-description">Description</Label>
                    <Input
                      id="schedule-description"
                      value={node.data.config?.description || ''}
                      onChange={(e) => handlePropertyChange('config.description', e.target.value)}
                      placeholder="What does this schedule do?"
                    />
                  </div>
                </>
              )}
              {node.data.config?.type === 'event' && (
                <>
                  <div>
                    <Label htmlFor="event-contract">Contract Address</Label>
                    <Input
                      id="event-contract"
                      value={node.data.config?.contractAddress || ''}
                      onChange={(e) => handlePropertyChange('config.contractAddress', e.target.value)}
                      placeholder="0x..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="event-name">Event Name</Label>
                    <Input
                      id="event-name"
                      value={node.data.config?.eventName || ''}
                      onChange={(e) => handlePropertyChange('config.eventName', e.target.value)}
                      placeholder="Transfer, Approval, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="event-network">Network</Label>
                    <Select
                      value={node.data.config?.network || '0g'}
                      onValueChange={(value) => handlePropertyChange('config.network', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0g">0G Chain</SelectItem>
                        <SelectItem value="ethereum">Ethereum</SelectItem>
                        <SelectItem value="polygon">Polygon</SelectItem>
                        <SelectItem value="bsc">BSC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          )

        case 'ai':
          return (
            <div className="space-y-4">
              <div>
                <Label htmlFor="ai-label">Label</Label>
                <Input
                  id="ai-label"
                  value={node.data.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter AI node label"
                />
              </div>
              <div>
                <Label htmlFor="ai-provider">Provider</Label>
                <Select
                  value={node.data.config?.providerAddress || ''}
                  onValueChange={(value) => {
                    // Find the selected service to update model and other fields
                    const selectedService = availableServices.find(service => service.providerAddress === value);
                    if (selectedService) {
                      handlePropertyChange('config.providerAddress', value);
                      handlePropertyChange('config.model', selectedService.model);
                      handlePropertyChange('config.endpoint', selectedService.endpoint);
                      handlePropertyChange('config.provider', selectedService.provider);
                    }
                  }}
                  disabled={isLoadingServices}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingServices ? "Loading providers..." : "Select provider"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableServices.map((service) => (
                      <SelectItem key={service.providerAddress} value={service.providerAddress}>
                        {service.provider} - {service.model} ({service.serviceType})
                      </SelectItem>
                    ))}
                    {availableServices.length === 0 && !isLoadingServices && (
                      <SelectItem value="" disabled>
                        No providers available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ai-model">Model</Label>
                <Select
                  value={node.data.config?.model || ''}
                  onValueChange={(value) => {
                    // Find the selected service to update endpoint and other fields
                    const selectedService = availableServices.find(service => service.model === value);
                    if (selectedService) {
                      handlePropertyChange('config.model', value);
                      handlePropertyChange('config.endpoint', selectedService.endpoint);
                      handlePropertyChange('config.providerAddress', selectedService.providerAddress);
                    }
                  }}
                  disabled={isLoadingServices}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingServices ? "Loading models..." : "Select AI model"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableServices
                      .filter(service => !node.data.config?.providerAddress || service.providerAddress === node.data.config.providerAddress)
                      .map((service) => (
                        <SelectItem key={`${service.providerAddress}-${service.model}`} value={service.model}>
                          {service.model} ({service.provider})
                        </SelectItem>
                      ))}
                    {availableServices.length === 0 && !isLoadingServices && (
                      <SelectItem value="" disabled>
                        No models available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ai-endpoint">Endpoint</Label>
                <Input
                  id="ai-endpoint"
                  value={node.data.config?.endpoint || ''}
                  onChange={(e) => handlePropertyChange('config.endpoint', e.target.value)}
                  placeholder="API endpoint URL"
                  readOnly
                />
              </div>
              {node.data.config?.providerAddress && (
                <div className="p-3 bg-muted/50 rounded-md">
                  <Label className="text-sm font-medium">Pricing Information</Label>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(() => {
                      const service = availableServices.find(s => s.providerAddress === node.data.config.providerAddress);
                      if (service) {
                        const inputPrice = parseInt(service.inputPrice) / 1e18; // Convert from wei
                        const outputPrice = parseInt(service.outputPrice) / 1e18; // Convert from wei
                        return `Input: ${inputPrice.toFixed(6)} ETH/token | Output: ${outputPrice.toFixed(6)} ETH/token`;
                      }
                      return 'Pricing information not available';
                    })()}
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="ai-prompt">Prompt</Label>
                <Textarea
                  id="ai-prompt"
                  value={node.data.config?.prompt || ''}
                  onChange={(e) => handlePropertyChange('config.prompt', e.target.value)}
                  placeholder="Enter your AI prompt here..."
                  rows={6}
                  className="font-mono text-sm"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Use {`{input}`} to reference data from previous nodes
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ai-temperature">Temperature: {node.data.config?.temperature || 0.7}</Label>
                  <Slider
                    id="ai-temperature"
                    min={0}
                    max={2}
                    step={0.1}
                    value={[node.data.config?.temperature || 0.7]}
                    onValueChange={(value) => handlePropertyChange('config.temperature', value[0])}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="ai-max-tokens">Max Tokens</Label>
                  <Input
                    id="ai-max-tokens"
                    type="number"
                    min="1"
                    max="4096"
                    value={node.data.config?.maxTokens || 1024}
                    onChange={(e) => handlePropertyChange('config.maxTokens', parseInt(e.target.value) || 1024)}
                    placeholder="1024"
                  />
                </div>
              </div>              {node.data.result && (
                <>
                  <Separator />
                  <div>
                    <Label>Last Execution Result</Label>
                    <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                      <div className="font-medium mb-1">Response:</div>
                      <div className="text-muted-foreground">
                        {node.data.result.answer || 'No response'}
                      </div>
                      {node.data.lastExecuted && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Executed: {new Date(node.data.lastExecuted).toLocaleString()}
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
                  value={node.data.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter action label"
                />
              </div>
              <div>
                <Label htmlFor="action-type">Action Type</Label>
                <Select
                  value={node.data.config?.type || ''}
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
              {node.data.config?.type === 'http' && (
                <>
                  <div>
                    <Label htmlFor="http-url">URL</Label>
                    <Input
                      id="http-url"
                      value={node.data.config?.url || ''}
                      onChange={(e) => handlePropertyChange('config.url', e.target.value)}
                      placeholder="https://api.example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="http-method">Method</Label>
                    <Select
                      value={node.data.config?.method || 'GET'}
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
                      value={node.data.config?.headers ? JSON.stringify(node.data.config.headers, null, 2) : ''}
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
                  {(node.data.config?.method === 'POST' || node.data.config?.method === 'PUT') && (
                    <div>
                      <Label htmlFor="http-body">Request Body</Label>
                      <Textarea
                        id="http-body"
                        value={node.data.config?.body || ''}
                        onChange={(e) => handlePropertyChange('config.body', e.target.value)}
                        placeholder="JSON or text body"
                        rows={4}
                      />
                    </div>
                  )}
                </>
              )}
              {node.data.config?.type === 'email' && (
                <>
                  <div>
                    <Label htmlFor="email-to">To</Label>
                    <Input
                      id="email-to"
                      value={node.data.config?.to || ''}
                      onChange={(e) => handlePropertyChange('config.to', e.target.value)}
                      placeholder="recipient@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-subject">Subject</Label>
                    <Input
                      id="email-subject"
                      value={node.data.config?.subject || ''}
                      onChange={(e) => handlePropertyChange('config.subject', e.target.value)}
                      placeholder="Email subject"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-body">Body</Label>
                    <Textarea
                      id="email-body"
                      value={node.data.config?.body || ''}
                      onChange={(e) => handlePropertyChange('config.body', e.target.value)}
                      placeholder="Email body content"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-template">Template</Label>
                    <Select
                      value={node.data.config?.template || 'plain'}
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
              {node.data.config?.type === 'database' && (
                <>
                  <div>
                    <Label htmlFor="db-operation">Operation</Label>
                    <Select
                      value={node.data.config?.operation || 'select'}
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
                      value={node.data.config?.query || ''}
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
                      value={node.data.config?.connection || ''}
                      onChange={(e) => handlePropertyChange('config.connection', e.target.value)}
                      placeholder="Database connection string"
                    />
                  </div>
                </>
              )}
              {node.data.config?.type === 'storage' && (
                <>
                  <div>
                    <Label htmlFor="storage-operation">Operation</Label>
                    <Select
                      value={node.data.config?.operation || 'upload'}
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
                      value={node.data.config?.path || ''}
                      onChange={(e) => handlePropertyChange('config.path', e.target.value)}
                      placeholder="/path/to/file.txt"
                    />
                  </div>
                  <div>
                    <Label htmlFor="storage-bucket">Bucket/Container</Label>
                    <Input
                      id="storage-bucket"
                      value={node.data.config?.bucket || ''}
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
                  value={node.data.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter logic node label"
                />
              </div>
              <div>
                <Label htmlFor="logic-type">Logic Type</Label>
                <Select
                  value={node.data.config?.type || ''}
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
              {node.data.config?.type === 'condition' && (
                <div>
                  <Label htmlFor="condition-expression">Condition Expression</Label>
                  <Textarea
                    id="condition-expression"
                    value={node.data.config?.expression || ''}
                    onChange={(e) => handlePropertyChange('config.expression', e.target.value)}
                    placeholder="e.g., data.status === 'success'"
                    rows={3}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Use JavaScript syntax. Access input data with 'data' variable.
                  </div>
                </div>
              )}
              {node.data.config?.type === 'loop' && (
                <>
                  <div>
                    <Label htmlFor="loop-array">Array Expression</Label>
                    <Input
                      id="loop-array"
                      value={node.data.config?.arrayExpression || ''}
                      onChange={(e) => handlePropertyChange('config.arrayExpression', e.target.value)}
                      placeholder="data.items"
                    />
                  </div>
                  <div>
                    <Label htmlFor="loop-variable">Loop Variable</Label>
                    <Input
                      id="loop-variable"
                      value={node.data.config?.loopVariable || 'item'}
                      onChange={(e) => handlePropertyChange('config.loopVariable', e.target.value)}
                      placeholder="item"
                    />
                  </div>
                  <div>
                    <Label htmlFor="loop-condition">Loop Condition (Optional)</Label>
                    <Input
                      id="loop-condition"
                      value={node.data.config?.condition || ''}
                      onChange={(e) => handlePropertyChange('config.condition', e.target.value)}
                      placeholder="item.active === true"
                    />
                  </div>
                </>
              )}
              {node.data.config?.type === 'variable' && (
                <>
                  <div>
                    <Label htmlFor="variable-name">Variable Name</Label>
                    <Input
                      id="variable-name"
                      value={node.data.config?.variableName || ''}
                      onChange={(e) => handlePropertyChange('config.variableName', e.target.value)}
                      placeholder="myVariable"
                    />
                  </div>
                  <div>
                    <Label htmlFor="variable-value">Variable Value</Label>
                    <Textarea
                      id="variable-value"
                      value={node.data.config?.variableValue || ''}
                      onChange={(e) => handlePropertyChange('config.variableValue', e.target.value)}
                      placeholder="data.result"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="variable-scope">Scope</Label>
                    <Select
                      value={node.data.config?.scope || 'workflow'}
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
              {node.data.config?.type === 'transform' && (
                <>
                  <div>
                    <Label htmlFor="transform-input">Input Data</Label>
                    <Textarea
                      id="transform-input"
                      value={node.data.config?.inputData || ''}
                      onChange={(e) => handlePropertyChange('config.inputData', e.target.value)}
                      placeholder="data"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="transform-code">Transform Code</Label>
                    <Textarea
                      id="transform-code"
                      value={node.data.config?.transformCode || ''}
                      onChange={(e) => handlePropertyChange('config.transformCode', e.target.value)}
                      placeholder="return data.map(item => ({ ...item, processed: true }))"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="transform-output">Output Variable</Label>
                    <Input
                      id="transform-output"
                      value={node.data.config?.outputVariable || 'transformedData'}
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
                  value={node.data.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter HTTP request label"
                />
              </div>
              <div>
                <Label htmlFor="http-method">HTTP Method</Label>
                <Select
                  value={node.data.method || 'GET'}
                  onValueChange={(value) => handlePropertyChange('method', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="http-url">URL</Label>
                <Input
                  id="http-url"
                  value={node.data.url || ''}
                  onChange={(e) => handlePropertyChange('url', e.target.value)}
                  placeholder="https://api.example.com/endpoint"
                />
              </div>
              <div>
                <Label htmlFor="http-headers">Headers</Label>
                <div className="space-y-2">
                  {(node.data.headers || []).map((header, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Key"
                        value={header.key || ''}
                        onChange={(e) => {
                          const newHeaders = [...(node.data.headers || [])];
                          newHeaders[index] = { ...newHeaders[index], key: e.target.value };
                          handlePropertyChange('headers', newHeaders);
                        }}
                      />
                      <Input
                        placeholder="Value"
                        value={header.value || ''}
                        onChange={(e) => {
                          const newHeaders = [...(node.data.headers || [])];
                          newHeaders[index] = { ...newHeaders[index], value: e.target.value };
                          handlePropertyChange('headers', newHeaders);
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newHeaders = (node.data.headers || []).filter((_, i) => i !== index);
                          handlePropertyChange('headers', newHeaders);
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newHeaders = [...(node.data.headers || []), { key: '', value: '' }];
                      handlePropertyChange('headers', newHeaders);
                    }}
                  >
                    Add Header
                  </Button>
                </div>
              </div>
              {(node.data.method === 'POST' || node.data.method === 'PUT' || node.data.method === 'PATCH') && (
                <div>
                  <Label htmlFor="http-body">Request Body</Label>
                  <Textarea
                    id="http-body"
                    value={node.data.body || ''}
                    onChange={(e) => handlePropertyChange('body', e.target.value)}
                    placeholder="JSON or text body"
                    rows={4}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="http-auth">Authentication</Label>
                <Select
                  value={node.data.authType || 'none'}
                  onValueChange={(value) => handlePropertyChange('authType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="apiKey">API Key</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {node.data.authType === 'basic' && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Username"
                    value={node.data.authData?.username || ''}
                    onChange={(e) => handlePropertyChange('authData.username', e.target.value)}
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={node.data.authData?.password || ''}
                    onChange={(e) => handlePropertyChange('authData.password', e.target.value)}
                  />
                </div>
              )}
              {node.data.authType === 'bearer' && (
                <Input
                  placeholder="Bearer Token"
                  value={node.data.authData?.token || ''}
                  onChange={(e) => handlePropertyChange('authData.token', e.target.value)}
                />
              )}
              {node.data.authType === 'apiKey' && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="API Key"
                    value={node.data.authData?.apiKey || ''}
                    onChange={(e) => handlePropertyChange('authData.apiKey', e.target.value)}
                  />
                  <Input
                    placeholder="Header Name"
                    value={node.data.authData?.headerName || ''}
                    onChange={(e) => handlePropertyChange('authData.headerName', e.target.value)}
                  />
                </div>
              )}
              
              {node.data.result && (
                <>
                  <Separator />
                  <div>
                    <Label>Last Execution Result</Label>
                    <div className="mt-2 p-3 bg-muted rounded-md text-sm max-h-32 overflow-y-auto">
                      <div className="font-medium mb-1">Status: {node.data.result.status}</div>
                      <div className="text-muted-foreground">
                        {typeof node.data.result.data === 'string' 
                          ? node.data.result.data 
                          : JSON.stringify(node.data.result.data, null, 2)}
                      </div>
                      {node.data.lastExecuted && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Executed: {new Date(node.data.lastExecuted).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )

        case 'googleSheets':
          return (
            <div className="space-y-4">
              <div>
                <Label htmlFor="sheets-label">Label</Label>
                <Input
                  id="sheets-label"
                  value={node.data.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter Google Sheets label"
                />
              </div>
              
              <div>
                <Label>Authentication Status</Label>
                <div className="mt-2">
                  {localStorage.getItem('google_access_token') ? (
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
                <Label htmlFor="sheets-operation">Operation</Label>
                <Select
                  value={node.data.operation || 'read'}
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

              <div>
                <Label htmlFor="sheets-spreadsheet">Spreadsheet ID</Label>
                <Input
                  id="sheets-spreadsheet"
                  value={node.data.selectedSpreadsheet || ''}
                  onChange={(e) => handlePropertyChange('selectedSpreadsheet', e.target.value)}
                  placeholder="Enter spreadsheet ID or leave blank to select from list"
                />
              </div>

              <div>
                <Label htmlFor="sheets-sheet">Sheet Name</Label>
                <Input
                  id="sheets-sheet"
                  value={node.data.selectedSheet || ''}
                  onChange={(e) => handlePropertyChange('selectedSheet', e.target.value)}
                  placeholder="Sheet1"
                />
              </div>

              <div>
                <Label htmlFor="sheets-range">Range</Label>
                <Input
                  id="sheets-range"
                  value={node.data.range || 'A1:Z100'}
                  onChange={(e) => handlePropertyChange('range', e.target.value)}
                  placeholder="A1:Z100"
                />
              </div>
              
              {node.data.result && (
                <>
                  <Separator />
                  <div>
                    <Label>Last Execution Result</Label>
                    <div className="mt-2 p-3 bg-muted rounded-md text-sm max-h-32 overflow-y-auto">
                      <div className="font-medium mb-1">Operation: {node.data.result.operation}</div>
                      {node.data.result.values && (
                        <div className="text-muted-foreground">
                          Rows: {node.data.result.values.length}
                        </div>
                      )}
                      {node.data.result.success !== undefined && (
                        <div className="text-muted-foreground">
                          Success: {node.data.result.success ? 'Yes' : 'No'}
                        </div>
                      )}
                      {node.data.lastExecuted && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Executed: {new Date(node.data.lastExecuted).toLocaleString()}
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
                  value={node.data.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter LLM node label"
                />
              </div>
              
              <div>
                <Label htmlFor="llm-model">AI Model</Label>
                <Select
                  value={node.data.config?.model || 'gpt-4'}
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
              
              {node.data.config?.model === 'custom' && (
                <div>
                  <Label htmlFor="custom-model-endpoint">Custom Model Endpoint</Label>
                  <Input
                    id="custom-model-endpoint"
                    value={node.data.config?.customEndpoint || ''}
                    onChange={(e) => handlePropertyChange('config.customEndpoint', e.target.value)}
                    placeholder="https://api.custom-model.com/v1/chat"
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="llm-prompt">Prompt Template</Label>
                <Textarea
                  id="llm-prompt"
                  value={node.data.config?.prompt || ''}
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
                  value={[node.data.config?.temperature || 0.7]}
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
                  value={node.data.config?.maxTokens || 1000}
                  onChange={(e) => handlePropertyChange('config.maxTokens', parseInt(e.target.value))}
                  min={1}
                  max={4000}
                />
              </div>
              
              <div>
                <Label htmlFor="llm-system-message">System Message</Label>
                <Textarea
                  id="llm-system-message"
                  value={node.data.config?.systemMessage || ''}
                  onChange={(e) => handlePropertyChange('config.systemMessage', e.target.value)}
                  placeholder="You are a helpful assistant..."
                  rows={3}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="llm-stream"
                  checked={node.data.config?.stream || false}
                  onCheckedChange={(checked) => handlePropertyChange('config.stream', checked)}
                />
                <Label htmlFor="llm-stream">Stream Response</Label>
              </div>
              
              <div>
                <Label htmlFor="llm-output-format">Output Format</Label>
                <Select
                  value={node.data.config?.outputFormat || 'text'}
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
              
              {node.data.result && (
                <>
                  <Separator />
                  <div>
                    <Label>Last Execution Result</Label>
                    <div className="mt-2 p-3 bg-muted rounded-md text-sm max-h-32 overflow-y-auto">
                      <div className="font-medium mb-1">Model: {node.data.config?.model}</div>
                      <div className="text-muted-foreground">
                        {node.data.result.response || 'No response data'}
                      </div>
                      {node.data.lastExecuted && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Executed: {new Date(node.data.lastExecuted).toLocaleString()}
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
                  value={node.data.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter vision node label"
                />
              </div>
              
              <div>
                <Label htmlFor="vision-model">Vision Model</Label>
                <Select
                  value={node.data.config?.model || 'gpt-4-vision'}
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
              
              {node.data.config?.model === 'custom' && (
                <div>
                  <Label htmlFor="custom-vision-endpoint">Custom Vision Endpoint</Label>
                  <Input
                    id="custom-vision-endpoint"
                    value={node.data.config?.customEndpoint || ''}
                    onChange={(e) => handlePropertyChange('config.customEndpoint', e.target.value)}
                    placeholder="https://api.custom-vision.com/v1/analyze"
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="vision-prompt">Analysis Prompt</Label>
                <Textarea
                  id="vision-prompt"
                  value={node.data.config?.prompt || ''}
                  onChange={(e) => handlePropertyChange('config.prompt', e.target.value)}
                  placeholder="Describe what you want to analyze in the image..."
                  rows={4}
                />
              </div>
              
              <div>
                <Label htmlFor="vision-image-source">Image Source</Label>
                <Select
                  value={node.data.config?.imageSource || 'url'}
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
              
              {node.data.config?.imageSource === 'url' && (
                <div>
                  <Label htmlFor="vision-image-url">Image URL</Label>
                  <Input
                    id="vision-image-url"
                    value={node.data.config?.imageUrl || ''}
                    onChange={(e) => handlePropertyChange('config.imageUrl', e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="vision-output-format">Output Format</Label>
                <Select
                  value={node.data.config?.outputFormat || 'text'}
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
              
              {node.data.result && (
                <>
                  <Separator />
                  <div>
                    <Label>Last Execution Result</Label>
                    <div className="mt-2 p-3 bg-muted rounded-md text-sm max-h-32 overflow-y-auto">
                      <div className="font-medium mb-1">Analysis Complete</div>
                      <div className="text-muted-foreground">
                        {node.data.result.analysis || 'No analysis data'}
                      </div>
                      {node.data.lastExecuted && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Executed: {new Date(node.data.lastExecuted).toLocaleString()}
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
                  value={node.data.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter embedding node label"
                />
              </div>
              
              <div>
                <Label htmlFor="embedding-model">Embedding Model</Label>
                <Select
                  value={node.data.config?.model || 'text-embedding-ada-002'}
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
              
              {node.data.config?.model === 'custom' && (
                <div>
                  <Label htmlFor="custom-embedding-endpoint">Custom Embedding Endpoint</Label>
                  <Input
                    id="custom-embedding-endpoint"
                    value={node.data.config?.customEndpoint || ''}
                    onChange={(e) => handlePropertyChange('config.customEndpoint', e.target.value)}
                    placeholder="https://api.custom-embedding.com/v1/embed"
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="embedding-input">Input Text</Label>
                <Textarea
                  id="embedding-input"
                  value={node.data.config?.inputText || ''}
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
                  value={node.data.config?.operation || 'embed'}
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
              
              {node.data.config?.operation === 'similarity' && (
                <>
                  <div>
                    <Label htmlFor="embedding-compare-text">Compare With Text</Label>
                    <Textarea
                      id="embedding-compare-text"
                      value={node.data.config?.compareText || ''}
                      onChange={(e) => handlePropertyChange('config.compareText', e.target.value)}
                      placeholder="Text to compare similarity with..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="embedding-similarity-metric">Similarity Metric</Label>
                    <Select
                      value={node.data.config?.similarityMetric || 'cosine'}
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
                  value={node.data.config?.outputVariable || 'embeddings'}
                  onChange={(e) => handlePropertyChange('config.outputVariable', e.target.value)}
                  placeholder="embeddings"
                />
              </div>
              
              {node.data.result && (
                <>
                  <Separator />
                  <div>
                    <Label>Last Execution Result</Label>
                    <div className="mt-2 p-3 bg-muted rounded-md text-sm max-h-32 overflow-y-auto">
                      <div className="font-medium mb-1">Operation: {node.data.config?.operation}</div>
                      {node.data.result.dimensions && (
                        <div className="text-muted-foreground">
                          Dimensions: {node.data.result.dimensions}
                        </div>
                      )}
                      {node.data.result.similarity !== undefined && (
                        <div className="text-muted-foreground">
                          Similarity: {node.data.result.similarity.toFixed(4)}
                        </div>
                      )}
                      {node.data.lastExecuted && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Executed: {new Date(node.data.lastExecuted).toLocaleString()}
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
                  value={node.data.label || ''}
                  onChange={(e) => handlePropertyChange('label', e.target.value)}
                  placeholder="Enter node label"
                />
              </div>
            </div>
          )
      }
    }

    return (
      <div className="w-80 bg-card border-l overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Node Properties</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Node Type</Label>
              <Badge variant="secondary" className="ml-2">
                {node.type}
              </Badge>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Node ID</Label>
              <div className="text-sm text-muted-foreground mt-1">{node.id}</div>
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-center">
              <Button variant="destructive" size="sm" onClick={deleteNode}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Node
              </Button>
            </div>
            
            <Separator />
            
            {renderNodeProperties()}
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
          <h2 className="text-xl font-bold mb-4">Workflow Builder</h2>
          
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
            
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={saveWorkflow}>
                <Save className="h-4 w-4 mr-1" />
                Save
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
          onNodesChange={(changes) => {
            onNodesChange(changes)
            // Sync back to store after ReactFlow updates
            setTimeout(() => setNodes(rfNodes), 0)
          }}
          onEdgesChange={(changes) => {
            onEdgesChange(changes)
            // Sync back to store after ReactFlow updates
            setTimeout(() => setEdges(rfEdges), 0)
          }}
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
        <NodePropertiesSidebar
          node={selectedNode}
          onClose={closePropertiesSidebar}
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
    </div>
  )
}

export default WorkflowBuilder

