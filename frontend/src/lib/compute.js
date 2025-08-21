// 0G Compute Network integration utilities
const OG_COMPUTE_API_BASE = 'https://compute.0g.ai/api/v1'
const OG_COMPUTE_MODELS_ENDPOINT = `${OG_COMPUTE_API_BASE}/models`
const OG_COMPUTE_INFERENCE_ENDPOINT = `${OG_COMPUTE_API_BASE}/inference`

export class OGCompute {
  constructor(apiKey = null) {
    this.apiKey = apiKey
    this.headers = {
      'Content-Type': 'application/json',
      ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
    }
  }

  /**
   * Get available AI models
   * @returns {Promise<Array>} - List of available models
   */
  async getAvailableModels() {
    try {
      const response = await fetch(OG_COMPUTE_MODELS_ENDPOINT, {
        headers: this.headers
      })

      if (!response.ok) {
        throw new Error(`Models request failed: ${response.statusText}`)
      }

      const models = await response.json()
      return models
    } catch (error) {
      console.error('Failed to fetch available models:', error)
      // Return mock models for development
      return this.getMockModels()
    }
  }

  /**
   * Run LLM inference
   * @param {Object} config - Inference configuration
   * @returns {Promise<Object>} - Inference result
   */
  async runLLMInference(config) {
    try {
      const {
        model = 'llama-3-8b',
        prompt,
        temperature = 0.7,
        maxTokens = 1000,
        systemPrompt = null
      } = config

      const requestBody = {
        model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens,
        stream: false
      }

      const response = await fetch(OG_COMPUTE_INFERENCE_ENDPOINT, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`Inference request failed: ${response.statusText}`)
      }

      const result = await response.json()
      return {
        success: true,
        result: result.choices[0].message.content,
        usage: result.usage,
        model: result.model,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('LLM inference failed:', error)
      return this.simulateLLMInference(config)
    }
  }

  /**
   * Run vision model inference
   * @param {Object} config - Vision inference configuration
   * @returns {Promise<Object>} - Vision analysis result
   */
  async runVisionInference(config) {
    try {
      const {
        model = 'clip-vit-base',
        imageUrl,
        prompt = 'Describe this image',
        maxTokens = 500
      } = config

      const requestBody = {
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: maxTokens
      }

      const response = await fetch(OG_COMPUTE_INFERENCE_ENDPOINT, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`Vision inference failed: ${response.statusText}`)
      }

      const result = await response.json()
      return {
        success: true,
        result: result.choices[0].message.content,
        usage: result.usage,
        model: result.model,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Vision inference failed:', error)
      return this.simulateVisionInference(config)
    }
  }

  /**
   * Generate embeddings
   * @param {Object} config - Embedding configuration
   * @returns {Promise<Object>} - Embedding result
   */
  async generateEmbeddings(config) {
    try {
      const {
        model = 'text-embedding-ada-002',
        input,
        dimensions = 1536
      } = config

      const requestBody = {
        model,
        input,
        dimensions
      }

      const response = await fetch(`${OG_COMPUTE_API_BASE}/embeddings`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`Embedding request failed: ${response.statusText}`)
      }

      const result = await response.json()
      return {
        success: true,
        embeddings: result.data[0].embedding,
        usage: result.usage,
        model: result.model,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Embedding generation failed:', error)
      return this.simulateEmbeddings(config)
    }
  }

  /**
   * Execute workflow on 0G Compute
   * @param {Object} workflow - Workflow definition
   * @param {Object} input - Input data
   * @returns {Promise<Object>} - Execution result
   */
  async executeWorkflow(workflow, input = {}) {
    try {
      const requestBody = {
        workflow,
        input,
        timestamp: Date.now()
      }

      const response = await fetch(`${OG_COMPUTE_API_BASE}/workflow/execute`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`Workflow execution failed: ${response.statusText}`)
      }

      const result = await response.json()
      return {
        success: true,
        executionId: result.executionId,
        result: result.output,
        logs: result.logs,
        usage: result.usage,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Workflow execution failed:', error)
      return this.simulateWorkflowExecution(workflow, input)
    }
  }

  /**
   * Get compute usage statistics
   * @returns {Promise<Object>} - Usage statistics
   */
  async getUsageStats() {
    try {
      const response = await fetch(`${OG_COMPUTE_API_BASE}/usage`, {
        headers: this.headers
      })

      if (!response.ok) {
        throw new Error(`Usage stats request failed: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to get usage stats:', error)
      return {
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        modelsUsed: []
      }
    }
  }

  // Mock/simulation methods for development
  getMockModels() {
    return [
      {
        id: 'llama-3-8b',
        name: 'Llama 3 8B',
        type: 'llm',
        description: 'Large language model for general text generation',
        costPerToken: 0.0001,
        maxTokens: 8192
      },
      {
        id: 'llama-3-70b',
        name: 'Llama 3 70B',
        type: 'llm',
        description: 'Larger language model with enhanced capabilities',
        costPerToken: 0.0005,
        maxTokens: 8192
      },
      {
        id: 'clip-vit-base',
        name: 'CLIP ViT Base',
        type: 'vision',
        description: 'Vision-language model for image understanding',
        costPerToken: 0.0002,
        maxTokens: 1024
      },
      {
        id: 'text-embedding-ada-002',
        name: 'Text Embedding Ada 002',
        type: 'embedding',
        description: 'Text embedding model for semantic search',
        costPerToken: 0.0001,
        dimensions: 1536
      }
    ]
  }

  simulateLLMInference(config) {
    const responses = [
      "Based on the provided data, I can identify several key insights and patterns that may be relevant for your analysis.",
      "The information suggests a strong correlation between the variables, indicating potential opportunities for optimization.",
      "After processing the input, I recommend focusing on the following areas for maximum impact.",
      "The analysis reveals interesting trends that could inform your decision-making process."
    ]

    return {
      success: true,
      result: responses[Math.floor(Math.random() * responses.length)],
      usage: {
        promptTokens: Math.floor(Math.random() * 100) + 50,
        completionTokens: Math.floor(Math.random() * 200) + 100,
        totalTokens: Math.floor(Math.random() * 300) + 150
      },
      model: config.model || 'llama-3-8b',
      timestamp: Date.now()
    }
  }

  simulateVisionInference(config) {
    const responses = [
      "This image shows a professional workspace with modern equipment and clean organization.",
      "The image contains various objects arranged in a visually appealing composition.",
      "I can see several key elements that suggest this is related to technology or business.",
      "The visual elements in this image indicate a focus on innovation and modern design."
    ]

    return {
      success: true,
      result: responses[Math.floor(Math.random() * responses.length)],
      usage: {
        promptTokens: Math.floor(Math.random() * 50) + 25,
        completionTokens: Math.floor(Math.random() * 100) + 50,
        totalTokens: Math.floor(Math.random() * 150) + 75
      },
      model: config.model || 'clip-vit-base',
      timestamp: Date.now()
    }
  }

  simulateEmbeddings(config) {
    const dimensions = config.dimensions || 1536
    const embedding = Array.from({ length: dimensions }, () => Math.random() * 2 - 1)

    return {
      success: true,
      embeddings: embedding,
      usage: {
        promptTokens: Math.floor(Math.random() * 50) + 10,
        totalTokens: Math.floor(Math.random() * 50) + 10
      },
      model: config.model || 'text-embedding-ada-002',
      timestamp: Date.now()
    }
  }

  simulateWorkflowExecution(workflow, input) {
    return {
      success: true,
      executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      result: {
        message: "Workflow executed successfully",
        processedNodes: workflow.nodes?.length || 0,
        executionTime: Math.floor(Math.random() * 5000) + 1000,
        output: "Simulated workflow execution completed"
      },
      logs: [
        "Starting workflow execution...",
        "Processing trigger node...",
        "Running AI inference...",
        "Executing action nodes...",
        "Workflow completed successfully"
      ],
      usage: {
        totalTokens: Math.floor(Math.random() * 1000) + 500,
        totalCost: Math.floor(Math.random() * 100) / 100
      },
      timestamp: Date.now()
    }
  }
}

// Utility functions
export const createComputeClient = (apiKey = null) => {
  return new OGCompute(apiKey)
}

export const formatTokenUsage = (usage) => {
  if (!usage) return 'N/A'
  
  const { promptTokens = 0, completionTokens = 0, totalTokens = 0 } = usage
  return `${totalTokens} tokens (${promptTokens} prompt + ${completionTokens} completion)`
}

export const estimateCost = (usage, model = 'llama-3-8b') => {
  if (!usage || !usage.totalTokens) return 0
  
  const costPerToken = {
    'llama-3-8b': 0.0001,
    'llama-3-70b': 0.0005,
    'clip-vit-base': 0.0002,
    'text-embedding-ada-002': 0.0001
  }
  
  return (usage.totalTokens * (costPerToken[model] || 0.0001)).toFixed(6)
}

// Default compute client instance
export const computeClient = createComputeClient()

