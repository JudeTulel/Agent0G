import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Wallet,
  Sparkles,
  Zap,
  Webhook,
  Database,
  FileText,
  Bot,
  Plus,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

const WorkflowSetupModal = ({ isOpen, onClose, onCreateWorkflow }) => {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  // Workflow templates based on available nodes
  const workflowTemplates = [
    {
      id: 'blank',
      name: 'Blank Workflow',
      description: 'Start with a clean slate',
      icon: Plus,
      category: 'basic',
      nodes: []
    },
    {
      id: 'ai-chatbot',
      name: 'AI Chatbot',
      description: 'Create an AI-powered chatbot with webhooks',
      icon: Bot,
      category: 'ai',
      nodes: [
        {
          id: 'webhook-trigger',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: {
            label: 'Webhook Trigger',
            config: { type: 'webhook', url: '/api/webhook/chat', method: 'POST' }
          }
        },
        {
          id: 'llm-processor',
          type: 'ai',
          position: { x: 300, y: 100 },
          data: {
            label: 'LLM Processor',
            config: {
              model: 'gpt-4',
              prompt: 'You are a helpful AI assistant. Respond to the user query: {{webhook-trigger.data.message}}',
              temperature: 0.7,
              maxTokens: 1000
            }
          }
        },
        {
          id: 'http-response',
          type: 'httpRequest',
          position: { x: 500, y: 100 },
          data: {
            label: 'HTTP Response',
            method: 'POST',
            url: '{{webhook-trigger.data.responseUrl}}',
            body: '{"response": "{{llm-processor.result.response}}"}'
          }
        }
      ],
      edges: [
        { id: 'e1-2', source: 'webhook-trigger', target: 'llm-processor' },
        { id: 'e2-3', source: 'llm-processor', target: 'http-response' }
      ]
    },
    {
      id: 'data-processor',
      name: 'Data Processor',
      description: 'Process and transform data from APIs',
      icon: Database,
      category: 'data',
      nodes: [
        {
          id: 'schedule-trigger',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: {
            label: 'Daily Schedule',
            config: { type: 'schedule', cron: '0 9 * * *', timezone: 'UTC' }
          }
        },
        {
          id: 'api-fetch',
          type: 'httpRequest',
          position: { x: 300, y: 100 },
          data: {
            label: 'Fetch API Data',
            method: 'GET',
            url: 'https://api.example.com/data'
          }
        },
        {
          id: 'data-transform',
          type: 'logic',
          position: { x: 500, y: 100 },
          data: {
            label: 'Transform Data',
            config: {
              type: 'transform',
              inputData: '{{api-fetch.result.data}}',
              transformCode: 'return data.map(item => ({ ...item, processed: true, timestamp: new Date().toISOString() }))',
              outputVariable: 'processedData'
            }
          }
        },
        {
          id: 'store-result',
          type: 'action',
          position: { x: 700, y: 100 },
          data: {
            label: 'Store Result',
            config: {
              type: 'storage',
              operation: 'store',
              path: '/processed/{{schedule-trigger.data.date}}.json',
              data: '{{data-transform.result}}'
            }
          }
        }
      ],
      edges: [
        { id: 'e1-2', source: 'schedule-trigger', target: 'api-fetch' },
        { id: 'e2-3', source: 'api-fetch', target: 'data-transform' },
        { id: 'e3-4', source: 'data-transform', target: 'store-result' }
      ]
    },
    {
      id: 'google-sheets-automation',
      name: 'Google Sheets Automation',
      description: 'Automate data processing with Google Sheets',
      icon: FileText,
      category: 'automation',
      nodes: [
        {
          id: 'webhook-trigger',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: {
            label: 'Data Webhook',
            config: { type: 'webhook', url: '/api/webhook/sheets', method: 'POST' }
          }
        },
        {
          id: 'sheets-read',
          type: 'googleSheets',
          position: { x: 300, y: 100 },
          data: {
            label: 'Read Sheet Data',
            operation: 'read',
            selectedSheet: 'Sheet1',
            range: 'A1:Z100'
          }
        },
        {
          id: 'data-process',
          type: 'logic',
          position: { x: 500, y: 100 },
          data: {
            label: 'Process Data',
            config: {
              type: 'transform',
              inputData: '{{sheets-read.result.values}}',
              transformCode: 'return data.filter(row => row[0] && row[0] !== "Name").map(row => ({ name: row[0], value: row[1], processed: true }))',
              outputVariable: 'filteredData'
            }
          }
        },
        {
          id: 'sheets-write',
          type: 'googleSheets',
          position: { x: 700, y: 100 },
          data: {
            label: 'Write Results',
            operation: 'write',
            selectedSheet: 'Processed',
            range: 'A1:B{{data-process.result.length}}'
          }
        }
      ],
      edges: [
        { id: 'e1-2', source: 'webhook-trigger', target: 'sheets-read' },
        { id: 'e2-3', source: 'sheets-read', target: 'data-process' },
        { id: 'e3-4', source: 'data-process', target: 'sheets-write' }
      ]
    },
    {
      id: 'multi-step-ai-workflow',
      name: 'Multi-Step AI Workflow',
      description: 'Complex AI workflow with multiple processing steps',
      icon: Sparkles,
      category: 'ai',
      nodes: [
        {
          id: 'event-trigger',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: {
            label: 'Blockchain Event',
            config: {
              type: 'event',
              contractAddress: '0x...',
              eventName: 'Transfer',
              network: '0g'
            }
          }
        },
        {
          id: 'condition-check',
          type: 'logic',
          position: { x: 300, y: 100 },
          data: {
            label: 'Value Check',
            config: {
              type: 'condition',
              expression: '{{event-trigger.data.value}} > 1000000000000000000' // > 1 ETH
            }
          }
        },
        {
          id: 'ai-analysis',
          type: 'ai',
          position: { x: 500, y: 100 },
          data: {
            label: 'AI Analysis',
            config: {
              model: 'gpt-4',
              prompt: 'Analyze this blockchain transaction: {{event-trigger.data}}. Provide insights about the transaction value and potential significance.',
              temperature: 0.3,
              maxTokens: 500
            }
          }
        },
        {
          id: 'email-notification',
          type: 'action',
          position: { x: 700, y: 100 },
          data: {
            label: 'Send Notification',
            config: {
              type: 'email',
              to: 'admin@example.com',
              subject: 'Large Transaction Detected',
              body: 'AI Analysis: {{ai-analysis.result.response}}'
            }
          }
        }
      ],
      edges: [
        { id: 'e1-2', source: 'event-trigger', target: 'condition-check' },
        { id: 'e2-3', source: 'condition-check', target: 'ai-analysis' },
        { id: 'e3-4', source: 'ai-analysis', target: 'email-notification' }
      ]
    },
    {
      id: 'api-integration-workflow',
      name: 'API Integration Workflow',
      description: 'Connect multiple APIs and process data',
      icon: Webhook,
      category: 'integration',
      nodes: [
        {
          id: 'webhook-trigger',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: {
            label: 'API Webhook',
            config: { type: 'webhook', url: '/api/webhook/integration', method: 'POST' }
          }
        },
        {
          id: 'external-api-1',
          type: 'httpRequest',
          position: { x: 300, y: 100 },
          data: {
            label: 'External API 1',
            method: 'GET',
            url: 'https://api.service1.com/data/{{webhook-trigger.data.id}}'
          }
        },
        {
          id: 'external-api-2',
          type: 'httpRequest',
          position: { x: 300, y: 200 },
          data: {
            label: 'External API 2',
            method: 'POST',
            url: 'https://api.service2.com/process',
            body: '{"data": "{{external-api-1.result}}", "webhookData": "{{webhook-trigger.data}}"}'
          }
        },
        {
          id: 'data-merge',
          type: 'logic',
          position: { x: 500, y: 150 },
          data: {
            label: 'Merge Results',
            config: {
              type: 'transform',
              inputData: '{ api1: {{external-api-1.result}}, api2: {{external-api-2.result}}, original: {{webhook-trigger.data}} }',
              transformCode: 'return { ...input.original, api1Result: input.api1, api2Result: input.api2, mergedAt: new Date().toISOString() }',
              outputVariable: 'mergedData'
            }
          }
        },
        {
          id: 'final-response',
          type: 'httpRequest',
          position: { x: 700, y: 150 },
          data: {
            label: 'Send Response',
            method: 'POST',
            url: '{{webhook-trigger.data.callbackUrl}}',
            body: '{{data-merge.result}}'
          }
        }
      ],
      edges: [
        { id: 'e1-2', source: 'webhook-trigger', target: 'external-api-1' },
        { id: 'e1-3', source: 'webhook-trigger', target: 'external-api-2' },
        { id: 'e2-4', source: 'external-api-1', target: 'data-merge' },
        { id: 'e3-4', source: 'external-api-2', target: 'data-merge' },
        { id: 'e4-5', source: 'data-merge', target: 'final-response' }
      ]
    }
  ]

  const handleCreateWorkflow = (template) => {
    const workflowData = {
      nodes: template.nodes || [],
      edges: template.edges || []
    }
    onCreateWorkflow(workflowData)
    onClose()
  }

  const handleConnectWallet = (connector) => {
    connect({ connector })
  }

  if (!isConnected) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Wallet className="h-5 w-5" />
              <span>Connect Your Wallet</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
                <Wallet className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Welcome to Agent0G</h3>
              <p className="text-muted-foreground">
                Connect your wallet to start building AI agent workflows on the 0G network
              </p>
            </div>

            <div className="space-y-2">
              {connectors.map((connector) => (
                <Button
                  key={connector.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleConnectWallet(connector)}
                  disabled={isPending}
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  {isPending ? 'Connecting...' : `Connect ${connector.name}`}
                </Button>
              ))}
            </div>

            <div className="text-xs text-muted-foreground text-center">
              By connecting your wallet, you agree to use the 0G network for AI inference
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5" />
            <span>Create New Workflow</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Wallet Status */}
          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium">Wallet Connected</span>
            </div>
            <Badge variant="secondary" className="font-mono">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </Badge>
          </div>

          {/* Template Categories */}
          <Tabs defaultValue="featured" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="featured">Featured</TabsTrigger>
              <TabsTrigger value="ai">AI Workflows</TabsTrigger>
              <TabsTrigger value="automation">Automation</TabsTrigger>
              <TabsTrigger value="integration">Integration</TabsTrigger>
            </TabsList>

            <TabsContent value="featured" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workflowTemplates.filter(t => t.category === 'basic' || t.category === 'ai').map((template) => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-2">
                        <template.icon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-3">{template.description}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">{template.category}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {template.nodes?.length || 0} nodes
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workflowTemplates.filter(t => t.category === 'ai').map((template) => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-2">
                        <template.icon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-3">{template.description}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">{template.category}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {template.nodes?.length || 0} nodes
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="automation" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workflowTemplates.filter(t => t.category === 'automation' || t.category === 'data').map((template) => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-2">
                        <template.icon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-3">{template.description}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">{template.category}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {template.nodes?.length || 0} nodes
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="integration" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workflowTemplates.filter(t => t.category === 'integration').map((template) => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-2">
                        <template.icon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-3">{template.description}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">{template.category}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {template.nodes?.length || 0} nodes
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <Separator />

          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => handleCreateWorkflow(selectedTemplate || workflowTemplates[0])}
              disabled={!selectedTemplate && selectedTemplate?.id !== 'blank'}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default WorkflowSetupModal
