import React, { useState, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FileText, Code, Wand2, Filter } from 'lucide-react';

const DataFormatterNode = ({ data, id, selected }) => {
  const [promptTemplate, setPromptTemplate] = useState(data.promptTemplate || `Analyze and summarize the following research data:

{{title}}
Source: {{url}}
Content: {{content}}

Please provide:
1. Key insights and findings
2. Main topics covered
3. Important facts and figures
4. Relevant quotes or statistics

Format your response in clear, structured markdown.`);
  
  const [formatType, setFormatType] = useState(data.formatType || 'research');
  const [includeMetadata, setIncludeMetadata] = useState(data.includeMetadata !== false);
  const [includeUrls, setIncludeUrls] = useState(data.includeUrls !== false);
  const [cleanText, setCleanText] = useState(data.cleanText !== false);
  const [maxLength, setMaxLength] = useState(data.maxLength || 'auto');

  const handlePromptTemplateChange = useCallback((e) => {
    const newTemplate = e.target.value;
    setPromptTemplate(newTemplate);
    data.onChange?.(id, { ...data, promptTemplate: newTemplate });
  }, [data, id]);

  const handleFormatTypeChange = useCallback((value) => {
    setFormatType(value);
    
    // Auto-update prompt template based on format type
    let newTemplate = promptTemplate;
    switch (value) {
      case 'research':
        newTemplate = `Analyze and summarize the following research data:

{{title}}
Source: {{url}}
Content: {{content}}

Please provide:
1. Key insights and findings
2. Main topics covered
3. Important facts and figures
4. Relevant quotes or statistics

Format your response in clear, structured markdown.`;
        break;
      case 'news':
        newTemplate = `Summarize this news article:

Title: {{title}}
Source: {{url}}
Content: {{content}}

Please provide:
- Main story summary
- Key facts
- Important people mentioned
- Timeline of events (if applicable)

Format as a clear news summary.`;
        break;
      case 'technical':
        newTemplate = `Analyze this technical content:

{{title}}
Source: {{url}}
Content: {{content}}

Please extract:
- Technical concepts explained
- Code examples or methods
- Implementation details
- Best practices mentioned

Provide a technical summary in markdown.`;
        break;
      case 'comparison':
        newTemplate = `Compare and analyze the following information:

{{title}}
Source: {{url}}
Content: {{content}}

Create a comparison focusing on:
- Key differences
- Advantages/disadvantages
- Use cases
- Recommendations

Format as a structured comparison in markdown.`;
        break;
      default:
        break;
    }
    
    setPromptTemplate(newTemplate);
    data.onChange?.(id, { ...data, formatType: value, promptTemplate: newTemplate });
  }, [data, id, promptTemplate]);

  const handleIncludeMetadataChange = useCallback((checked) => {
    setIncludeMetadata(checked);
    data.onChange?.(id, { ...data, includeMetadata: checked });
  }, [data, id]);

  const handleIncludeUrlsChange = useCallback((checked) => {
    setIncludeUrls(checked);
    data.onChange?.(id, { ...data, includeUrls: checked });
  }, [data, id]);

  const handleCleanTextChange = useCallback((checked) => {
    setCleanText(checked);
    data.onChange?.(id, { ...data, cleanText: checked });
  }, [data, id]);

  const handleMaxLengthChange = useCallback((value) => {
    setMaxLength(value);
    data.onChange?.(id, { ...data, maxLength: value });
  }, [data, id]);

  const availableVariables = [
    { name: '{{title}}', desc: 'Page title' },
    { name: '{{url}}', desc: 'Source URL' },
    { name: '{{content}}', desc: 'Main content' },
    { name: '{{description}}', desc: 'Meta description' },
    { name: '{{keywords}}', desc: 'Keywords' },
    { name: '{{author}}', desc: 'Author' },
    { name: '{{date}}', desc: 'Publication date' },
  ];

  return (
    <Card className={`min-w-[350px] ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-orange-600" />
          Data Formatter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Format Type</Label>
          <Select value={formatType} onValueChange={handleFormatTypeChange}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="research">Research Analysis</SelectItem>
              <SelectItem value="news">News Summary</SelectItem>
              <SelectItem value="technical">Technical Documentation</SelectItem>
              <SelectItem value="comparison">Comparison Analysis</SelectItem>
              <SelectItem value="custom">Custom Template</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="prompt-template" className="text-xs">Prompt Template</Label>
          <Textarea
            id="prompt-template"
            placeholder="Enter your prompt template..."
            value={promptTemplate}
            onChange={handlePromptTemplateChange}
            className="mt-1 min-h-[120px] text-xs font-mono"
          />
        </div>

        <div>
          <Label className="text-xs font-medium">Available Variables</Label>
          <div className="flex flex-wrap gap-1 mt-2">
            {availableVariables.map((variable) => (
              <Badge
                key={variable.name}
                variant="outline"
                className="text-xs cursor-help"
                title={variable.desc}
              >
                {variable.name}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-medium">Processing Options</Label>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-metadata"
              checked={includeMetadata}
              onCheckedChange={handleIncludeMetadataChange}
            />
            <Label htmlFor="include-metadata" className="text-xs">
              Include Metadata
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-urls"
              checked={includeUrls}
              onCheckedChange={handleIncludeUrlsChange}
            />
            <Label htmlFor="include-urls" className="text-xs">
              Include Source URLs
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="clean-text"
              checked={cleanText}
              onCheckedChange={handleCleanTextChange}
            />
            <Label htmlFor="clean-text" className="text-xs">
              Clean and normalize text
            </Label>
          </div>
        </div>

        <div>
          <Label className="text-xs">Content Length Limit</Label>
          <Select value={maxLength} onValueChange={handleMaxLengthChange}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (Optimal)</SelectItem>
              <SelectItem value="short">Short (1000 chars)</SelectItem>
              <SelectItem value="medium">Medium (2500 chars)</SelectItem>
              <SelectItem value="long">Long (5000 chars)</SelectItem>
              <SelectItem value="full">Full Content</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground mt-3 p-2 bg-muted rounded">
          <Wand2 className="h-3 w-3 inline mr-1" />
          Formats scraped data into structured prompts for AI analysis
        </div>
      </CardContent>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#f97316' }}
      />
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#f97316' }}
      />
    </Card>
  );
};

export default DataFormatterNode;
