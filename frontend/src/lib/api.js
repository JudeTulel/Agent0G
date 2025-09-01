const API_BASE = process.env.BACKEND_URL || 'http://localhost:4000/api';

// Compute provider management
export const listComputeProviders = async () => {
  const response = await fetch(`${API_BASE}/services`);
  if (!response.ok) {
    throw new Error(`Failed to fetch compute providers: ${response.statusText}`);
  }
  return response.json();
};

export const submitWorkflow = async (workflow, selectedProvider, files = []) => {
  const formData = new FormData();
  formData.append('workflow', JSON.stringify(workflow));
  formData.append('providerAddress', selectedProvider);
  
  // Append any files if present
  files.forEach((file, index) => {
    formData.append(`file${index}`, file);
  });

  const response = await fetch(`${API_BASE}/workflow/submit`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Failed to submit workflow: ${response.statusText}`);
  }
  return response.json();
};

// Storage operations
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/storage/upload`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Failed to upload file: ${response.statusText}`);
  }
  return response.json();
};

export const downloadFile = async (rootHash, filename) => {
  const response = await fetch(`${API_BASE}/storage/download/${rootHash}?filename=${encodeURIComponent(filename)}`);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  return response.blob();
};

// KV Storage operations
export const storeKVData = async (streamId, key, value) => {
  const response = await fetch(`${API_BASE}/storage/kv/store`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ streamId, key, value })
  });

  if (!response.ok) {
    throw new Error(`Failed to store KV data: ${response.statusText}`);
  }
  return response.json();
};

export const retrieveKVData = async (streamId, key) => {
  const response = await fetch(`${API_BASE}/storage/kv/${streamId}/${encodeURIComponent(key)}`);
  if (!response.ok) {
    throw new Error(`Failed to retrieve KV data: ${response.statusText}`);
  }
  return response.json();
};
