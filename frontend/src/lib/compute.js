export const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:3001';

// Backend endpoints map
export const endpoints = {
  health: '/api/health',
  accountBalance: '/api/account-balance',
  fundAccount: '/api/fund-account',
  refund: '/api/refund',
  addLedger: '/api/add-ledger',
  services: '/api/services',
  acknowledge: '/api/acknowledge',
  inference: '/api/inference',
  storageUpload: '/api/storage/upload',
  storageFiles: '/api/storage/files',
};

export async function apiRequest(path, method = 'GET', body, extraHeaders) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const errMsg = typeof data === 'string' ? data : data?.error || 'Request failed';
    throw new Error(errMsg);
  }
  return data;
}

export const getHealth = () => apiRequest(endpoints.health);
export const getAccountBalance = () => apiRequest(endpoints.accountBalance);
export const getServices = () => apiRequest(endpoints.services);
export const fundAccount = (amount) => apiRequest(endpoints.fundAccount, 'POST', { amount });
// refund can take serviceType and/or amount (OG)
export const refund = (opts = {}) => apiRequest(endpoints.refund, 'POST', opts);
export const addLedger = (amount) => apiRequest(endpoints.addLedger, 'POST', { amount });
export const acknowledge = (providerAddress) => apiRequest(endpoints.acknowledge, 'POST', { providerAddress });

// Inference expects providerAddress, prompt, userAddress
export const inference = (providerAddress, prompt, userAddress) =>
  apiRequest(endpoints.inference, 'POST', { providerAddress, prompt, userAddress });

// Storage: upload via multipart must be handled by caller (FormData)
export const listFiles = () => apiRequest(endpoints.storageFiles);