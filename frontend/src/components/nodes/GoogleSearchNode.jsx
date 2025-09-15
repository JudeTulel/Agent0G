import React, { useState, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Search, Globe } from 'lucide-react';

const GoogleSearchNode = ({ data, id, selected }) => {
  const [query, setQuery] = useState(data.query || '');
  const [numResults, setNumResults] = useState(data.numResults || [10]);
  const [language, setLanguage] = useState(data.language || 'en');
  const [region, setRegion] = useState(data.region || 'us');
  const [safeSearch, setSafeSearch] = useState(data.safeSearch || 'moderate');

  const handleQueryChange = useCallback((e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    data.onChange?.(id, { ...data, query: newQuery });
  }, [data, id]);

  const handleNumResultsChange = useCallback((value) => {
    setNumResults(value);
    data.onChange?.(id, { ...data, numResults: value[0] });
  }, [data, id]);

  const handleLanguageChange = useCallback((value) => {
    setLanguage(value);
    data.onChange?.(id, { ...data, language: value });
  }, [data, id]);

  const handleRegionChange = useCallback((value) => {
    setRegion(value);
    data.onChange?.(id, { ...data, region: value });
  }, [data, id]);

  const handleSafeSearchChange = useCallback((value) => {
    setSafeSearch(value);
    data.onChange?.(id, { ...data, safeSearch: value });
  }, [data, id]);

  return (
    <Card className={`min-w-[300px] ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Search className="h-4 w-4 text-green-600" />
          Google Search
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="search-query" className="text-xs">Search Query</Label>
          <Input
            id="search-query"
            placeholder="Enter search query..."
            value={query}
            onChange={handleQueryChange}
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs">Number of Results: {numResults[0]}</Label>
          <Slider
            value={numResults}
            onValueChange={handleNumResultsChange}
            max={50}
            min={1}
            step={1}
            className="mt-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Language</Label>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="it">Italian</SelectItem>
                <SelectItem value="pt">Portuguese</SelectItem>
                <SelectItem value="ru">Russian</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
                <SelectItem value="ko">Korean</SelectItem>
                <SelectItem value="zh">Chinese</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Region</Label>
            <Select value={region} onValueChange={handleRegionChange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us">United States</SelectItem>
                <SelectItem value="uk">United Kingdom</SelectItem>
                <SelectItem value="ca">Canada</SelectItem>
                <SelectItem value="au">Australia</SelectItem>
                <SelectItem value="de">Germany</SelectItem>
                <SelectItem value="fr">France</SelectItem>
                <SelectItem value="es">Spain</SelectItem>
                <SelectItem value="it">Italy</SelectItem>
                <SelectItem value="jp">Japan</SelectItem>
                <SelectItem value="kr">South Korea</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs">Safe Search</Label>
          <Select value={safeSearch} onValueChange={handleSafeSearchChange}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="strict">Strict</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground mt-3 p-2 bg-muted rounded">
          <Globe className="h-3 w-3 inline mr-1" />
          Searches Google for the specified query and returns URLs and snippets
        </div>
      </CardContent>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#10b981' }}
      />
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#10b981' }}
      />
    </Card>
  );
};

export default GoogleSearchNode;
