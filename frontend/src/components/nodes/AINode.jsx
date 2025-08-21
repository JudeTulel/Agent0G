import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Brain, Eye, Layers, Cpu } from 'lucide-react'

const AINode = ({ data, selected }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'llm':
        return <Brain className="h-4 w-4" />
      case 'vision':
        return <Eye className="h-4 w-4" />
      case 'embedding':
        return <Layers className="h-4 w-4" />
      case 'compute':
        return <Cpu className="h-4 w-4" />
      default:
        return <Brain className="h-4 w-4" />
    }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'llm':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      case 'vision':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300'
      case 'embedding':
        return 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300'
      case 'compute':
        return 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-300'
      default:
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    }
  }

  const getModelName = (type, config) => {
    if (config?.model) return config.model
    
    switch (type) {
      case 'llm':
        return 'llama-3-8b'
      case 'vision':
        return 'clip-vit-base'
      case 'embedding':
        return 'text-embedding-ada-002'
      case 'compute':
        return 'custom-model'
      default:
        return 'default-model'
    }
  }

  return (
    <Card className={`min-w-[220px] ${selected ? 'ring-2 ring-primary' : ''} shadow-lg border-purple-200 dark:border-purple-800`}>
      <CardContent className="p-3">
        <div className="flex items-center space-x-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
            {getIcon(data.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{data.label}</div>
            <Badge variant="secondary" className={`text-xs ${getTypeColor(data.type)}`}>
              {data.type}
            </Badge>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center justify-between">
            <span>Model:</span>
            <span className="font-mono text-xs bg-muted px-1 rounded">
              {getModelName(data.type, data.config)}
            </span>
          </div>
          
          {data.config?.temperature && (
            <div className="flex items-center justify-between">
              <span>Temperature:</span>
              <span className="font-mono text-xs">{data.config.temperature}</span>
            </div>
          )}
          
          {data.config?.maxTokens && (
            <div className="flex items-center justify-between">
              <span>Max Tokens:</span>
              <span className="font-mono text-xs">{data.config.maxTokens}</span>
            </div>
          )}
          
          {data.config?.prompt && (
            <div className="mt-2">
              <div className="text-xs font-medium mb-1">Prompt:</div>
              <div className="text-xs bg-muted p-2 rounded line-clamp-2">
                {data.config.prompt}
              </div>
            </div>
          )}
        </div>

        {/* 0G Compute Badge */}
        <div className="mt-2 flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            <Cpu className="h-3 w-3 mr-1" />
            0G Compute
          </Badge>
          <div className="text-xs text-muted-foreground">
            ~{Math.floor(Math.random() * 500 + 100)}ms
          </div>
        </div>
      </CardContent>
      
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />
    </Card>
  )
}

export default memo(AINode)

