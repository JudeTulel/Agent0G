import React, { useState, useCallback } from 'react';
import { Handle, Position } from 'reactflow';

const HttpRequestNode = ({ data, id }) => {
  const [method, setMethod] = useState(data.method || 'GET');
  const [url, setUrl] = useState(data.url || '');
  const [headers, setHeaders] = useState(data.headers || []);
  const [body, setBody] = useState(data.body || '');
  const [authType, setAuthType] = useState(data.authType || 'none');
  const [authData, setAuthData] = useState(data.authData || {});

  const handleMethodChange = useCallback((e) => {
    setMethod(e.target.value);
    data.onChange?.(id, { ...data, method: e.target.value });
  }, [data, id]);

  const handleUrlChange = useCallback((e) => {
    setUrl(e.target.value);
    data.onChange?.(id, { ...data, url: e.target.value });
  }, [data, id]);

  const handleHeaderChange = useCallback((index, field, value) => {
    const newHeaders = [...headers];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    setHeaders(newHeaders);
    data.onChange?.(id, { ...data, headers: newHeaders });
  }, [headers, data, id]);

  const addHeader = useCallback(() => {
    const newHeaders = [...headers, { key: '', value: '' }];
    setHeaders(newHeaders);
    data.onChange?.(id, { ...data, headers: newHeaders });
  }, [headers, data, id]);

  const removeHeader = useCallback((index) => {
    const newHeaders = headers.filter((_, i) => i !== index);
    setHeaders(newHeaders);
    data.onChange?.(id, { ...data, headers: newHeaders });
  }, [headers, data, id]);

  const handleBodyChange = useCallback((e) => {
    setBody(e.target.value);
    data.onChange?.(id, { ...data, body: e.target.value });
  }, [data, id]);

  const handleAuthTypeChange = useCallback((e) => {
    setAuthType(e.target.value);
    data.onChange?.(id, { ...data, authType: e.target.value });
  }, [data, id]);

  const handleAuthDataChange = useCallback((field, value) => {
    const newAuthData = { ...authData, [field]: value };
    setAuthData(newAuthData);
    data.onChange?.(id, { ...data, authData: newAuthData });
  }, [authData, data, id]);

  return (
    <div className="bg-white border-2 border-blue-300 rounded-lg p-4 shadow-lg min-w-[300px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500" />

      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">HTTP Request</h3>

        <div className="flex gap-2 mb-2">
          <select
            value={method}
            onChange={handleMethodChange}
            className="px-2 py-1 border border-gray-300 rounded text-sm flex-1"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        <input
          type="text"
          placeholder="https://api.example.com/endpoint"
          value={url}
          onChange={handleUrlChange}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
        />

        <div className="mb-2">
          <label className="block text-xs text-gray-600 mb-1">Headers</label>
          {headers.map((header, index) => (
            <div key={index} className="flex gap-1 mb-1">
              <input
                type="text"
                placeholder="Key"
                value={header.key}
                onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
              />
              <input
                type="text"
                placeholder="Value"
                value={header.value}
                onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
              />
              <button
                onClick={() => removeHeader(index)}
                className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={addHeader}
            className="w-full px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
          >
            Add Header
          </button>
        </div>

        {(method === 'POST' || method === 'PUT' || method === 'PATCH') && (
          <div className="mb-2">
            <label className="block text-xs text-gray-600 mb-1">Request Body</label>
            <textarea
              value={body}
              onChange={handleBodyChange}
              placeholder="JSON or text body"
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs h-16 resize-none"
            />
          </div>
        )}

        <div className="mb-2">
          <label className="block text-xs text-gray-600 mb-1">Authentication</label>
          <select
            value={authType}
            onChange={handleAuthTypeChange}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="none">None</option>
            <option value="basic">Basic Auth</option>
            <option value="bearer">Bearer Token</option>
            <option value="apiKey">API Key</option>
          </select>
        </div>

        {authType === 'basic' && (
          <div className="flex gap-1 mb-2">
            <input
              type="text"
              placeholder="Username"
              value={authData.username || ''}
              onChange={(e) => handleAuthDataChange('username', e.target.value)}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
            />
            <input
              type="password"
              placeholder="Password"
              value={authData.password || ''}
              onChange={(e) => handleAuthDataChange('password', e.target.value)}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
            />
          </div>
        )}

        {authType === 'bearer' && (
          <input
            type="text"
            placeholder="Bearer Token"
            value={authData.token || ''}
            onChange={(e) => handleAuthDataChange('token', e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-xs mb-2"
          />
        )}

        {authType === 'apiKey' && (
          <div className="flex gap-1 mb-2">
            <input
              type="text"
              placeholder="API Key"
              value={authData.apiKey || ''}
              onChange={(e) => handleAuthDataChange('apiKey', e.target.value)}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
            />
            <input
              type="text"
              placeholder="Header Name"
              value={authData.headerName || ''}
              onChange={(e) => handleAuthDataChange('headerName', e.target.value)}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
            />
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500" />
    </div>
  );
};

export default HttpRequestNode;
