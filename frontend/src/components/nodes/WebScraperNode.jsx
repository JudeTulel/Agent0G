import React, { useState, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Globe2, FileText, Image, Link, Clock } from 'lucide-react';

const WebScraperNode = ({ data, id, selected }) => {
  const [extractionMode, setExtractionMode] = useState(data.extractionMode || 'text');
  const [selectors, setSelectors] = useState(data.selectors || '');
  const [includeImages, setIncludeImages] = useState(data.includeImages || false);
  const [includeLinks, setIncludeLinks] = useState(data.includeLinks || false);
  const [includeMetadata, setIncludeMetadata] = useState(data.includeMetadata || true);
  const [timeout, setTimeout] = useState(data.timeout || [30]);
  const [userAgent, setUserAgent] = useState(data.userAgent || 'default');
  const [followRedirects, setFollowRedirects] = useState(data.followRedirects !== false);
  const [respectRobots, setRespectRobots] = useState(data.respectRobots !== false);

  const handleExtractionModeChange = useCallback((value) => {
    setExtractionMode(value);
    data.onChange?.(id, { ...data, extractionMode: value });
  }, [data, id]);

  const handleSelectorsChange = useCallback((e) => {
    const newSelectors = e.target.value;
    setSelectors(newSelectors);
    data.onChange?.(id, { ...data, selectors: newSelectors });
  }, [data, id]);

  const handleIncludeImagesChange = useCallback((checked) => {
    setIncludeImages(checked);
    data.onChange?.(id, { ...data, includeImages: checked });
  }, [data, id]);

  const handleIncludeLinksChange = useCallback((checked) => {
    setIncludeLinks(checked);
    data.onChange?.(id, { ...data, includeLinks: checked });
  }, [data, id]);

  const handleIncludeMetadataChange = useCallback((checked) => {
    setIncludeMetadata(checked);
    data.onChange?.(id, { ...data, includeMetadata: checked });
  }, [data, id]);

  const handleTimeoutChange = useCallback((value) => {
    setTimeout(value);
    data.onChange?.(id, { ...data, timeout: value[0] });
  }, [data, id]);

  const handleUserAgentChange = useCallback((value) => {
    setUserAgent(value);
    data.onChange?.(id, { ...data, userAgent: value });
  }, [data, id]);

  const handleFollowRedirectsChange = useCallback((checked) => {
    setFollowRedirects(checked);
    data.onChange?.(id, { ...data, followRedirects: checked });
  }, [data, id]);

  const handleRespectRobotsChange = useCallback((checked) => {
    setRespectRobots(checked);
    data.onChange?.(id, { ...data, respectRobots: checked });
  }, [data, id]);

  return (
    <Card className={`min-w-[320px] ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Globe2 className="h-4 w-4 text-blue-600" />
          Web Scraper
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Extraction Mode</Label>
          <Select value={extractionMode} onValueChange={handleExtractionModeChange}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text Content</SelectItem>
              <SelectItem value="markdown">Markdown</SelectItem>
              <SelectItem value="html">Raw HTML</SelectItem>
              <SelectItem value="structured">Structured Data</SelectItem>
              <SelectItem value="custom">Custom Selectors</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {extractionMode === 'custom' && (
          <div>
            <Label htmlFor="selectors" className="text-xs">CSS Selectors</Label>
            <Input
              id="selectors"
              placeholder="e.g., article, .content, #main"
              value={selectors}
              onChange={handleSelectorsChange}
              className="mt-1"
            />
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-xs font-medium">Content Options</Label>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-images"
              checked={includeImages}
              onCheckedChange={handleIncludeImagesChange}
            />
            <Label htmlFor="include-images" className="text-xs flex items-center gap-1">
              <Image className="h-3 w-3" />
              Include Images
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-links"
              checked={includeLinks}
              onCheckedChange={handleIncludeLinksChange}
            />
            <Label htmlFor="include-links" className="text-xs flex items-center gap-1">
              <Link className="h-3 w-3" />
              Include Links
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-metadata"
              checked={includeMetadata}
              onCheckedChange={handleIncludeMetadataChange}
            />
            <Label htmlFor="include-metadata" className="text-xs flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Include Metadata
            </Label>
          </div>
        </div>

        <div>
          <Label className="text-xs">Timeout: {timeout[0]}s</Label>
          <Slider
            value={timeout}
            onValueChange={handleTimeoutChange}
            max={120}
            min={5}
            step={5}
            className="mt-2"
          />
        </div>

        <div>
          <Label className="text-xs">User Agent</Label>
          <Select value={userAgent} onValueChange={handleUserAgentChange}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Browser</SelectItem>
              <SelectItem value="chrome">Chrome Desktop</SelectItem>
              <SelectItem value="firefox">Firefox Desktop</SelectItem>
              <SelectItem value="safari">Safari Desktop</SelectItem>
              <SelectItem value="mobile">Mobile Browser</SelectItem>
              <SelectItem value="bot">Search Bot</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="follow-redirects"
              checked={followRedirects}
              onCheckedChange={handleFollowRedirectsChange}
            />
            <Label htmlFor="follow-redirects" className="text-xs">
              Follow Redirects
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="respect-robots"
              checked={respectRobots}
              onCheckedChange={handleRespectRobotsChange}
            />
            <Label htmlFor="respect-robots" className="text-xs">
              Respect robots.txt
            </Label>
          </div>
        </div>

        <div className="text-xs text-muted-foreground mt-3 p-2 bg-muted rounded">
          <Clock className="h-3 w-3 inline mr-1" />
          Extracts content from web pages with configurable options
        </div>
      </CardContent>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#3b82f6' }}
      />
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#3b82f6' }}
      />
    </Card>
  );
};

export default WebScraperNode;
