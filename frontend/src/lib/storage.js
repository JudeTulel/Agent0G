// 0G Storage integration utilities
const OG_STORAGE_API_BASE = 'https://storage.0g.ai/api/v1'
const OG_STORAGE_GATEWAY = 'https://gateway.0g.ai'

export class OGStorage {
  constructor(apiKey = null) {
    this.apiKey = apiKey
    this.headers = {
      'Content-Type': 'application/json',
      ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
    }
  }

  /**
   * Upload workflow data to 0G Storage
   * @param {Object} workflow - The workflow object to store
   * @returns {Promise<string>} - The storage hash
   */
  async uploadWorkflow(workflow) {
    try {
      const workflowData = {
        ...workflow,
        timestamp: Date.now(),
        version: '1.0.0'
      }

      const response = await fetch(`${OG_STORAGE_API_BASE}/upload`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          data: workflowData,
          metadata: {
            type: 'ai-agent-workflow',
            name: workflow.metadata?.name || 'Untitled Workflow',
            description: workflow.metadata?.description || '',
            tags: ['ai-agent', 'workflow', '0g-chain']
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()
      return result.hash
    } catch (error) {
      console.error('Failed to upload workflow to 0G Storage:', error)
      // Fallback to local storage simulation
      return this.simulateUpload(workflow)
    }
  }

  /**
   * Retrieve workflow data from 0G Storage
   * @param {string} hash - The storage hash
   * @returns {Promise<Object>} - The workflow object
   */
  async downloadWorkflow(hash) {
    try {
      const response = await fetch(`${OG_STORAGE_GATEWAY}/${hash}`, {
        headers: this.headers
      })

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`)
      }

      const workflow = await response.json()
      return workflow
    } catch (error) {
      console.error('Failed to download workflow from 0G Storage:', error)
      // Fallback to local storage simulation
      return this.simulateDownload(hash)
    }
  }

  /**
   * Upload agent metadata to 0G Storage
   * @param {Object} agentData - The agent metadata
   * @returns {Promise<string>} - The storage hash
   */
  async uploadAgentMetadata(agentData) {
    try {
      const metadata = {
        ...agentData,
        timestamp: Date.now(),
        version: '1.0.0'
      }

      const response = await fetch(`${OG_STORAGE_API_BASE}/upload`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          data: metadata,
          metadata: {
            type: 'ai-agent-metadata',
            name: agentData.name || 'Untitled Agent',
            description: agentData.description || '',
            tags: ['ai-agent', 'metadata', '0g-chain']
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()
      return result.hash
    } catch (error) {
      console.error('Failed to upload agent metadata to 0G Storage:', error)
      return this.simulateUpload(agentData)
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} - Storage statistics
   */
  async getStorageStats() {
    try {
      const response = await fetch(`${OG_STORAGE_API_BASE}/stats`, {
        headers: this.headers
      })

      if (!response.ok) {
        throw new Error(`Stats request failed: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to get storage stats:', error)
      return {
        totalFiles: 0,
        totalSize: 0,
        availableSpace: 1000000000, // 1GB
        usedSpace: 0
      }
    }
  }

  /**
   * List stored workflows
   * @returns {Promise<Array>} - List of workflow metadata
   */
  async listWorkflows() {
    try {
      const response = await fetch(`${OG_STORAGE_API_BASE}/list?type=ai-agent-workflow`, {
        headers: this.headers
      })

      if (!response.ok) {
        throw new Error(`List request failed: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to list workflows:', error)
      return []
    }
  }

  /**
   * Delete workflow from storage
   * @param {string} hash - The storage hash
   * @returns {Promise<boolean>} - Success status
   */
  async deleteWorkflow(hash) {
    try {
      const response = await fetch(`${OG_STORAGE_API_BASE}/delete/${hash}`, {
        method: 'DELETE',
        headers: this.headers
      })

      return response.ok
    } catch (error) {
      console.error('Failed to delete workflow:', error)
      return false
    }
  }

  // Simulation methods for development/testing
  simulateUpload(data) {
    const hash = this.generateHash(JSON.stringify(data))
    localStorage.setItem(`og_storage_${hash}`, JSON.stringify(data))
    return hash
  }

  simulateDownload(hash) {
    const data = localStorage.getItem(`og_storage_${hash}`)
    return data ? JSON.parse(data) : null
  }

  generateHash(data) {
    // Simple hash generation for simulation
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`
  }
}

// Utility functions
export const createStorageClient = (apiKey = null) => {
  return new OGStorage(apiKey)
}

export const formatStorageSize = (bytes) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

export const validateWorkflowData = (workflow) => {
  if (!workflow || typeof workflow !== 'object') {
    throw new Error('Invalid workflow data')
  }

  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    throw new Error('Workflow must contain nodes array')
  }

  if (!workflow.edges || !Array.isArray(workflow.edges)) {
    throw new Error('Workflow must contain edges array')
  }

  return true
}

// Default storage client instance
export const storageClient = createStorageClient()

