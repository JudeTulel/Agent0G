import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  Download, 
  Play, 
  CheckCircle, 
  Loader2, 
  AlertCircle,
  FileText,
  Globe,
  Bot,
  FileDown
} from 'lucide-react';

const ResearchDashboard = () => {
  const { address, isConnected } = useAccount();
  const [query, setQuery] = useState('');
  const [numResults, setNumResults] = useState('5');
  const [providerAddress, setProviderAddress] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const steps = [
    { name: 'Google Search', icon: Search, description: 'Searching for relevant sources' },
    { name: 'Web Scraping', icon: Globe, description: 'Extracting content from web pages' },
    { name: 'Data Formatting', icon: FileText, description: 'Preparing data for AI analysis' },
    { name: 'AI Analysis', icon: Bot, description: 'Analyzing and summarizing content' },
    { name: 'Report Generation', icon: FileDown, description: 'Creating downloadable markdown report' }
  ];

  const handleExecuteWorkflow = async () => {
    if (!query.trim() || !providerAddress.trim() || !isConnected) {
      setError('Please fill in all required fields and connect your wallet.');
      return;
    }

    setIsRunning(true);
    setCurrentStep(0);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/execute-research-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          userAddress: address,
          providerAddress: providerAddress.trim(),
          numResults: parseInt(numResults)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Workflow execution failed');
      }

      const data = await response.json();
      setResults(data);
      setCurrentStep(steps.length);
    } catch (err) {
      console.error('Workflow execution error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsRunning(false);
    }
  };

  const handleDownloadReport = () => {
    if (results?.downloadUrl) {
      window.open(results.downloadUrl, '_blank');
    }
  };

  const progress = isRunning ? (currentStep / steps.length) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            AI-Powered Web Research
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="research-query">Research Query</Label>
            <Input
              id="research-query"
              placeholder="Enter your research topic (e.g., 'latest developments in renewable energy')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="num-results">Number of Sources</Label>
              <Select value={numResults} onValueChange={setNumResults}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 sources</SelectItem>
                  <SelectItem value="5">5 sources</SelectItem>
                  <SelectItem value="8">8 sources</SelectItem>
                  <SelectItem value="10">10 sources</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="provider-address">AI Provider Address</Label>
              <Input
                id="provider-address"
                placeholder="0x..."
                value={providerAddress}
                onChange={(e) => setProviderAddress(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleExecuteWorkflow}
            disabled={isRunning || !isConnected || !query.trim() || !providerAddress.trim()}
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Researching...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Research
              </>
            )}
          </Button>

          {!isConnected && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please connect your wallet to execute the research workflow.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {(isRunning || results) && (
        <Card>
          <CardHeader>
            <CardTitle>Research Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Overall Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>

            <div className="space-y-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = currentStep > index;
                const isCurrent = currentStep === index && isRunning;
                const isPending = currentStep < index;

                return (
                  <div
                    key={step.name}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      isCompleted
                        ? 'bg-green-50 border-green-200'
                        : isCurrent
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : isCurrent ? (
                        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                      ) : (
                        <Icon className={`h-5 w-5 ${isPending ? 'text-gray-400' : 'text-blue-600'}`} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {step.name}
                        {isCompleted && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Completed
                          </Badge>
                        )}
                        {isCurrent && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            In Progress
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {step.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Research Complete!
              <Button onClick={handleDownloadReport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Query:</strong> {results.workflow?.query}
              </div>
              <div>
                <strong>Sources Analyzed:</strong> {results.workflow?.steps?.find(s => s.name === 'Web Scraping')?.data?.results?.length || 0}
              </div>
              <div>
                <strong>Report Size:</strong> {results.workflow?.finalReport?.contentLength || 0} characters
              </div>
              <div>
                <strong>Execution Time:</strong> {
                  results.workflow?.endTime && results.workflow?.startTime
                    ? `${Math.round((new Date(results.workflow.endTime) - new Date(results.workflow.startTime)) / 1000)}s`
                    : 'N/A'
                }
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-2">Research Summary Preview</h4>
              <Textarea
                value={results.workflow?.steps?.find(s => s.name === 'AI Analysis')?.data?.response?.substring(0, 500) + '...' || 'No preview available'}
                readOnly
                rows={6}
                className="text-sm"
              />
            </div>

            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                Your complete research report has been generated and is ready for download. 
                The report includes executive summary, detailed analysis, key findings, and source references.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ResearchDashboard;
