import React, { useState, useCallback, useEffect } from 'react';
import { Handle, Position } from 'reactflow';

const GoogleSheetsNode = ({ data, id }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState(data.selectedSpreadsheet || '');
  const [selectedSheet, setSelectedSheet] = useState(data.selectedSheet || '');
  const [sheets, setSheets] = useState([]);
  const [range, setRange] = useState(data.range || 'A1:Z100');
  const [operation, setOperation] = useState(data.operation || 'read');
  const [isLoading, setIsLoading] = useState(false);

  // Google OAuth configuration
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
  const REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI || window.location.origin;

  const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly'
  ].join(' ');

  useEffect(() => {
    // Check if user is already authenticated
    const token = localStorage.getItem('google_access_token');
    const expiry = localStorage.getItem('google_token_expiry');

    if (token && expiry && Date.now() < parseInt(expiry)) {
      setIsAuthenticated(true);
      loadSpreadsheets();
    }
  }, []);

  const handleAuth = useCallback(() => {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${REDIRECT_URI}&` +
      `scope=${encodeURIComponent(SCOPES)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`;

    window.location.href = authUrl;
  }, [GOOGLE_CLIENT_ID, REDIRECT_URI, SCOPES]);

  const exchangeCodeForToken = useCallback(async (code) => {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        }),
      });

      const tokenData = await response.json();

      if (tokenData.access_token) {
        localStorage.setItem('google_access_token', tokenData.access_token);
        localStorage.setItem('google_refresh_token', tokenData.refresh_token);
        localStorage.setItem('google_token_expiry', (Date.now() + (tokenData.expires_in * 1000)).toString());

        setIsAuthenticated(true);
        loadSpreadsheets();
      }
    } catch (error) {
      console.error('Error exchanging code for token:', error);
    }
  }, [GOOGLE_CLIENT_ID, REDIRECT_URI]);

  const loadSpreadsheets = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('google_access_token');

      // Load spreadsheets from Google Drive
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,modifiedTime)`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      setSpreadsheets(data.files || []);
    } catch (error) {
      console.error('Error loading spreadsheets:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSheets = useCallback(async (spreadsheetId) => {
    if (!spreadsheetId) return;

    try {
      const token = localStorage.getItem('google_access_token');

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      const sheetNames = data.sheets?.map(sheet => sheet.properties.title) || [];
      setSheets(sheetNames);
    } catch (error) {
      console.error('Error loading sheets:', error);
    }
  }, []);

  const handleSpreadsheetChange = useCallback((e) => {
    const spreadsheetId = e.target.value;
    setSelectedSpreadsheet(spreadsheetId);
    setSelectedSheet('');
    setSheets([]);
    loadSheets(spreadsheetId);

    data.onChange?.(id, {
      ...data,
      selectedSpreadsheet: spreadsheetId,
      selectedSheet: '',
      sheets: []
    });
  }, [data, id, loadSheets]);

  const handleSheetChange = useCallback((e) => {
    const sheetName = e.target.value;
    setSelectedSheet(sheetName);

    data.onChange?.(id, {
      ...data,
      selectedSheet: sheetName
    });
  }, [data, id]);

  const handleRangeChange = useCallback((e) => {
    setRange(e.target.value);
    data.onChange?.(id, { ...data, range: e.target.value });
  }, [data, id]);

  const handleOperationChange = useCallback((e) => {
    setOperation(e.target.value);
    data.onChange?.(id, { ...data, operation: e.target.value });
  }, [data, id]);

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !isAuthenticated) {
      exchangeCodeForToken(code);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [exchangeCodeForToken, isAuthenticated]);

  return (
    <div className="bg-white border-2 border-green-300 rounded-lg p-4 shadow-lg min-w-[350px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-green-500" />

      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Google Sheets</h3>

        {!isAuthenticated ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-600">Connect to Google to access your spreadsheets</p>
            <button
              onClick={handleAuth}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
            >
              Connect Google Account
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-600 font-medium">✓ Connected</span>
              <button
                onClick={() => {
                  localStorage.removeItem('google_access_token');
                  localStorage.removeItem('google_refresh_token');
                  localStorage.removeItem('google_token_expiry');
                  setIsAuthenticated(false);
                  setSpreadsheets([]);
                  setSelectedSpreadsheet('');
                  setSheets([]);
                }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Disconnect
              </button>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Spreadsheet</label>
              <select
                value={selectedSpreadsheet}
                onChange={handleSpreadsheetChange}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                disabled={isLoading}
              >
                <option value="">
                  {isLoading ? 'Loading spreadsheets...' : 'Select a spreadsheet'}
                </option>
                {spreadsheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedSpreadsheet && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Sheet</label>
                <select
                  value={selectedSheet}
                  onChange={handleSheetChange}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="">Select a sheet</option>
                  {sheets.map((sheetName) => (
                    <option key={sheetName} value={sheetName}>
                      {sheetName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-600 mb-1">Operation</label>
              <select
                value={operation}
                onChange={handleOperationChange}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="read">Read Data</option>
                <option value="write">Write Data</option>
                <option value="append">Append Data</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Range</label>
              <input
                type="text"
                value={range}
                onChange={handleRangeChange}
                placeholder="A1:Z100"
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-green-500" />
    </div>
  );
};

export default GoogleSheetsNode;
