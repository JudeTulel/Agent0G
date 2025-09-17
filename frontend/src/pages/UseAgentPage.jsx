import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'

const UseAgentPage = () => {
  const { agentId } = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = useState(null)
  const [workflowData, setWorkflowData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [inputs, setInputs] = useState({})
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (agentId) {
      fetchAgentData()
    }
  }, [agentId])

  const fetchAgentData = async () => {
    setLoading(true)
    try {
      // Fetch agent details
      const agentResponse = await fetch(`http://localhost:3001/api/contracts/agents/${agentId}`)
      if (agentResponse.ok) {
        const agentData = await agentResponse.json()
        setAgent(agentData.agent)
      }

      // Fetch workflow data (this would need to be implemented in the backend)
      // For now, we'll create a mock workflow based on the agent type
      const mockWorkflow = {
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 100, y: 200 },
            data: {
              label: 'Webhook Trigger',
              config: {
                url: '',
                method: 'POST'
              }
            }
          },
          {
            id: 'ai-1',
            type: 'ai',
            position: { x: 350, y: 200 },
            data: {
              label: 'AI Processor',
              config: {
                prompt: 'Process the input data and provide a response'
              }
            }
          }
        ],
        edges: [
          {
            id: 'e1',
            source: 'trigger-1',
            target: 'ai-1'
          }
        ]
      }
      setWorkflowData(mockWorkflow)
    } catch (error) {
      console.error('Error fetching agent:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (nodeId, field, value) => {
    setInputs(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        [field]: value
      }
    }))
  }

  const handleRun = async () => {
    setIsRunning(true)
    try {
      // Here you would execute the workflow with the provided inputs
      // This would involve calling the backend API to run the workflow
      console.log('Running workflow with inputs:', inputs)

      // Mock execution
      await new Promise(resolve => setTimeout(resolve, 2000))

      alert('Workflow executed successfully!')
    } catch (error) {
      console.error('Error running workflow:', error)
      alert('Error running workflow')
    } finally {
      setIsRunning(false)
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <p>Loading agent...</p>
        </div>
      </main>
    )
  }

  if (!agent) {
    return (
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <p>Agent not found</p>
          <Button onClick={() => navigate('/profile')} className="mt-4">
            Back to Profile
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Button variant="ghost" onClick={() => navigate('/profile')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Profile
        </Button>
        <h1 className="text-3xl font-bold mb-2">Use Agent: {agent.name}</h1>
        <p className="text-muted-foreground">
          Configure the parameters and run your rented agent
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Workflow Configuration */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              {workflowData && (
                <div className="space-y-6">
                  {workflowData.nodes.map((node) => (
                    <Card key={node.id} className="p-4">
                      <h3 className="font-semibold mb-4">{node.data.label}</h3>
                      <div className="space-y-4">
                        {node.type === 'trigger' && (
                          <>
                            <div>
                              <Label htmlFor={`url-${node.id}`}>Webhook URL</Label>
                              <Input
                                id={`url-${node.id}`}
                                value={inputs[node.id]?.url || ''}
                                onChange={(e) => handleInputChange(node.id, 'url', e.target.value)}
                                placeholder="https://your-app.com/webhook"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`method-${node.id}`}>HTTP Method</Label>
                              <Select
                                value={inputs[node.id]?.method || 'POST'}
                                onValueChange={(value) => handleInputChange(node.id, 'method', value)}
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
                          </>
                        )}
                        {node.type === 'ai' && (
                          <div>
                            <Label htmlFor={`prompt-${node.id}`}>Prompt</Label>
                            <Textarea
                              id={`prompt-${node.id}`}
                              value={inputs[node.id]?.prompt || node.data.config?.prompt || ''}
                              onChange={(e) => handleInputChange(node.id, 'prompt', e.target.value)}
                              placeholder="Enter your prompt..."
                              rows={4}
                            />
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Agent Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Owner</Label>
                <p className="text-sm text-muted-foreground">{agent.owner}</p>
              </div>
              <div>
                <Label>Category</Label>
                <Badge>{agent.category}</Badge>
              </div>
              <div>
                <Label>Price per Use</Label>
                <p className="font-medium">{agent.pricePerUse} ETH</p>
              </div>
              <Button
                onClick={handleRun}
                disabled={isRunning}
                className="w-full"
              >
                {isRunning ? 'Running...' : 'Run Agent'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

export default UseAgentPage