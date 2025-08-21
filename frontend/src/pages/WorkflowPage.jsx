import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import WorkflowBuilder from '../components/WorkflowBuilder'
import Header from '../components/Header'

import { 
  ArrowLeft,
  Settings,
  Play,
  Save,
  Share,
  History,
  Code,
  Eye
} from 'lucide-react'

const WorkflowPage = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('builder')

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Workflow Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Marketplace
              </Button>
              
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                  <Code className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">AI Agent Workflow Builder</h1>
                  <p className="text-sm text-muted-foreground">Create and deploy AI agent workflows</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">Draft</Badge>
              <Button variant="outline" size="sm">
                <History className="h-4 w-4 mr-2" />
                Version History
              </Button>
              <Button variant="outline" size="sm">
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save & Deploy
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Tabs */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="builder" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Builder</span>
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center space-x-2">
              <Eye className="h-4 w-4" />
              <span>Preview</span>
            </TabsTrigger>
            <TabsTrigger value="code" className="flex items-center space-x-2">
              <Code className="h-4 w-4" />
              <span>Code</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="mt-4">
            <div className="h-[calc(100vh-200px)] border rounded-lg overflow-hidden">
              <WorkflowBuilder />
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Workflow Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Workflow preview will be shown here</p>
                  <p className="text-sm">Execute your workflow to see the results</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="code" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Generated Code</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                  <pre className="text-muted-foreground">
{`// Generated AI Agent Workflow
// This code will be deployed to 0G Compute Network

export default async function workflow(input) {
  // Step 1: Webhook Trigger
  const triggerData = await handleWebhookTrigger(input);
  
  // Step 2: LLM Processing via 0G Compute
  const aiResult = await processWithLLM({
    model: "llama-3-8b",
    prompt: "Analyze the incoming data and extract key insights",
    data: triggerData,
    temperature: 0.7
  });
  
  // Step 3: Send Email Action
  const emailResult = await sendEmail({
    to: "user@example.com",
    subject: "AI Analysis Complete",
    body: aiResult.analysis
  });
  
  return {
    success: true,
    results: {
      trigger: triggerData,
      ai: aiResult,
      email: emailResult
    }
  };
}

// Helper functions
async function handleWebhookTrigger(input) {
  // Webhook handling logic
  return input;
}

async function processWithLLM(config) {
  // 0G Compute integration
  const response = await fetch('https://compute.0g.ai/v1/inference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  return response.json();
}

async function sendEmail(config) {
  // Email sending logic
  return { sent: true, messageId: 'msg_' + Date.now() };
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default WorkflowPage

